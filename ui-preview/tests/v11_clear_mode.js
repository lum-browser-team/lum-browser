// "Clear" bar mode: the bar stays and is transparent. A page scrolled to the very top starts below the bar
// (docked); scrolled down it runs under the bar with a dark shade. No shade on Lum's own pages.
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
(async () => {
  const cwd = path.join(__dirname, '..');
  const profile = path.join(__dirname, '.profile-v11');
  const shots = path.join(__dirname, 'shots-v11');
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(shots, { recursive: true });
  let app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  let win = await app.firstWindow();
  await win.waitForTimeout(2200);
  const shot = async (f) => { const b = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(shots, f), Buffer.from(b, 'base64')); };
  const state = () => win.evaluate(() => ({
    mode: barMode, atTop: tab().atTop, docked: tab().wv.classList.contains('docked'),
    pageTop: Math.round(tab().wv.getBoundingClientRect().top), pageH: Math.round(tab().wv.getBoundingClientRect().height),
    scrim: getComputedStyle(scrimEl).opacity, iconsDark: bar.classList.contains('on-light')
  }));
  const scroll = (y) => win.evaluate((y) => tab().wv.executeJavaScript('scrollTo(0,' + y + ')'), y);
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
  await win.click('[data-act=settings]');
  await win.evaluate(() => { S.debugHover = false; render(); });
  await win.waitForTimeout(900);
  console.log('start page      ', JSON.stringify(await state()), 'field y auto/clear', yAuto, await fieldY());

  for (const [name, url] of [['youtube', 'https://www.youtube.com/'], ['wiki', 'https://en.wikipedia.org/wiki/Norway_spruce'], ['github', 'https://github.com/electron/electron']]) {
    await win.evaluate((u) => createTab(u), url);
    await win.waitForTimeout(8000);
    console.log(name.padEnd(8), 'top   ', JSON.stringify(await state()));
    await shot(name + '-1-top.png');
    await scroll(400); await win.waitForTimeout(900);
    console.log(name.padEnd(8), 'down  ', JSON.stringify(await state()));
    await shot(name + '-2-down.png');
    await scroll(0); await win.waitForTimeout(900);
    console.log(name.padEnd(8), 'back  ', JSON.stringify(await state()));
  }
  await app.close();

  // remembered after restart
  app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  win = await app.firstWindow();
  await win.waitForTimeout(2000);
  console.log('after restart   ', await win.evaluate(() => barMode));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
