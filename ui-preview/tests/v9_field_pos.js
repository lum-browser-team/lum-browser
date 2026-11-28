const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v9')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2200);
  // field position in the window = top edge of the page (webview) + field position in the page
  const pos = () => win.evaluate(async () => {
    const wv = S.tabs[0].wv, top = wv.getBoundingClientRect().top;
    const y = await wv.executeJavaScript("(function(){var r=document.getElementById('nin').getBoundingClientRect();return r.top+r.height/2})()");
    return Math.round(top + y);
  });
  const out = {};
  await win.evaluate(() => setBarMode('auto')); await win.waitForTimeout(700); out.auto = await pos();
  await win.evaluate(() => setBarMode('fixed')); await win.waitForTimeout(700); out.fixed = await pos();
  await win.evaluate(() => setBarMode('auto')); await win.waitForTimeout(700); out.autoAgain = await pos();
  console.log('field center y in window:', JSON.stringify(out));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
