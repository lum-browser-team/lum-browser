const { launch, shot2, inPage, sleep, waitFor } = require('./lib');
(async () => {
  const { app, win } = await launch('v2p');
  try {
    await win.evaluate(() => tab().wv.loadURL('https://example.com/').catch(() => {}));
    await waitFor(() => win.evaluate(() => tab().ready && !tab().loading)); await sleep(500);
    const n0 = await win.evaluate(() => S.tabs.length);
    // page script, no user gesture: opens 15 popups on load-like timer
    await inPage(win, `setTimeout(()=>{for(let i=0;i<15;i++) window.open('about:blank#'+i)}, 100)`, false);
    await sleep(3000);
    console.log('15x window.open without user gesture: tabs', n0, '->', await win.evaluate(() => S.tabs.length));
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(2500);
    await shot2(app, 'j_popup_flood_no_gesture');
  } finally { await app.close(); }
})();
