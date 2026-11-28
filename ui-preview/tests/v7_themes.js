const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v7')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2200);
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(400);
  await win.click('[data-act=settings]'); await win.waitForTimeout(300);
  await win.click('.sw-btn[data-theme=lavender]'); await win.waitForTimeout(600);
  const s1 = await win.evaluate(() => ({ theme, name: TH().name, light: TH().light, startBg: null }));
  s1.startBg = await win.evaluate(() => S.tabs[0].wv.executeJavaScript("getComputedStyle(document.body).backgroundColor"));
  console.log('lavender', JSON.stringify(s1));
  const shot = async (f) => { const b = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); require('fs').writeFileSync(path.join(cwd, f), Buffer.from(b, 'base64')); };
  await shot('snap-lavender.png');
  await win.evaluate(() => setCustomColor('#2E4A62')); await win.waitForTimeout(600);
  console.log('custom', JSON.stringify(await win.evaluate(() => ({ theme, name: TH().name, light: TH().light, page: TH().page }))),
    await win.evaluate(() => S.tabs[0].wv.executeJavaScript("getComputedStyle(document.body).backgroundColor")));
  await shot('snap-custom.png');
  await win.click('[data-act=settings]'); await win.waitForTimeout(300);
  await win.click('#newtab'); await win.waitForTimeout(300);
  console.log('plus still works:', await win.evaluate(() => bar.classList.contains('adding')));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
