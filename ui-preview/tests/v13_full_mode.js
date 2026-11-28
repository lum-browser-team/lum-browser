// "Full" bar mode: bar, tabs and line always visible, page below the bar. The tab's bottom curves have
// the tab color. Right click on a tab: copy its link / close it.
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
(async () => {
  const cwd = path.join(__dirname, '..');
  const profile = path.join(__dirname, '.profile-v13');
  const shots = path.join(__dirname, 'shots-v13');
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(shots, { recursive: true });
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  const shot = async (f, rect) => { const b = await app.evaluate(async ({ BrowserWindow }, rect) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(rect)).toPNG().toString('base64'), rect); fs.writeFileSync(path.join(shots, f), Buffer.from(b, 'base64')); };
  const fieldY = () => win.evaluate(async () => {
    const r = await tab().wv.executeJavaScript("(function(){var b=document.getElementById('nin').getBoundingClientRect();return b.top+b.height/2})()");
    return Math.round(tab().wv.getBoundingClientRect().top + r);
  });
  const yAuto = await fieldY();

  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(300);
  await win.click('[data-act=settings]'); await win.waitForTimeout(300);
  await shot('0-panel.png');
  await win.click('button[data-barmode=full]'); await win.waitForTimeout(300);
  await win.click('[data-act=settings]');
  await win.evaluate(() => { S.debugHover = false; S.near = false; render(); });
  await win.waitForTimeout(1500);
  console.log('field y auto/full', yAuto, await fieldY());

  await win.evaluate(() => createTab('https://en.wikipedia.org/wiki/Norway_spruce'));
  await win.waitForTimeout(7000);
  const st = await win.evaluate(() => ({
    mode: barMode, shownByHover: shown(), barShow: bar.classList.contains('show'),
    tabsOpacity: [...document.querySelectorAll('.tab')].map((t) => getComputedStyle(t).opacity),
    line: getComputedStyle(trackPath).opacity, pageTop: Math.round(tab().wv.getBoundingClientRect().top),
    webviewClickable: getComputedStyle(tab().wv).pointerEvents
  }));
  console.log('full, cursor away', JSON.stringify(st));
  // the line must wrap exactly the open tab (it was once 10 px off when #left became positioned)
  console.log('line matches tab:', await win.evaluate(() => { const r = tab().el.getBoundingClientRect(), b = bar.getBoundingClientRect(), e = activeEdges();
    return Math.abs(e.L - (r.left - b.left)) < 1 && Math.abs(e.R - (r.right - b.left)) < 1; }));
  await shot('1-full.png');
  // zoom on the active tab's bottom left corner: the curve should be the tab color
  const e = await win.evaluate(() => activeEdges());
  await shot('2-corner.png', { x: Math.round(e.L) - 20, y: 20, width: 40, height: 22 });
  const fill = await win.evaluate(() => [tabFillPath.getAttribute('d').slice(0, 40), getComputedStyle(tabFillPath).fill]);
  console.log('tabFill path starts', JSON.stringify(fill));

  // right click on the active tab -> copy link
  const tb = await win.evaluate(() => { const r = tab().el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await win.mouse.click(tb.x, tb.y, { button: 'right' }); await win.waitForTimeout(400);
  console.log('menu open', await win.evaluate(() => ctxEl.classList.contains('open')), 'copy enabled', await win.evaluate(() => !ctxEl.querySelector('[data-ctx=copy]').disabled));
  await shot('3-menu.png');
  await win.click('[data-ctx=copy]'); await win.waitForTimeout(300);
  console.log('clipboard', await app.evaluate(({ clipboard }) => clipboard.readText()), '| menu closed', await win.evaluate(() => !ctxEl.classList.contains('open')), '| toast', await win.evaluate(() => $('toast').textContent));
  await shot('4-toast.png');
  // right click on the new tab page tab: copy disabled; close works
  const t0 = await win.evaluate(() => { const r = S.tabs[0].el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await win.mouse.click(t0.x, t0.y, { button: 'right' }); await win.waitForTimeout(300);
  console.log('start tab: copy disabled', await win.evaluate(() => ctxEl.querySelector('[data-ctx=copy]').disabled));
  await win.click('[data-ctx=close]'); await win.waitForTimeout(400);
  console.log('after close: tabs', await win.evaluate(() => S.tabs.length));
  // Esc closes the menu
  await win.mouse.click(tb.x - 150, tb.y, { button: 'right' }); await win.waitForTimeout(300);
  await win.keyboard.press('Escape'); await win.waitForTimeout(300);
  console.log('Esc closes menu', await win.evaluate(() => !ctxEl.classList.contains('open') && S.menu == null));
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
