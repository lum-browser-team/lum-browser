const { launch, shot, inPage, waitFor, sleep, key } = require('./lib');
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 20000);
const box = (win, sel) => win.locator(sel).first().boundingBox();
const click = async (win, sel, opts) => { let b = null; for (let k = 0; k < 20 && !b; k++) { b = await box(win, sel); if (!b) { console.log("  (no box for", sel, "retry)", JSON.stringify(await win.evaluate((s) => { const e = document.querySelector(s); return e ? [e.isConnected, getComputedStyle(e).display, JSON.stringify(e.getBoundingClientRect())] : "missing"; }, sel))); await sleep(100); } } await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2, opts); };
const layout = (win) => win.evaluate(() => {
  const r = (el) => el ? Math.round(el.getBoundingClientRect().right) : null;
  const tabs = [...document.querySelectorAll('.tab')];
  const plus = document.querySelector('.newtab').getBoundingClientRect();
  const right = document.getElementById('right').getBoundingClientRect();
  return { n: tabs.length, dense: tabsEl.classList.contains('dense'), tabW: Math.round(tabs[0].getBoundingClientRect().width), tabsElRight: r(tabsEl), lastTabRight: r(tabs[tabs.length - 1]), plus: [Math.round(plus.left), Math.round(plus.right)], rightSideLeft: Math.round(right.left), winW: innerWidth, scrollW: tabsEl.scrollWidth, clientW: tabsEl.clientWidth, hitAtPlus: document.elementFromPoint(plus.left + plus.width / 2, 24)?.closest('[data-act]')?.dataset.act };
});
(async () => {
  const { app, win, logs } = await launch('t5');
  const log = (...a) => console.log(...a);
  try {
    await win.evaluate(() => { S.debugHover = true; render(); });
    await sleep(1000);
    // add tabs by clicking "+"
    for (let i = 1; i <= 26; i++) {
      await click(win, '[data-act=newtab]');
      await sleep(120);
      if ([5, 8, 10, 15, 20, 22, 26].includes(i)) log('after +' + i, JSON.stringify(await layout(win)));
    }
    await sleep(2500);
    await shot(app, 't5_27_tabs');
    // narrow window
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 600));
    await sleep(1500);
    log('760px wide, 27 tabs', JSON.stringify(await layout(win)));
    await shot(app, 't5_27_tabs_760px');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1400, 880));
    await sleep(1000);
    // dense: hover a non-active tab and click its x
    const n0 = await win.evaluate(() => S.tabs.length);
    const second = await win.locator('.tab').nth(1).boundingBox();
    await win.mouse.move(second.x + second.width / 2, second.y + second.height / 2); await sleep(400);
    log('dense hover: x visible?', await win.evaluate(() => { const x = document.querySelectorAll('.tab')[1].querySelector('.x'); return getComputedStyle(x).display + '/' + getComputedStyle(x).opacity; }));
    await shot(app, 't5_dense_hover');
    await win.mouse.click(second.x + second.width / 2, second.y + second.height / 2); await sleep(300);
    log('click x in dense mode: tabs', n0, '->', await win.evaluate(() => S.tabs.length));
    // middle-click close
    const third = await win.locator('.tab').nth(2).boundingBox();
    await win.mouse.click(third.x + third.width / 2, third.y + third.height / 2, { button: 'middle' }); await sleep(300);
    log('middle click: tabs ->', await win.evaluate(() => S.tabs.length));
    // close down to 3 tabs
    await win.evaluate(() => { while (S.tabs.length > 3) closeTab(S.tabs[S.tabs.length - 1].id); });
    await sleep(800);
    log('3 tabs layout', JSON.stringify(await layout(win)));
    // non-dense: hover x and click it
    const t1 = await win.locator('.tab').nth(1).boundingBox();
    await win.mouse.move(t1.x + t1.width / 2, t1.y + t1.height / 2); await sleep(400);
    const xb = await win.locator('.tab').nth(1).locator('.x').boundingBox();
    log('x opacity on hover', await win.evaluate(() => getComputedStyle(document.querySelectorAll('.tab')[1].querySelector('.x')).opacity));
    await shot(app, 't5_x_hover');
    await win.mouse.click(xb.x + xb.width / 2, xb.y + xb.height / 2); await sleep(300);
    log('after x click tabs ->', await win.evaluate(() => S.tabs.length));
    // Ctrl shortcuts via main-process input events
    await win.evaluate(() => activateTab(S.tabs[0].id));
    const sc = [];
    await key(app, 't', ['control']); await sleep(600); sc.push('Ctrl+T n=' + await win.evaluate(() => S.tabs.length));
    await key(app, 'Tab', ['control']); await sleep(300); sc.push('Ctrl+Tab active=' + await win.evaluate(() => S.tabs.findIndex((t) => t.id === S.active)));
    await key(app, 'Tab', ['control', 'shift']); await sleep(300); sc.push('Ctrl+Shift+Tab active=' + await win.evaluate(() => S.tabs.findIndex((t) => t.id === S.active)));
    await key(app, 'w', ['control']); await sleep(400); sc.push('Ctrl+W n=' + await win.evaluate(() => S.tabs.length));
    await key(app, 'l', ['control']); await sleep(400); sc.push('Ctrl+L search=' + await win.evaluate(() => S.search) + ' n=' + await win.evaluate(() => S.tabs.length));
    await win.keyboard.press('Escape');
    await win.evaluate((u) => tab().wv.loadURL(u), 'https://example.com'); await idle(win);
    await inPage(win, 'window.__m=1');
    await key(app, 'F5'); await sleep(300); await idle(win); sc.push('F5 reloaded=' + await inPage(win, 'window.__m===undefined'));
    await inPage(win, 'window.__m=1');
    await key(app, 'r', ['control']); await sleep(300); await idle(win); sc.push('Ctrl+R reloaded=' + await inPage(win, 'window.__m===undefined'));
    await key(app, 'Left', ['alt']); await sleep(300); await idle(win); sc.push('Alt+Left url=' + (await win.evaluate(() => tab().url)).slice(-25));
    await key(app, 'Right', ['alt']); await sleep(300); await idle(win); sc.push('Alt+Right url=' + (await win.evaluate(() => tab().url)).slice(-25));
    log('shortcuts:', sc.join(' | '));
    // shortcut while focus is inside the page (webview): Ctrl+T
    await inPage(win, 'document.body.focus()');
    await win.evaluate(() => tab().wv.focus());
    await win.keyboard.press('Control+t'); await sleep(600);
    log('Ctrl+T via keyboard into page, n=', await win.evaluate(() => S.tabs.length));
    // target=_blank
    await win.evaluate((u) => tab().wv.loadURL(u), 'https://example.com'); await idle(win);
    const nb = await win.evaluate(() => S.tabs.length);
    await inPage(win, `const a=document.createElement('a');a.href='https://example.org/';a.target='_blank';a.textContent='x';document.body.appendChild(a);a.click();`, true);
    await sleep(2500);
    log('target=_blank: tabs', nb, '->', await win.evaluate(() => S.tabs.length), 'active url', await win.evaluate(() => tab().url));
    await inPage(win, `window.open('https://example.net/','_blank','width=400,height=300')`, true);
    await sleep(1500);
    log('window.open popup: tabs ->', await win.evaluate(() => S.tabs.length), 'windows', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length));
    // close last tab -> fresh new tab
    await win.evaluate(() => { while (S.tabs.length > 1) closeTab(S.tabs[0].id); });
    await win.evaluate((u) => tab().wv.loadURL(u), 'https://example.com'); await idle(win);
    await win.evaluate(() => closeTab(S.active)); await sleep(1200);
    log('closed last tab', JSON.stringify(await win.evaluate(() => ({ n: S.tabs.length, url: tab().url.replace(/^file:.*\//, '') }))), 'note focused:', await inPage(win, 'document.activeElement.id'));
    // window arcs
    const W = () => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { min: w.isMinimized(), max: w.isMaximized() }; });
    await win.evaluate(() => { S.debugHover = true; render(); });
    await click(win, '[data-act=max]'); await sleep(800); log('after max click', JSON.stringify(await W()));
    await shot(app, 't5_maximized_hover');
    log('maximized layout', JSON.stringify(await win.evaluate(() => ({ w: innerWidth, d: trackPath.getAttribute('d').slice(-12) }))));
    await click(win, '[data-act=max]'); await sleep(800); log('after 2nd max click', JSON.stringify(await W()));
    await click(win, '[data-act=min]'); await sleep(800); log('after min click', JSON.stringify(await W()));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore()); await sleep(800);
    log('LOGS before close', JSON.stringify(logs));
    const closed = new Promise((r) => app.on('close', () => r('app exited')));
    await click(win, '[data-act=close]').catch((e) => log('close click err', e.message));
    log('close arc ->', await Promise.race([closed, sleep(5000).then(() => 'still running')]));
  } finally { try { await app.close(); } catch {} }
})().catch((e) => { console.error(e); process.exit(1); });
