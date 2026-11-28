// v2: tabs strip, lost clicks, overflow/scroll, track clamp, drag area
const { launch, shot2, inPage, waitFor, sleep } = require('./lib');
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 25000);
const geo = (win) => win.evaluate(() => {
  const R = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
  const a = tabsEl.querySelector('.tab.active');
  const d = trackPath.getAttribute('d'); const m = d.match(/^M0 44H([\d.-]+)Q([\d.-]+) .*?H([\d.-]+)Q([\d.-]+) /);
  const pr = plusBtn.getBoundingClientRect();
  const hitPlus = document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2);
  return {
    n: S.tabs.length, dense: tabsEl.classList.contains('dense'), tabs: R(tabsEl), scroll: [Math.round(tabsEl.scrollLeft), tabsEl.scrollWidth, tabsEl.clientWidth],
    active: R(a), activeOffsetLeft: a.offsetLeft, trackLR: m ? [+m[2], +m[4]] : d.slice(0, 40), plus: R(plusBtn), plusHit: hitPlus && hitPlus.closest('#newtab') ? 'newtab' : (hitPlus && hitPlus.tagName),
    right: R(document.getElementById('right')), w: innerWidth,
  };
});
// draggable fraction of the bar row at y=24 and y=4 (drag = .bar.show minus .btn/.tab/.sbox rects, clipped by .tabs box for tabs)
const dragArea = (win) => win.evaluate(() => {
  const W = innerWidth; const nd = [];
  const tb = tabsEl.getBoundingClientRect();
  document.querySelectorAll('.bar .btn, .bar .tab, .bar .sbox').forEach((e) => {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const b = e.getBoundingClientRect(); if (!b.width) return; nd.push([b.left, b.right, b.top, b.bottom, e.classList.contains('tab')]);
  });
  const row = (y, clip) => { let free = 0; const segs = []; let start = null; for (let x = 0; x < W; x++) { const hit = nd.some(([l, r, t, b, isTab]) => x >= l && x < r && y >= t && y < b && (!clip || !isTab || (x >= tb.left && x < tb.right))); if (!hit) { free++; if (start === null) start = x; } else if (start !== null) { if (x - start > 15) segs.push([start, x]); start = null; } } if (start !== null && W - start > 15) segs.push([start, W]); return { free, segs }; };
  return { y24_unclipped: row(24, false), y24_clipped: row(24, true) };
});
(async () => {
  const log = (...a) => console.log(...a);
  const { app, win, logs } = await launch('v2b');
  try {
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(1200);
    log('drag 1 tab', JSON.stringify(await dragArea(win)));
    // rapid "+" clicks
    const b = await win.locator('#newtab').boundingBox();
    for (let i = 0; i < 26; i++) { await win.mouse.click(b.x + 18, b.y + 18); await sleep(60); }
    await sleep(1500);
    log('26 rapid + clicks: tabs', await win.evaluate(() => S.tabs.length), '(expected 27)');
    // lost click: down, re-render, up
    const n0 = await win.evaluate(() => S.tabs.length);
    const pb = await win.locator('#newtab').boundingBox();
    await win.mouse.move(pb.x + 18, pb.y + 18); await win.mouse.down(); await win.evaluate(() => renderTabs()); await win.mouse.up(); await sleep(400);
    log('+ with renderTabs between down/up:', n0, '->', await win.evaluate(() => S.tabs.length));
    await win.evaluate(() => { while (S.tabs.length > 2) closeTab(S.tabs.at(-1).id); });
    await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), 'https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity'); await idle(win); await sleep(600);
    let lost = 0;
    for (let i = 0; i < 12; i++) {
      await win.evaluate(() => S.tabs[1].wv.reload()); await sleep(30 + (i * 37) % 200);
      const target = i % 2; const tb = await win.locator('.tab').nth(target).boundingBox();
      await win.mouse.click(tb.x + 30, tb.y + 16, { delay: 90 }); await sleep(150);
      if (await win.evaluate(() => S.tabs.findIndex((t) => t.id === S.active)) !== target) lost++;
    }
    log('tab clicks during loading lost:', lost, 'of 12');
    // 32 tabs @1400
    await win.evaluate(() => { while (S.tabs.length < 32) openNewTab(); }); await sleep(2500);
    log('32 tabs @1400 (last active)', JSON.stringify(await geo(win)));
    await shot2(app, 'b_32_tabs_1400');
    log('drag 32 tabs', JSON.stringify(await dragArea(win)));
    // wheel scroll on tabs
    const tbx = await win.locator('#tabs').boundingBox();
    await win.mouse.move(tbx.x + 200, tbx.y + 24); await win.mouse.wheel(0, -600); await sleep(600);
    log('after wheel up (scrolled left)', JSON.stringify(await geo(win)));
    await shot2(app, 'b_32_tabs_scrolled_track');
    // click first visible tab -> becomes active & scrolled into view
    await win.evaluate(() => activateTab(S.tabs[0].id)); await sleep(700);
    log('activate first tab', JSON.stringify(await geo(win)));
    await win.evaluate(() => activateTab(S.tabs[31].id)); await sleep(700);
    log('activate last tab', JSON.stringify(await geo(win)));
    await win.evaluate(() => activateTab(S.tabs[15].id)); await sleep(700);
    log('activate middle tab', JSON.stringify(await geo(win)));
    await shot2(app, 'b_32_tabs_middle_active');
    // click "+" when overflowing
    const nB = await win.evaluate(() => S.tabs.length);
    const p2 = await win.locator('#newtab').boundingBox(); await win.mouse.click(p2.x + 18, p2.y + 18); await sleep(800);
    log('+ click at overflow:', nB, '->', await win.evaluate(() => S.tabs.length), JSON.stringify(await geo(win)));
    // 760px with 25 tabs
    await win.evaluate(() => { while (S.tabs.length > 25) closeTab(S.tabs.at(-1).id); });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 600)); await sleep(1500);
    log('25 tabs @760', JSON.stringify(await geo(win)));
    await shot2(app, 'b_25_tabs_760');
    await win.evaluate(() => activateTab(S.tabs[0].id)); await sleep(700);
    log('25 @760 first active', JSON.stringify(await geo(win)));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1400, 880)); await sleep(1000);
    // resize back: is active tab still in view, track consistent?
    log('back to 1400', JSON.stringify(await geo(win)));
    // close via x (dense) and middle click
    await win.evaluate(() => { while (S.tabs.length > 12) closeTab(S.tabs.at(-1).id); }); await sleep(800);
    const t2 = await win.locator('.tab').nth(2).boundingBox(); const n1 = await win.evaluate(() => S.tabs.length);
    await win.mouse.move(t2.x + t2.width / 2, t2.y + 16); await sleep(300); await win.mouse.click(t2.x + t2.width / 2, t2.y + 16); await sleep(400);
    const t3 = await win.locator('.tab').nth(3).boundingBox();
    await win.mouse.click(t3.x + t3.width / 2, t3.y + 16, { button: 'middle' }); await sleep(400);
    log('dense x click + middle click:', n1, '->', await win.evaluate(() => S.tabs.length));
    await win.evaluate(() => { while (S.tabs.length > 3) closeTab(S.tabs.at(-1).id); }); await sleep(800);
    const t1 = await win.locator('.tab').nth(1).boundingBox(); await win.mouse.move(t1.x + t1.width / 2, t1.y + 16); await sleep(400);
    const xb = await win.locator('.tab').nth(1).locator('.x').boundingBox(); await win.mouse.click(xb.x + 11, xb.y + 11); await sleep(400);
    log('normal x click: 3 ->', await win.evaluate(() => S.tabs.length), JSON.stringify(await geo(win)));
    // close all -> new tab
    await win.evaluate(() => { while (S.tabs.length > 1) closeTab(S.tabs[0].id); closeTab(S.active); }); await sleep(1200);
    log('closed last: n=', await win.evaluate(() => S.tabs.length), 'note focus', await inPage(win, 'document.activeElement.id'));
    log('LOGS', JSON.stringify(logs.main), JSON.stringify(logs.renderer.filter((l) => !/allowpopups/.test(l))));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
