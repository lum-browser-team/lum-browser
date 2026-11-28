const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v8')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  await win.evaluate(() => { createTab('https://example.com', false); S.debugHover = true; render(); });
  await win.waitForTimeout(800);
  await win.click('[data-act=settings]'); await win.waitForTimeout(300);
  await win.click('button[data-style=square]'); await win.waitForTimeout(500);
  console.log(JSON.stringify(await win.evaluate(() => ({ uiStyle, r: TK.r, bodySquare: document.body.classList.contains('style-square'), stored: localStorage.getItem('lum-style') }))));
  const shot = async (f, rect) => { const b = await app.evaluate(async ({ BrowserWindow }, rect) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(rect)).toPNG().toString('base64'), rect); require('fs').writeFileSync(path.join(cwd, f), Buffer.from(b, 'base64')); };
  await shot('snap-square-panel.png');
  await win.click('[data-act=settings]'); await win.waitForTimeout(2800);
  await shot('snap-square-bar.png', { x: 0, y: 0, width: 1400, height: 60 });
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
