const { launch, sleep, zone } = require('./lib');
(async () => {
  const { app, win } = await launch('v2z');
  try {
    // record every zone message the renderer receives via a second listener is impossible (bridge); poll S.near instead
    for (let r = 0; r < 3; r++) {
      const seq = [];
      for (const z of ['far', 'near', 'edge', 'near', 'far', 'near', 'edge', 'out']) { await zone(app, z); await sleep(150); seq.push(z + '=' + (await win.evaluate(() => S.near) ? 'SHOW' : 'hide')); }
      console.log('run', r, seq.join(' '));
    }
    console.log('real cursor', JSON.stringify(await app.evaluate(({ screen, BrowserWindow }) => { const p = screen.getCursorScreenPoint(), b = BrowserWindow.getAllWindows()[0].getContentBounds(); return { x: p.x - b.x, y: p.y - b.y, w: b.width, h: b.height }; })));
  } finally { await app.close(); }
})();
