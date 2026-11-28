// "Clear" bar mode: the bar stays, transparent, with a shade that goes the opposite way of the page
// (darker over a light page, lighter over a dark page); no shade on Lum's own pages.
const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const profile = path.join(__dirname, '.profile-v11');
  require('fs').rmSync(profile, { recursive: true, force: true });
  let app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  let win = await app.firstWindow();
  await win.waitForTimeout(2200);
  const state = () => win.evaluate(() => ({
    mode: barMode, clearBody: document.body.classList.contains('bar-clear'),
    barOpacity: getComputedStyle(bar).opacity, scrimOpacity: getComputedStyle(scrimEl).opacity,
    lighten: scrimEl.classList.contains('lighten'), iconsDark: bar.classList.contains('on-light'),
    pagesTop: getComputedStyle(pages).top, band: getComputedStyle(bandPath).opacity
  }));
  const fieldY = () => win.evaluate(async () => {
    const r = await tab().wv.executeJavaScript("(function(){var b=document.getElementById('nin').getBoundingClientRect();return b.top+b.height/2})()");
    return Math.round(tab().wv.getBoundingClientRect().top + r);
  });
  const yAuto = await fieldY();

  // pick "Clear" in the settings panel
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(300);
  await win.click('[data-act=settings]'); await win.waitForTimeout(300);
  await win.click('button[data-barmode=clear]'); await win.waitForTimeout(400);
  console.log('panel pressed:', await win.evaluate(() => [...document.querySelectorAll('[data-barmode]')].map((b) => b.dataset.barmode + '=' + b.getAttribute('aria-pressed')).join(' ')));
  await win.click('[data-act=settings]');
  await win.evaluate(() => { S.debugHover = false; render(); });
  await win.waitForTimeout(900);
  console.log('start page    ', JSON.stringify(await state()), 'field y auto/clear', yAuto, await fieldY());

  await win.evaluate(() => createTab('https://en.wikipedia.org/wiki/Norway_spruce'));
  await win.waitForTimeout(7000);
  console.log('light page    ', JSON.stringify(await state()));
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(900);
  console.log('light, hovered', JSON.stringify(await state()), 'blur', await win.evaluate(() => getComputedStyle(scrimEl).backdropFilter));
  await win.evaluate(() => { S.debugHover = false; render(); });

  await win.evaluate(() => createTab('https://github.com/electron/electron'));
  await win.waitForTimeout(7000);
  console.log('dark page     ', JSON.stringify(await state()));
  await app.close();

  // remembered after restart
  app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  win = await app.firstWindow();
  await win.waitForTimeout(2000);
  console.log('after restart ', await win.evaluate(() => barMode));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
