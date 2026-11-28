// Plus zamienia się w pole w tym samym miejscu, karty zostają widoczne; Enter otwiera nową kartę.
const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v4')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  await win.evaluate(() => { createTab('https://example.com'); S.debugHover = true; render(); });
  await win.waitForTimeout(2500);
  const plusBox = await win.locator('#newtab').boundingBox();
  await win.click('#newtab');
  await win.waitForTimeout(600);
  const st = await win.evaluate(() => ({
    adding: bar.classList.contains('adding'),
    plusDisplay: getComputedStyle(plusBtn).display,
    fieldVisible: getComputedStyle(newField).display,
    fieldFocused: document.activeElement === newInput,
    tabsOpacity: [...document.querySelectorAll('.tab')].map((t) => getComputedStyle(t).opacity),
    centerSearchVisible: getComputedStyle(document.querySelector('.sbox')).display,
    tabs: S.tabs.length
  }));
  const fieldBox = await win.locator('#newfield').boundingBox();
  console.log('state', JSON.stringify(st));
  console.log('plus x', Math.round(plusBox.x), 'field x', Math.round(fieldBox.x), 'field w', Math.round(fieldBox.width));
  const img = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  require('fs').writeFileSync(path.join(cwd, 'snap-inline-plus.png'), Buffer.from(img, 'base64'));
  await win.keyboard.type('pl.wikipedia.org');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(2500);
  console.log('after enter', JSON.stringify(await win.evaluate(() => ({ tabs: S.tabs.length, adding: bar.classList.contains('adding'), url: tab().url.slice(0, 40) }))));
  await win.click('#newtab'); await win.waitForTimeout(300);
  await win.keyboard.press('Escape'); await win.waitForTimeout(300);
  console.log('after esc', JSON.stringify(await win.evaluate(() => ({ tabs: S.tabs.length, adding: bar.classList.contains('adding'), plus: getComputedStyle(plusBtn).display }))));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
