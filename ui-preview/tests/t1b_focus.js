const { launch, shot, inPage, waitFor, sleep } = require('./lib');
(async () => {
  const { app, win, logs } = await launch('t1');
  try {
    console.log('win focused?', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocused()));
    for (const ms of [0, 500, 1500]) {
      await sleep(ms);
      console.log(ms, JSON.stringify(await inPage(win, `({a: document.activeElement.tagName + '#' + document.activeElement.id, hf: document.hasFocus(), vis: document.visibilityState})`)));
    }
    // Focus the OS window first, then open a new tab via the real flow
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    await sleep(300);
    console.log('win focused now?', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocused()));
    await win.evaluate(() => openNewTab());
    await waitFor(() => win.evaluate(() => tab().ready));
    for (const ms of [100, 800]) {
      await sleep(ms);
      console.log('newtab', ms, JSON.stringify(await inPage(win, `({a: document.activeElement.tagName + '#' + document.activeElement.id, hf: document.hasFocus()})`)), await win.evaluate(() => document.activeElement.tagName));
    }
    // type with real keyboard via host page (Playwright keyboard goes to focused frame)
    await win.keyboard.type('swierk');
    await sleep(600);
    console.log('typed via playwright keyboard', JSON.stringify(await inPage(win, `({v: nin.value, cls: note.className})`)));
    await app.evaluate(({ webContents }) => {
      const gs = webContents.getAllWebContents().filter((w) => w.getType() === 'webview');
      const g = gs[gs.length - 1];
      for (const ch of 'abc') { g.sendInputEvent({ type: 'keyDown', keyCode: ch }); g.sendInputEvent({ type: 'char', keyCode: ch }); g.sendInputEvent({ type: 'keyUp', keyCode: ch }); }
    });
    await sleep(500);
    console.log('typed via sendInputEvent', JSON.stringify(await inPage(win, `({v: nin.value, cls: note.className, a: document.activeElement.id})`)));
    await shot(app, 't1b_newtab_after_typing');
    // manually call focusNote
    await win.evaluate(() => focusNote(tab()));
    await sleep(300);
    console.log('after manual focusNote', JSON.stringify(await inPage(win, `({a: document.activeElement.id})`)));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
