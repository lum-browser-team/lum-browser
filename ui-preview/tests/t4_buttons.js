const { launch, shot, inPage, waitFor, sleep, key } = require('./lib');
const WIKI = 'https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity';
const st = (win) => win.evaluate(() => ({
  n: S.tabs.length, active: S.tabs.findIndex((t) => t.id === S.active), url: tab().url.replace(/^file:.*\//, ''), search: S.search, settings: S.settings,
  back: !bar.querySelector('[data-act=back]').classList.contains('off'), fwd: !bar.querySelector('[data-act=forward]').classList.contains('off'),
}));
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 20000);
const click = async (win, sel) => { const b = await win.locator(sel).first().boundingBox(); await win.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
(async () => {
  const { app, win, logs } = await launch('t4');
  const log = (...a) => console.log(...a);
  try {
    await win.evaluate(() => { S.debugHover = true; render(); });
    // ---- navigation buttons
    await win.evaluate((u) => tab().wv.loadURL(u), 'https://example.com'); await idle(win); await sleep(500);
    await win.evaluate((u) => tab().wv.loadURL(u), WIKI); await idle(win); await sleep(800);
    log('after 2 navs', JSON.stringify(await st(win)));
    await click(win, '[data-act=back]'); await idle(win); await sleep(800);
    log('after back click', JSON.stringify(await st(win)));
    await click(win, '[data-act=forward]'); await idle(win); await sleep(800);
    log('after fwd click', JSON.stringify(await st(win)));
    await inPage(win, 'window.__marker = 1');
    await click(win, '[data-act=reload]'); await sleep(300); await idle(win); await sleep(500);
    log('reload cleared marker?', await inPage(win, 'window.__marker === undefined'));
    await click(win, '[data-act=back]'); await idle(win); await click(win, '[data-act=back]'); await idle(win); await sleep(800);
    log('back to start page', JSON.stringify(await st(win)));

    // ---- search mode from start tab
    await click(win, '[data-act=search]'); await sleep(400);
    log('search open', JSON.stringify(await st(win)), 'focus', await win.evaluate(() => document.activeElement.id));
    await shot(app, 't4_search_open');
    await win.keyboard.type('example.com'); await win.keyboard.press('Enter'); await idle(win); await sleep(600);
    log('after Enter in #q', JSON.stringify(await st(win)));
    // search from non-start page -> new tab
    await click(win, '[data-act=search]'); await sleep(1500);
    log('search from page (expect new tab, search still open after 1.5s)', JSON.stringify(await st(win)), 'focus', await win.evaluate(() => document.activeElement.id));
    await win.keyboard.press('Escape'); await sleep(300);
    log('after Escape', JSON.stringify(await st(win)));
    await click(win, '[data-act=search]'); await sleep(400);
    await win.keyboard.type('swierk pospolity'); await click(win, '[data-act=submit]'); await sleep(1500);
    log('after magnifier-in-field submit', JSON.stringify(await st(win)));
    // empty submit
    await click(win, '[data-act=search]'); await sleep(1500); await click(win, '[data-act=submit]'); await sleep(300);
    log('empty submit (search stays open?)', JSON.stringify(await st(win)));
    await win.keyboard.press('Escape'); await sleep(300);

    // ---- settings + theme
    await click(win, '[data-act=settings]'); await sleep(600);
    const pos = await win.evaluate(() => { const p = panel.getBoundingClientRect(), b = bar.querySelector('[data-act=settings]').getBoundingClientRect(); return { panel: [p.left, p.top, p.right, p.bottom].map(Math.round), btn: [b.left, b.top, b.right, b.bottom].map(Math.round), op: getComputedStyle(panel).opacity }; });
    log('settings open', JSON.stringify(await st(win)), JSON.stringify(pos));
    await shot(app, 't4_settings_dark');
    const before = await win.evaluate(() => S.tabs.map((t) => t.url.replace(/^file:.*\//, '')));
    await click(win, '[data-theme=light]'); await sleep(1500);
    log('theme light', await win.evaluate(() => [theme, localStorage.getItem('lum-theme'), document.body.className]), 'tabs', JSON.stringify(before), '->', JSON.stringify(await win.evaluate(() => S.tabs.map((t) => t.url.replace(/^file:.*\//, '')))));
    await shot(app, 't4_settings_light');
    await click(win, '[data-act=settings]'); await sleep(500);
    log('settings toggled closed', JSON.stringify(await st(win)));
    // start page in light theme + back button state on the fresh start page
    await win.evaluate(() => openNewTab()); await idle(win); await sleep(800);
    log('new tab in light theme', await inPage(win, 'document.documentElement.className'), JSON.stringify(await st(win)));
    await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(1500);
    await shot(app, 't4_light_start_rest');
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(3000);
    await shot(app, 't4_light_start_hover');
    // theme switch adds a history entry on start pages?
    await click(win, '[data-act=settings]'); await sleep(300); await click(win, '[data-theme=dark]'); await sleep(1500); await click(win, '[data-act=settings]'); await sleep(300);
    log('after theme switch on start tab', JSON.stringify(await st(win)), 'canGoBack', await win.evaluate(() => tab().wv.canGoBack()));
    // back in history to a start page created in the other theme
    await win.evaluate((u) => tab().wv.loadURL(u), 'https://example.com'); await idle(win); await sleep(500);
    await win.evaluate(() => setTheme('light')); await sleep(500);
    await win.evaluate(() => tab().wv.goBack()); await idle(win); await sleep(800);
    log('back to start page after theme change: theme=', await win.evaluate(() => theme), 'start page class=', JSON.stringify(await inPage(win, 'document.documentElement.className')), 'url', (await st(win)).url);
    await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(1500);
    await shot(app, 't4_stale_theme_start_page');
    await win.evaluate(() => { S.debugHover = true; render(); });
    await win.evaluate(() => setTheme('dark'));
    // persist after restart checked in t5
    log('LOGS', JSON.stringify(logs));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
