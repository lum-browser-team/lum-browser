const { launch, shot, waitFor, sleep } = require('./lib');
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 20000);
(async () => {
  const { app, win, logs } = await launch('t7');
  try {
    await win.evaluate(() => tab().wv.loadURL('https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity')); await idle(win); await sleep(1500);
    console.log('wiki favicon', await win.evaluate(() => tab().favicon));
    await win.evaluate(() => tab().wv.loadURL('https://example.com/')); await idle(win); await sleep(2500);
    console.log('example.com: title', await win.evaluate(() => tab().title), '| favicon', await win.evaluate(() => tab().favicon));
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(3000);
    await shot(app, 't7_stale_favicon');
    await win.evaluate(() => tab().wv.loadURL('https://nonexistent.invalid/').catch(() => {})); await sleep(4000); await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(1200); await shot(app, 't7_failed_load');
    console.log('failed load: title', await win.evaluate(() => tab().title), '| label', await win.evaluate(() => labelEl.innerText), '| url', await win.evaluate(() => tab().url));
    console.log('LOGS', JSON.stringify(logs));
  } finally { await app.close(); }
})();
