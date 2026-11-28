// Checks the buttons after the fix (a click on body[data-theme] used to catch everything).
const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v3')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2500);
  const st = () => win.evaluate(() => ({ search: S.search, target: S.searchTarget, settings: S.settings, tabs: S.tabs.length, theme, bar: barMode, url: tab().url.slice(0, 40), placeholder: input.placeholder }));
  const out = [];
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(400);

  await win.click('[data-act=settings]'); await win.waitForTimeout(300); out.push(['settings open', await st()]);
  await win.click('.sw-btn[data-theme=gray]'); await win.waitForTimeout(300); out.push(['theme gray', await st()]);
  await win.click('button[data-barmode=fixed]'); await win.waitForTimeout(300); out.push(['bar fixed', await st()]);
  await win.click('button[data-barmode=auto]'); await win.waitForTimeout(300);
  await win.click('[data-act=settings]'); await win.waitForTimeout(300); out.push(['settings closed', await st()]);

  await win.click('#newtab'); await win.waitForTimeout(400); out.push(['plus -> field', await st()]);
  await win.keyboard.type('example.com'); await win.keyboard.press('Enter'); await win.waitForTimeout(3000); out.push(['enter -> new tab', await st()]);

  await win.click('#newtab'); await win.waitForTimeout(300);
  await win.keyboard.press('Escape'); await win.waitForTimeout(300); out.push(['plus + Esc -> no tab', await st()]);

  await win.click('[data-act=back]'); await win.waitForTimeout(300);
  await win.click('[data-act=reload]'); await win.waitForTimeout(1500); out.push(['back/reload clicked', await st()]);
  const hasSearchBtn = await win.evaluate(() => !!document.querySelector('#right [data-act=search]'));
  out.push(['magnifier removed', { present: hasSearchBtn }]);

  for (const [k, v] of out) console.log(k.padEnd(22), JSON.stringify(v));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
