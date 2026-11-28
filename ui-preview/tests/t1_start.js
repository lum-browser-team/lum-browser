const { launch, shot, inPage, waitFor, sleep } = require('./lib');
(async () => {
  const { app, win, logs } = await launch('t1');
  try {
    console.log('userData', await app.evaluate(({ app }) => app.getPath('userData')));
    const r = await win.evaluate(async () => {
      await document.fonts.ready;
      const l = document.getElementById('label');
      return {
        label: l.textContent, cls: l.className, ff: getComputedStyle(l).fontFamily,
        check: document.fonts.check('32px Sacramento'),
        fonts: [...document.fonts].map((f) => f.family + ':' + f.status),
        activeEl: document.activeElement && document.activeElement.tagName,
        tabs: S.tabs.length, url: tab().url,
      };
    });
    console.log('host', JSON.stringify(r));
    await waitFor(() => win.evaluate(() => tab().ready));
    await sleep(800);
    const pg = await inPage(win, `({active: document.activeElement && document.activeElement.id, hasFocus: document.hasFocus(), theme: document.documentElement.className})`);
    console.log('page focus', JSON.stringify(pg));
    await shot(app, 't1_start');
    // type via real input events into the focused webview
    const wvFocused = await win.evaluate(() => document.activeElement && document.activeElement.tagName);
    console.log('host activeElement after load', wvFocused);
    await app.evaluate(({ webContents }) => {
      const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview');
      g.focus();
      for (const ch of 'swierk') g.sendInputEvent({ type: 'char', keyCode: ch });
    });
    await sleep(700);
    console.log('after typing', JSON.stringify(await inPage(win, `({v: nin.value, cls: note.className, actOpacity: getComputedStyle(document.querySelector('.act')).opacity, iSearch: getComputedStyle(document.querySelector('.i-search')).display, iLink: getComputedStyle(document.querySelector('.i-link')).display, hint: document.querySelector('.hint').innerText, hintOp: getComputedStyle(document.querySelector('.hint')).opacity})`)));
    await shot(app, 't1_typing_search');
    await inPage(win, `nin.value='example.com'; nin.dispatchEvent(new Event('input'));`);
    await sleep(600);
    console.log('link', JSON.stringify(await inPage(win, `({cls: note.className, iSearch: getComputedStyle(document.querySelector('.i-search')).display, iLink: getComputedStyle(document.querySelector('.i-link')).display, hint: document.querySelector('.hint').innerText})`)));
    await shot(app, 't1_typing_link');
    // Enter navigates
    await app.evaluate(({ webContents }) => {
      const g = webContents.getAllWebContents().find((w) => w.getType() === 'webview');
      g.sendInputEvent({ type: 'keyDown', keyCode: 'Return' }); g.sendInputEvent({ type: 'char', keyCode: '\r' }); g.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    });
    await waitFor(() => win.evaluate(() => /example\.com/.test(tab().url) && !tab().loading));
    await sleep(1500);
    console.log('after enter', JSON.stringify(await win.evaluate(() => ({ url: tab().url, label: document.getElementById('label').innerText, title: tab().title, onLight: bar.classList.contains('on-light'), back: !document.querySelector('[data-act=back]').classList.contains('off') }))));
    await shot(app, 't1_example');
    // search phrase from note
    await win.evaluate(() => openNewTab());
    await waitFor(() => win.evaluate(() => tab().ready));
    await sleep(500);
    await inPage(win, `nin.value='świerk pospolity'; nin.dispatchEvent(new Event('input')); nin.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));`);
    await waitFor(() => win.evaluate(() => /duckduckgo/.test(tab().url)));
    console.log('search url', await win.evaluate(() => tab().url), await win.evaluate(() => document.getElementById('label').innerText));
    console.log('toUrl checks', JSON.stringify(await win.evaluate(() => ['localhost:3000', '192.168.1.1', 'http://localhost:3000', 'example.com/a b', 'pl.wikipedia.org/wiki/Świerk', 'file:///C:/Windows/win.ini', 'about:blank', 'ab.c'].map((s) => [s, toUrl(s)]))));
    console.log('LOGS', JSON.stringify(logs, null, 1));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
