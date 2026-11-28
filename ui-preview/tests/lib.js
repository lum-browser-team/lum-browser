// QA helper: launches an isolated Lum instance (own user-data-dir) via Playwright Electron.
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(name = 'ud') {
  const ud = path.join(__dirname, 'userdata-' + name);
  const app = await electron.launch({
    args: ['.', '--user-data-dir=' + ud],
    cwd: ROOT,
    executablePath: require('electron'),
  });
  const logs = { main: [], renderer: [] };
  app.process().stdout.on('data', (d) => logs.main.push('OUT ' + d));
  app.process().stderr.on('data', (d) => logs.main.push('ERR ' + d));
  let win = null;
  for (let i = 0; i < 50 && !win; i++) {
    for (const w of app.windows()) { if (/index\.html/.test(w.url())) win = w; }
    if (!win) await sleep(200);
  }
  if (!win) win = await app.firstWindow();
  win.on('console', (m) => logs.renderer.push(m.type() + ': ' + m.text()));
  win.on('pageerror', (e) => logs.renderer.push('PAGEERROR: ' + e.message));
  await win.waitForLoadState('domcontentloaded');
  await sleep(1500);
  return { app, win, logs };
}

// Full window capture from main process (includes webviews).
async function shot(app, name) {
  const b64 = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((x) => /index\.html/.test(x.webContents.getURL()));
    const img = await w.webContents.capturePage();
    return img.toPNG().toString('base64');
  });
  const p = path.join(OUT, name + '.png');
  fs.writeFileSync(p, Buffer.from(b64, 'base64'));
  return p;
}

// run JS inside the active webview
async function inPage(win, code, gesture = false) {
  return win.evaluate(([c, g]) => document.querySelector('webview:not(.hidden)').executeJavaScript(c, g), [code, gesture]);
}

async function waitFor(fn, ms = 15000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch {} await sleep(step); }
  return null;
}

// send a key through the main process input pipeline (so menu accelerators can trigger)
async function key(app, keyCode, modifiers = []) {
  await app.evaluate(({ BrowserWindow }, [k, m]) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.focus();
    w.webContents.sendInputEvent({ type: 'keyDown', keyCode: k, modifiers: m });
    w.webContents.sendInputEvent({ type: 'keyUp', keyCode: k, modifiers: m });
  }, [keyCode, modifiers]);
}

module.exports = { launch, shot, inPage, waitFor, sleep, key, OUT, ROOT };

// v2 helpers
const OUT2 = path.join(__dirname, 'shots2');
fs.mkdirSync(OUT2, { recursive: true });
async function shot2(app, name) {
  const p = await shot(app, '__tmp');
  const dst = path.join(OUT2, name + '.png');
  fs.renameSync(p, dst);
  return dst;
}
async function zone(app, z) {
  await app.evaluate(({ BrowserWindow }, z) => BrowserWindow.getAllWindows()[0].webContents.send('zone', z), z);
}
module.exports.shot2 = shot2;
module.exports.zone = zone;
