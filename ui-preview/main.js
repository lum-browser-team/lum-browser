// Lum Preview - mini browser for testing the Lum UI (Electron).
// Frameless window; the whole UI (bar, tabs) is in index.html, pages in <webview>.
const { app, BrowserWindow, ipcMain, screen, Menu, webContents, session, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');

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

// Window buttons (arcs): minimize, maximize, close
ipcMain.on('win', (_e, action) => {
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === 'close') win.close();
});

// Top edge of the page: average lightness (icon color while the bar is transparent)
// and the most common color there (bar color while the cursor is near the top).
// fx0..fx1 (0-1): horizontal strip around the open tab used for the tab color.
ipcMain.handle('sample', async (_e, id, width, fx0 = 0, fx1 = 1) => {
  const wc = webContents.fromId(id);
  if (!wc || wc.isDestroyed()) return null;
  try {
    const img = await wc.capturePage({ x: 0, y: 0, width: Math.max(1, Math.round(width)), height: 64 });
    if (img.isEmpty()) return null;
    const W = 160, H = 8;
    const buf = img.resize({ width: W, height: H, quality: 'good' }).toBitmap(); // BGRA
    const c0 = Math.max(0, Math.floor(fx0 * W)), c1 = Math.min(W, Math.max(c0 + 1, Math.ceil(fx1 * W)));
    const buckets = new Map();
    let sum = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const b = buf[i], g = buf[i + 1], r = buf[i + 2];
      sum += 0.0722 * b + 0.7152 * g + 0.2126 * r;
      const col = (i / 4) % W;
      if (col < c0 || col >= c1) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      buckets.set(key, e);
    }
    let top = null;
    for (const e of buckets.values()) if (!top || e.n > top.n) top = e;
    const r = Math.round(top.r / top.n), g = Math.round(top.g / top.n), b = Math.round(top.b / top.n);
    return {
      lum: sum / (buf.length / 4) / 255,
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
  // Privacy: pages get no camera, microphone, location or notifications.
  session.fromPartition('persist:lum').setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
