const { launch, shot, inPage, waitFor, sleep, key } = require('./lib');
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 20000);
(async () => {
  const log = (...a) => console.log(...a);
  // ---- run A
  let { app, win, logs } = await launch('t6');
  try {
    await win.evaluate(() => { S.debugHover = true; render(); });
    await sleep(800);
    // 1) lost click: mousedown on "+", tab strip re-renders (as on any load event), mouseup
    const n0 = await win.evaluate(() => S.tabs.length);
    let b = await win.locator('[data-act=newtab]').boundingBox();
    await win.mouse.move(b.x + 18, b.y + 18); await win.mouse.down();
    await win.evaluate(() => renderTabs());
    await win.mouse.up(); await sleep(400);
    log('click on + with re-render between down/up: tabs', n0, '->', await win.evaluate(() => S.tabs.length));
    await win.mouse.click(b.x + 18, b.y + 18); await sleep(400);
    log('control click on +: tabs ->', await win.evaluate(() => S.tabs.length));
    // same for switching tabs while another tab is loading
    await win.evaluate(() => { createTab('https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity'); });
    await idle(win); await sleep(500);
    let lost = 0, total = 0;
    for (let i = 0; i < 12; i++) {
      await win.evaluate(() => { S.tabs[S.tabs.length - 1].wv.reload(); });
      await sleep(30 + (i * 37) % 200);
      const target = i % 2;
      const tb = await win.locator('.tab').nth(target).boundingBox();
      if (!tb) { lost++; total++; continue; }
      await win.mouse.click(tb.x + 30, tb.y + 16, { delay: 90 });
      await sleep(150);
      total++;
      const act = await win.evaluate(() => S.tabs.findIndex((t) => t.id === S.active));
      if (act !== target) lost++;
    }
    log('tab clicks (90ms press) while a tab is loading: lost', lost, 'of', total);

    // 2) 30 tabs at 1400px
    await win.evaluate(() => { while (S.tabs.length < 30) openNewTab(); });
    await sleep(3000);
    const L = await win.evaluate(() => { const tabs = [...document.querySelectorAll('.tab')]; const p = document.querySelector('.newtab').getBoundingClientRect(); const s = bar.querySelector('[data-act=search]').getBoundingClientRect(); return { n: tabs.length, tabW: Math.round(tabs[0].getBoundingClientRect().width), lastRight: Math.round(tabs.at(-1).getBoundingClientRect().right), plus: [Math.round(p.left), Math.round(p.right)], searchBtn: [Math.round(s.left), Math.round(s.right)], topAtSearch: document.elementFromPoint(s.left + 18, 24).closest('[data-act],[data-tab]')?.outerHTML.slice(0, 50), topAtPlus: document.elementFromPoint(Math.min(p.left + 18, innerWidth - 1), 24)?.closest('[data-act],[data-tab]')?.outerHTML.slice(0, 50) }; });
    log('30 tabs @1400', JSON.stringify(L));
    await shot(app, 't6_30_tabs_1400');
    await win.evaluate(() => { while (S.tabs.length > 2) closeTab(S.tabs.at(-1).id); });

    // 3) target=_blank with a real mouse click on a link inside the page
    await win.evaluate(() => tab().wv.loadURL('data:text/html,<a id=l href="https://example.org/" target="_blank" style="position:absolute;top:300px;left:300px;font-size:40px">NEW TAB LINK</a>'));
    await sleep(1500);
    await win.evaluate(() => { S.debugHover = false; render(); });
    const nb = await win.evaluate(() => S.tabs.length);
    await win.mouse.click(400, 322); await sleep(2000);
    log('real click on target=_blank link: tabs', nb, '->', await win.evaluate(() => S.tabs.length), '| allowpopups attr:', await win.evaluate(() => tab().wv.hasAttribute('allowpopups')));
    await shot(app, 't6_target_blank_nothing');
    // control: same flow but webview created with allowpopups (runtime patch in the test only)
    await win.evaluate(() => { const ce = document.createElement.bind(document); document.createElement = (n, o) => { const e = ce(n, o); if (n === 'webview') e.setAttribute('allowpopups', ''); return e; }; createTab('data:text/html,<a id=l href="https://example.org/" target="_blank" style="position:absolute;top:300px;left:300px;font-size:40px">NEW TAB LINK</a>'); });
    await sleep(1500);
    const nc = await win.evaluate(() => S.tabs.length);
    await win.mouse.click(400, 322); await sleep(2000);
    log('control with allowpopups: tabs', nc, '->', await win.evaluate(() => S.tabs.length), 'active url', await win.evaluate(() => tab().url));

    // 4) double caret in search mode on start page
    await win.evaluate(() => openNewTab()); await idle(win); await sleep(600);
    await win.evaluate(() => openSearch()); await sleep(400);
    log('search mode on start page: host focus', await win.evaluate(() => document.activeElement.id), '| guest activeElement', await inPage(win, 'document.activeElement.id'), '| guest hasFocus', await inPage(win, 'document.hasFocus()'));
    await win.keyboard.type('abc'); await sleep(200);
    log('typed abc ->  #q:', await win.evaluate(() => input.value), ' #nin:', await inPage(win, 'nin.value'));
    await shot(app, 't6_search_two_carets');
    await win.keyboard.press('Escape');
    // 5) theme persists across restart
    await win.evaluate(() => setTheme('light'));
    await sleep(500);
  } finally { await app.close(); }
  ({ app, win, logs } = await launch('t6'));
  try {
    log('after restart theme', await win.evaluate(() => [theme, document.body.className, tab().url.split('?')[1]]));
    // nothing changes theme by itself: watch for 6s with hover toggling, tab ops, page loads
    for (let i = 0; i < 6; i++) { await win.evaluate((i) => { S.near = i % 2 === 0; render(); if (i === 2) createTab('https://example.com'); if (i === 4) step(1); }, i); await sleep(1000); }
    log('theme after 6s of activity', await win.evaluate(() => [theme, localStorage.getItem('lum-theme')]));
    // Ctrl+T when the page (webview guest) has keyboard focus, via guest input events
    await win.evaluate(() => activateTab(S.tabs[0].id)); await sleep(500);
    await win.evaluate(() => tab().wv.focus()); await sleep(200);
    const nT = await win.evaluate(() => S.tabs.length);
    await app.evaluate(({ webContents }) => { const g = webContents.getAllWebContents().filter((w) => w.getType() === 'webview')[0]; g.sendInputEvent({ type: 'keyDown', keyCode: 'T', modifiers: ['control'] }); g.sendInputEvent({ type: 'keyUp', keyCode: 'T', modifiers: ['control'] }); });
    await sleep(800);
    log('Ctrl+T sent to guest webContents: tabs', nT, '->', await win.evaluate(() => S.tabs.length));
    // label with long / odd URLs
    await win.evaluate(() => tab().wv.loadURL('https://example.com/' + 'a'.repeat(30) + '/' + 'b'.repeat(60) + '?q=%E2%9C%93&x=1'));
    await idle(win); await sleep(800);
    log('long url label', JSON.stringify(await win.evaluate(() => ({ text: labelEl.innerText, w: labelEl.getBoundingClientRect().width, sw: labelEl.scrollWidth }))));
    await win.evaluate(() => setTheme('dark'));
    // timers / background cost: count capturePage calls per second at idle
    const cnt = await app.evaluate(async ({ ipcMain }) => { let n = 0; const f = () => n++; ipcMain.on('__never', f); const orig = ipcMain._invokeHandlers?.get?.('sample'); return typeof orig; });
    log('LOGS', JSON.stringify(logs));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
