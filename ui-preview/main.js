// Lum Preview - mini browser for testing the Lum UI (Electron).
// Frameless window; the whole UI (bar, tabs) is in index.html, pages in <webview>.
const { app, BrowserWindow, ipcMain, screen, Menu, webContents, session, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { startAdblock, adblockState } = require('./adblock');

// Running from the source (npm start, test snapshots) uses its own profile, so it never changes
// the settings of the installed Lum Preview.exe. Tests pass --user-data-dir and keep theirs.
if (!app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Lum Preview (dev)'));
}

let win = null;
let poll = null;

function iconPath() {
  const p = path.join(__dirname, '..', 'lum', 'branding', 'overlay', 'chrome', 'app', 'theme', 'chromium', 'product_logo_256.png');
  return fs.existsSync(p) ? p : undefined;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 760,
    minHeight: 480,
    frame: false,
    backgroundColor: '#000000',
    show: false,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webviewTag: true,
      spellcheck: false
    }
  });
  win.loadFile('index.html');
  win.once('ready-to-show', () => {
    // Tests only: LUM_BOUNDS=x,y,width,height puts the window at a known spot
    if (process.env.LUM_BOUNDS) {
      const [x, y, width, height] = process.env.LUM_BOUNDS.split(',').map(Number);
      win.setBounds({ x, y, width, height });
      win.setAlwaysOnTop(true, 'screen-saver');
    }
    win.show();
    if (process.env.LUM_BOUNDS) { win.focus(); win.moveTop(); }
  });

  // Cursor zone relative to the top edge. The page in <webview> swallows mouse events,
  // so the cursor position is checked every 50 ms and only a zone CHANGE is sent to the UI:
  //   edge - the very top edge, bar - at bar height, near - just below the bar, far/out - further away.
  let lastZone = null;
  poll = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible() || win.isMinimized()) return;
    const p = screen.getCursorScreenPoint();
    const b = win.getContentBounds();
    const x = p.x - b.x, y = p.y - b.y;
    const inX = x >= 0 && x < b.width;
    let zone = 'out';
    if (inX && y >= -6 && y < 8) zone = 'edge';
    else if (inX && y >= 8 && y < 38) zone = 'bar';
    else if (inX && y >= 38 && y < 80) zone = 'near';
    else if (inX && y >= 80 && y < b.height) zone = 'far';
    if (zone !== lastZone) { lastZone = zone; win.webContents.send('zone', zone); }
  }, 50);
  win.webContents.on('did-finish-load', () => { lastZone = null; });

  win.on('maximize', () => win.webContents.send('maximized', true));
  win.on('unmaximize', () => win.webContents.send('maximized', false));
  win.on('blur', () => endDrag());
  win.on('closed', () => { clearInterval(poll); endDrag(); win = null; });

  // Check mode: LUM_SNAPSHOT=file.png saves a window screenshot after a few seconds and quits the app.
  if (process.env.LUM_SNAPSHOT) {
    const delay = Number(process.env.LUM_SNAPSHOT_DELAY || 5000);
    if (process.env.LUM_EVAL) {
      win.webContents.once('did-finish-load', () => {
        setTimeout(() => win.webContents.executeJavaScript(process.env.LUM_EVAL).catch(() => {}), 1500);
      });
    }
    if (process.env.LUM_BARMODE) {
      win.webContents.once('did-finish-load', () => {
        win.webContents.executeJavaScript('setBarMode(' + JSON.stringify(process.env.LUM_BARMODE) + ')').catch(() => {});
      });
    }
    if (process.env.LUM_OPEN) {
      setTimeout(() => process.env.LUM_OPEN.split(',').forEach((u) => win.webContents.send('open-tab', u)), 1000);
    }
    setTimeout(async () => {
      if (process.env.LUM_SNAPSHOT_HOVER) win.webContents.send('debug-hover', true);
      await new Promise((r) => setTimeout(r, process.env.LUM_SNAPSHOT_HOVER ? 3200 : 0));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.LUM_SNAPSHOT, img.toPNG());
      app.quit();
    }, delay);
  }
}

// Manual window dragging by the empty bar, without "-webkit-app-region: drag".
// Currently unused: the bar uses native app-region dragging (snapping works), see style.css.
let drag = null;
ipcMain.on('drag-start', (_e, sx, sy) => {
  if (!win || win.isMaximized() || win.isFullScreen()) return;
  const [wx, wy] = win.getPosition();
  const p = screen.getCursorScreenPoint();
  clearInterval(drag && drag.timer);
  drag = { ox: p.x - wx, oy: p.y - wy, timer: setInterval(() => {
    if (!win || win.isDestroyed()) { clearInterval(drag.timer); drag = null; return; }
    const c = screen.getCursorScreenPoint();
    win.setPosition(c.x - drag.ox, c.y - drag.oy);
  }, 10) };
});
function endDrag() { if (drag) { clearInterval(drag.timer); drag = null; } }
ipcMain.on('drag-end', endDrag);

// Copy text (a tab's link) to the clipboard
ipcMain.on('copy', (_e, text) => { if (typeof text === 'string' && text.length < 8192) clipboard.writeText(text); });

// QR code of a link (tab menu -> Show QR code), as SVG markup made by the qrcode library
ipcMain.handle('qr', async (_e, text) => {
  if (typeof text !== 'string' || !text || text.length > 2000) return null;
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#FFFFFF' } });
});

// Downloads go straight to the system Downloads folder: no "Save as" dialog and nothing shown.
// An existing name gets " (1)", " (2)"... like other browsers do.
function uniquePath(dir, name) {
  const safe = (name || 'download').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 200) || 'download';
  const ext = path.extname(safe), base = safe.slice(0, safe.length - ext.length);
  let p = path.join(dir, safe);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, base + ' (' + i + ')' + ext);
  return p;
}
function autoDownloads(ses) {
  ses.on('will-download', (_e, item) => { item.setSavePath(uniquePath(app.getPath('downloads'), item.getFilename())); });
}

// Window buttons (arcs): minimize, maximize, close
ipcMain.on('win', (_e, action) => {
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === 'close') win.close();
});

// Two things from the page:
//  - lum: average lightness of the page's top 64 px (icon color while the bar is transparent)
//  - color: the tab color = the color of the page pixels RIGHT UNDER the open tab (a 2 px row starting at `y`,
//    from x0 to x1 in page coordinates) - the nearest pixels, not the area around, so the tab flows into the page
//    without a seam (e.g. not the color of a search box a bit lower). The most common exact color in that row wins.
ipcMain.handle('sample', async (_e, id, width, opts = {}) => {
  const wc = webContents.fromId(id);
  if (!wc || wc.isDestroyed()) return null;
  try {
    const W = Math.max(1, Math.round(width));
    const top = await wc.capturePage({ x: 0, y: 0, width: W, height: 64 });
    if (top.isEmpty()) return null;
    const small = top.resize({ width: 160, height: 8, quality: 'good' }).toBitmap(); // BGRA
    let sum = 0;
    for (let i = 0; i < small.length; i += 4) sum += 0.0722 * small[i] + 0.7152 * small[i + 1] + 0.2126 * small[i + 2];

    const x0 = Math.max(0, Math.min(W - 1, Math.round(opts.x0 ?? 0)));
    const x1 = Math.max(x0 + 1, Math.min(W, Math.round(opts.x1 ?? W)));
    const y = Math.max(0, Math.round(opts.y ?? 0));
    const row = await wc.capturePage({ x: x0, y, width: x1 - x0, height: 2 });
    const rs = row.getSize(), buf = row.toBitmap();
    const buckets = new Map();
    for (let i = 0; i + 3 < buf.length && i < rs.width * rs.height * 4; i += 4) {
      const b = buf[i], g = buf[i + 1], r = buf[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
    let best = null;
    for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
    if (!best) return null;
    const r = Math.round(best.r / best.n), g = Math.round(best.g / best.n), b = Math.round(best.b / best.n);
    return {
      lum: sum / (small.length / 4) / 255,
      color: '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''),
      colorLum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    };
  } catch {
    return null;
  }
});

// Keyboard shortcuts work even when the text caret is inside the page.
function sendCmd(cmd) { return () => { if (win) win.webContents.send('cmd', cmd); }; }
Menu.setApplicationMenu(Menu.buildFromTemplate([{
  label: 'Lum Preview',
  submenu: [
    { label: 'New tab', accelerator: 'CmdOrCtrl+T', click: sendCmd('newtab') },
    { label: 'Close tab', accelerator: 'CmdOrCtrl+W', click: sendCmd('close') },
    { label: 'Search', accelerator: 'CmdOrCtrl+L', click: sendCmd('search') },
    { label: 'Next tab', accelerator: 'Ctrl+Tab', click: sendCmd('next') },
    { label: 'Previous tab', accelerator: 'Ctrl+Shift+Tab', click: sendCmd('prev') },
    { label: 'Reload', accelerator: 'F5', click: sendCmd('reload') },
    { label: 'Reload ', accelerator: 'CmdOrCtrl+R', click: sendCmd('reload') },
    { label: 'Back', accelerator: 'Alt+Left', click: sendCmd('back') },
    { label: 'Forward', accelerator: 'Alt+Right', click: sendCmd('forward') },
    { label: 'Developer tools', accelerator: 'F12', click: () => win && win.webContents.openDevTools({ mode: 'detach' }) }
  ]
}]));

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  // Links that open a new window go to a new Lum tab, but only right after a user click
  // or key press - a page cannot open tabs on its own.
  let lastInput = 0;
  contents.on('input-event', (_ev, input) => {
    if (input.type === 'mouseDown' || input.type === 'mouseUp' || input.type === 'keyDown') lastInput = Date.now();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (win && Date.now() - lastInput < 1500 && /^https?:/i.test(url)) {
      lastInput = 0; // one click = one tab
      win.webContents.send('open-tab', url);
    }
    return { action: 'deny' };
  });
});

// Scroll hook in a separate JS world: the page cannot see it or use it to fingerprint the browser.
//  __lum_scroll__  - scrolling stopped (resample the page color)
//  __lum_top__1/0  - the page is / is not scrolled to the very top (sent only on change).
//    A page that is barely scrollable (<= 40 px) stays "at the top", otherwise moving it
//    below the bar and back could make it flip between the two states.
const SCROLL_HOOK = "(function(){var t,top=null;" +
  "function chk(){var y=window.scrollY||0,se=document.scrollingElement||document.documentElement," +
  "max=(se?se.scrollHeight:0)-window.innerHeight,a=y<=0||(top===true&&max<=40);" +
  "if(a!==top){top=a;console.debug('__lum_top__'+(a?1:0));}}" +
  "addEventListener('scroll',function(){chk();clearTimeout(t);t=setTimeout(function(){console.debug('__lum_scroll__')},140)},{passive:true,capture:true});" +
  "addEventListener('load',chk);chk();})();";
ipcMain.handle('hook', async (_e, id) => {
  const wc = webContents.fromId(id);
  if (!wc || wc.isDestroyed()) return false;
  try { await wc.executeJavaScriptInIsolatedWorld(1999, [{ code: SCROLL_HOOK }]); return true; } catch { return false; }
});

app.whenReady().then(() => {
  const ses = session.fromPartition('persist:lum');
  // Privacy: pages get no camera, microphone, location or notifications.
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  // Ads and trackers blocked (uBlock Origin's filter lists); with a cached engine it is on before the first page loads
  startAdblock(ses, path.join(app.getPath('userData'), 'adblock')).catch(() => {});
  autoDownloads(ses);
  createWindow();
});
// A failure in a background job (e.g. downloading filter lists) must not pop up an error dialog;
// it is logged and the browser keeps working.
process.on('uncaughtException', (e) => { console.error('[lum] background error:', e && e.stack || e); });
// For tests: global state of the blocker
global.lumAdblock = adblockState;
app.on('window-all-closed', () => app.quit());
