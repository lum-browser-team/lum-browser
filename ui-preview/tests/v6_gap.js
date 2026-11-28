const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v6')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(600);
  await win.click('#newtab'); await win.waitForTimeout(600);
  console.log(JSON.stringify(await win.evaluate(() => {
    const a = document.querySelector('.tab.active').getBoundingClientRect(), r = newInput.getBoundingClientRect();
    const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(newInput).font;
    const m = c.measureText('Type');
    const baseline = r.top + (r.height + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    return { leftGap: Math.round(r.left - a.right), bottomGapToLine: Math.round(TK.b - baseline) };
  })));
  const img = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage({ x: 0, y: 0, width: 520, height: 40 })).resize({ width: 1560 }).toPNG().toString('base64'));
  require('fs').writeFileSync(path.join(cwd, 'snap-field-zoom.png'), Buffer.from(img, 'base64'));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
