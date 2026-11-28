const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v4')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(500);
  await win.click('#newtab'); await win.waitForTimeout(800); await win.keyboard.type('przepis na pierogi'); await win.waitForTimeout(400);
  const img = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage({ x: 0, y: 0, width: 700, height: 40 })).resize({ width: 1400 }).toPNG().toString('base64'));
  require('fs').writeFileSync(path.join(cwd, 'snap-field-zoom.png'), Buffer.from(img, 'base64'));
  console.log(JSON.stringify(await win.evaluate(() => {
    const cs = getComputedStyle(newInput), fs = getComputedStyle(newField), r = newInput.getBoundingClientRect();
    return { rect: [r.x, r.y, r.width, r.height].map(Math.round), color: cs.color, opacity: cs.opacity, fieldOpacity: fs.opacity, fieldBg: fs.backgroundColor, filter: fs.filter, ph: getComputedStyle(newInput, '::placeholder').color, fontSize: cs.fontSize, visibility: cs.visibility };
  })));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
