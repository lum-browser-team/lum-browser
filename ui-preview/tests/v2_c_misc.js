// v2: theme, failed load, search caret, popups, sampling cost, shortcuts, arcs
const { launch, shot2, inPage, waitFor, sleep, key } = require('./lib');
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 25000);
const click = async (win, sel, opts) => { const b = await win.locator(sel).first().boundingBox(); await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2, opts); };
(async () => {
  const log = (...a) => console.log(...a);
  let { app, win, logs } = await launch('v2c');
  try {
    await waitFor(() => win.evaluate(() => tab().ready)); await sleep(800);
    // ---- theme on start tab
    await win.evaluate(() => { S.debugHover = true; render(); });
    await click(win, '[data-act=settings]'); await sleep(400);
    await click(win, '[data-theme=light]'); await sleep(800);
    await click(win, '[data-act=settings]'); await sleep(400);
    log('G theme light on start tab: canGoBack', await win.evaluate(() => tab().wv.canGoBack()), 'back btn off', await win.evaluate(() => bar.querySelector('[data-act=back]').classList.contains('off')), 'page class', await inPage(win, 'document.documentElement.className'), 'url', await win.evaluate(() => tab().url.split('?')[1]));
    await shot2(app, 'g_light_start_shown');
    await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), 'https://example.com'); await idle(win); await sleep(500);
    await win.evaluate(() => setTheme('dark')); await sleep(300);
    await win.evaluate(() => tab().wv.goBack()); await idle(win); await sleep(1000);
    log('G back to start after theme->dark: page class', JSON.stringify(await inPage(win, 'document.documentElement.className')), 'bg', await inPage(win, 'getComputedStyle(document.body).backgroundColor'), 'tab.color', await win.evaluate(() => tab().color));
    await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(1200);
    await shot2(app, 'g_back_to_start_current_theme');
    // forward then back again, with theme switched to light while away (bfcache path)
    await win.evaluate(() => tab().wv.goForward()); await idle(win); await sleep(500);
    await win.evaluate(() => setTheme('light')); await sleep(300);
    await win.evaluate(() => tab().wv.goBack()); await idle(win); await sleep(1000);
    log('G 2nd back after theme->light: page class', JSON.stringify(await inPage(win, 'document.documentElement.className')), 'bar on-light', await win.evaluate(() => bar.classList.contains('on-light')));
    await win.evaluate(() => setTheme('dark')); await sleep(300);
    // ---- failed load via bar search
    await win.evaluate(() => { openSearch(); }); await sleep(300);
    await win.keyboard.type('nonexistent-lum-test.invalid'); await win.keyboard.press('Enter'); await sleep(4000);
    const errState = () => win.evaluate(() => ({ errHidden: errBox.hidden, url: errUrl.textContent, desc: errDesc.textContent, label: labelEl.innerText, title: tab().title, tUrl: tab().url, back: !bar.querySelector('[data-act=back]').classList.contains('off') }));
    log('H failed load', JSON.stringify(await errState()));
    await shot2(app, 'h_failed_load');
    let fails = 0; await win.evaluate(() => { window.__fails = 0; tab().wv.addEventListener('did-fail-load', (e) => { if (e.isMainFrame) window.__fails++; }); });
    await click(win, '[data-act=retry]'); await sleep(3500);
    log('H retry button: new did-fail-load count', await win.evaluate(() => window.__fails), JSON.stringify(await errState()));
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(200);
    await click(win, '[data-act=reload]'); await sleep(3500);
    log('H reload button: fail count', await win.evaluate(() => window.__fails));
    await key(app, 'F5'); await sleep(3500);
    log('H F5: fail count', await win.evaluate(() => window.__fails));
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(2500);
    await shot2(app, 'h_failed_load_shown');
    // switch tabs with error
    await win.evaluate(() => createTab('https://example.com')); await idle(win); await sleep(500);
    log('H other tab: err hidden', await win.evaluate(() => errBox.hidden));
    await win.evaluate(() => activateTab(S.tabs[0].id)); await sleep(300);
    log('H back to error tab: err hidden', await win.evaluate(() => errBox.hidden));
    await click(win, '[data-act=back]'); await idle(win); await sleep(1000);
    log('H back button from error', JSON.stringify(await errState()));
    // failed load typed into start note
    await win.evaluate(() => openNewTab()); await idle(win); await sleep(600);
    await win.keyboard.type('nonexistent-lum-test2.invalid'); await win.keyboard.press('Enter'); await sleep(4000);
    log('H failed load from note', JSON.stringify(await errState()));
    // ---- search caret
    await win.evaluate(() => openNewTab()); await idle(win); await sleep(600);
    await click(win, '[data-act=search]'); await sleep(500);
    log('I search on start tab: guest active', await inPage(win, 'document.activeElement.tagName+"#"+document.activeElement.id'), 'host active', await win.evaluate(() => document.activeElement.id));
    await shot2(app, 'i_search_start_single_caret');
    await win.keyboard.press('Escape');
    await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), 'https://example.com'); await idle(win); await sleep(500);
    await click(win, '[data-act=search]'); await sleep(2000);
    log('I search from page (new start tab): S.search', await win.evaluate(() => S.search), 'host active', await win.evaluate(() => document.activeElement.id), 'guest active', await inPage(win, 'document.activeElement.tagName+"#"+document.activeElement.id'), 'guest hasFocus', await inPage(win, 'document.hasFocus()'));
    await win.keyboard.type('abc'); await sleep(200);
    log('I typed abc -> #q', await win.evaluate(() => input.value), '#nin', await inPage(win, 'nin.value'));
    await shot2(app, 'i_search_from_page_two_carets');
    await win.keyboard.press('Escape');
    // ---- popups
    await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), 'data:text/html,<a href="https://example.org/" target="_blank" style="position:absolute;top:300px;left:300px;font-size:40px">NEW TAB LINK</a>'); await sleep(1500);
    await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(300);
    const n0 = await win.evaluate(() => S.tabs.length);
    await win.mouse.click(400, 322); await sleep(2500);
    log('J target=_blank real click:', n0, '->', await win.evaluate(() => S.tabs.length), await win.evaluate(() => tab().url));
    await inPage(win, `window.open('https://example.net/','_blank','width=400,height=300')`, true); await sleep(2000);
    log('J window.open:', '->', await win.evaluate(() => S.tabs.length), await win.evaluate(() => tab().url), 'windows', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length));
    await inPage(win, `window.open('https://example.com/?nogesture')`, false); await sleep(1500);
    log('J window.open without gesture ->', await win.evaluate(() => S.tabs.length));
    // ---- shortcuts
    const sc = [];
    await key(app, 't', ['control']); await sleep(600); sc.push('Ctrl+T n=' + await win.evaluate(() => S.tabs.length));
    await key(app, 'Tab', ['control']); await sleep(300); sc.push('Ctrl+Tab ' + await win.evaluate(() => S.tabs.findIndex((t) => t.id === S.active)));
    await key(app, 'Tab', ['control', 'shift']); await sleep(300); sc.push('Ctrl+Shift+Tab ' + await win.evaluate(() => S.tabs.findIndex((t) => t.id === S.active)));
    await key(app, 'w', ['control']); await sleep(400); sc.push('Ctrl+W n=' + await win.evaluate(() => S.tabs.length));
    await key(app, 'l', ['control']); await sleep(400); sc.push('Ctrl+L search=' + await win.evaluate(() => S.search)); await win.keyboard.press('Escape');
    log('shortcuts', sc.join(' | '));
    log('LOGS A', JSON.stringify(logs.main), JSON.stringify(logs.renderer.filter((l) => !/allowpopups/.test(l))));
  } finally { await app.close(); }
  // ---- theme persistence + sampling cost
  ({ app, win, logs } = await launch('v2c'));
  try {
    log('G after restart theme', await win.evaluate(() => theme));
    await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), 'https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity'); await idle(win); await sleep(2000);
    await app.evaluate(({ webContents }) => {
      const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview');
      const proto = Object.getPrototypeOf(g); if (!proto.__origCap) { proto.__origCap = proto.capturePage; global.__cap = 0; proto.capturePage = function (...a) { if (this.getType() === 'webview') global.__cap++; return proto.__origCap.apply(this, a); }; }
      global.__cap = 0; global.__zoneMsgs = 0;
    });
    const focusedState = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocused());
    const hf = await win.evaluate(() => document.hasFocus());
    await sleep(10000);
    log('L idle 10s (OS focused=' + focusedState + ', host hasFocus=' + hf + '): capturePage calls =', await app.evaluate(() => global.__cap));
    await app.evaluate(() => { global.__cap = 0; });
    for (let i = 1; i <= 5; i++) { await inPage(win, `window.scrollTo(0, ${i * 400})`); await sleep(400); }
    await sleep(800);
    log('L 5 scrolls: capturePage calls =', await app.evaluate(() => global.__cap));
    await app.evaluate(() => { global.__cap = 0; });
    await inPage(win, 'window.scrollTo(0, 0)'); await sleep(1000);
    log('L scroll to top: calls', await app.evaluate(() => global.__cap), 'window.__lumHook visible to page:', await inPage(win, 'typeof window.__lumHook'));
    // arcs
    const W = () => app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return { min: w.isMinimized(), max: w.isMaximized() }; });
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(500);
    await click(win, '[data-act=max]'); await sleep(800); log('arcs max', JSON.stringify(await W()));
    await click(win, '[data-act=max]'); await sleep(800); log('arcs unmax', JSON.stringify(await W()));
    await click(win, '[data-act=min]'); await sleep(800); log('arcs min', JSON.stringify(await W()));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore()); await sleep(800);
    await win.evaluate(() => setTheme('dark'));
    log('LOGS B', JSON.stringify(logs.main), JSON.stringify(logs.renderer.filter((l) => !/allowpopups/.test(l))));
    const closed = new Promise((r) => app.on('close', () => r('exited')));
    await click(win, '[data-act=close]').catch(() => {});
    log('arcs close ->', await Promise.race([closed, sleep(5000).then(() => 'still running')]));
  } finally { try { await app.close(); } catch {} }
})().catch((e) => { console.error(e); process.exit(1); });
