const { launch, inPage, waitFor, sleep } = require('./lib');
(async () => {
  for (let i = 0; i < 4; i++) {
    const { app, win } = await launch('t1');
    try {
      await waitFor(() => win.evaluate(() => tab().ready));
      await sleep(800);
      const r = await inPage(win, `document.activeElement.tagName + '#' + document.activeElement.id`);
      const f = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFocused());
      await win.keyboard.type('xyz'); await sleep(200);
      console.log('run', i, 'active', r, 'osFocused', f, 'value', await inPage(win, 'nin.value'));
    } finally { await app.close(); }
  }
})();
