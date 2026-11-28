const { launch, shot2, sleep } = require('./lib');
const path = require('path'), fs = require('fs');
(async () => {
  const { app, win } = await launch('v2b2');
  try {
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(1200);
    for (let i = 0; i < 26; i++) { const b = await win.locator('#newtab').boundingBox(); await win.mouse.click(b.x + 18, b.y + 18); await sleep(60); }
    await sleep(1500);
    console.log('26 rapid + clicks (re-measured each time): tabs', await win.evaluate(() => S.tabs.length), '(expected 27)');
    await win.evaluate(() => { while (S.tabs.length > 2) closeTab(S.tabs.at(-1).id); activateTab(S.tabs[0].id); }); await sleep(3500);
    console.log('2 tabs, first active', await win.evaluate(() => { const a = document.querySelector('.tab.active').getBoundingClientRect(); return JSON.stringify({ tab: [a.left, a.right], d: trackPath.getAttribute('d') }); }));
    // zoomed crop of the first tab area
    const b64 = await app.evaluate(async ({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; const img = await w.webContents.capturePage({ x: 120, y: 0, width: 260, height: 50 }); return img.resize({ width: 1040 }).toPNG().toString('base64'); });
    fs.writeFileSync(path.join(__dirname, 'shots2', 'b_track_cuts_first_tab_zoom.png'), Buffer.from(b64, 'base64'));
    await win.evaluate(() => { while (S.tabs.length < 32) openNewTab(); }); await sleep(3000);
    const b64b = await app.evaluate(async ({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; const img = await w.webContents.capturePage({ x: 1040, y: 0, width: 200, height: 50 }); return img.resize({ width: 800 }).toPNG().toString('base64'); });
    fs.writeFileSync(path.join(__dirname, 'shots2', 'b_track_cuts_last_tab_zoom.png'), Buffer.from(b64b, 'base64'));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 600)); await sleep(1500);
    await shot2(app, 'b_760_active_out_of_view');
  } finally { await app.close(); }
})();
