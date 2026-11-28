const { launch, shot, inPage, waitFor, sleep } = require('./lib');
const WIKI = 'https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity';
const state = (win) => win.evaluate(() => ({
  url: tab().url, label: labelEl.innerText, onLight: bar.classList.contains('on-light'), show: bar.classList.contains('show'),
  veil: veil.classList.contains('on'), pageLight: S.pageLight,
  back: !bar.querySelector('[data-act=back]').classList.contains('off'), fwd: !bar.querySelector('[data-act=forward]').classList.contains('off'),
}));
async function nav(win, url) {
  await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), url);
  await waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 20000);
  await sleep(1500);
}
(async () => {
  const { app, win, logs } = await launch('t2');
  try {
    await nav(win, WIKI);
    console.log('wiki rest', JSON.stringify(await state(win)));
    await shot(app, 't2_wiki_rest');
    // what is under the bar at the Wikipedia header (page coordinates)
    console.log('wiki header elems', JSON.stringify(await inPage(win, `[[60,25],[300,25],[700,25],[1000,25],[1250,25],[1330,25],[700,60]].map(([x,y])=>{const e=document.elementFromPoint(x,y);return [x,y,e&&(e.tagName+'.'+String(e.className).slice(0,40)+' '+(e.getAttribute('aria-label')||e.title||e.innerText||'').slice(0,30))]})`)));
    // simulated hover
    await win.evaluate(() => { S.debugHover = true; render(); });
    await sleep(300);
    const early = await win.evaluate(() => {
      const p = trackPath; const cs = getComputedStyle(p);
      return { dash: cs.strokeDashoffset, op: cs.opacity, tabOp: getComputedStyle(document.querySelector('.tab')).opacity };
    });
    console.log('hover t=0.3s', JSON.stringify(early));
    await sleep(3200);
    const hov = await win.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
      const a = document.querySelector('.tab.active');
      return {
        d: trackPath.getAttribute('d'), len: Math.round(trackPath.getTotalLength()), barW: bar.clientWidth, winW: innerWidth,
        dash: getComputedStyle(trackPath).strokeDashoffset, op: getComputedStyle(trackPath).opacity,
        active: r(a), reload: r(bar.querySelector('[data-act=reload]')), tabsEl: r(tabsEl), right: r(document.getElementById('right')),
        veilOp: getComputedStyle(veil).opacity, veilBg: getComputedStyle(veil).backgroundColor, mask: getComputedStyle(veil).webkitMaskImage,
        labelOp: getComputedStyle(labelEl).opacity, onLight: bar.classList.contains('on-light'),
        under: [[300, 20], [700, 20], [1180, 20]].map(([x, y]) => { const e = document.elementFromPoint(x, y); return [x, y, e.tagName + '#' + e.id + '.' + e.className.baseVal === undefined ? e.className : e.tagName + '.' + (e.className.baseVal ?? e.className)]; }),
      };
    });
    console.log('hover', JSON.stringify(hov, null, 1));
    await shot(app, 't2_wiki_hover');
    // drag regions: which areas are drag vs no-drag
    const drag = await win.evaluate(() => {
      const out = [];
      for (const el of bar.querySelectorAll('*')) {
        const cs = getComputedStyle(el); const ar = cs.webkitAppRegion || cs.getPropertyValue('-webkit-app-region');
        if (ar === 'no-drag' && !el.parentElement.closest('.btn,.tab,.sbox,.tabs')) { const b = el.getBoundingClientRect(); if (b.width) out.push([el.id || el.className, Math.round(b.left), Math.round(b.right), Math.round(b.top), Math.round(b.bottom)]); }
      }
      return { bar: getComputedStyle(bar).webkitAppRegion, noDrag: out };
    });
    console.log('drag', JSON.stringify(drag));
    // veil column profile from captured image: sample pixel alpha via capturePage
    const prof = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      const img = await w.webContents.capturePage({ x: 600, y: 0, width: 1, height: 90 });
      const s = img.getSize(); const buf = img.toBitmap(); const sf = s.height / 90; const out = [];
      for (let y = 30; y < 80; y += 2) { const i = Math.floor(y * sf) * s.width * 4; out.push(y + ':' + buf[i + 2] + ',' + buf[i + 1] + ',' + buf[i]); }
      return out.join(' ');
    });
    console.log('veil profile x=600 (y:r,g,b)', prof);
    // open second tab, compare track
    await win.evaluate(() => createTab('https://example.com'));
    await waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 20000);
    await sleep(2500);
    const t2 = await win.evaluate(() => { const a = document.querySelector('.tab.active'); return { d: trackPath.getAttribute('d'), L: a.offsetLeft, R: a.offsetLeft + a.offsetWidth }; });
    console.log('second tab track', JSON.stringify(t2));
    await shot(app, 't2_two_tabs_hover');
    await win.evaluate(() => activateTab(S.tabs[0].id));
    await sleep(800);
    console.log('after switching back', await win.evaluate(() => trackPath.getAttribute('d')));
    await win.evaluate(() => activateTab(S.tabs[1].id));
    // un-hover: example.com is a light page
    await win.evaluate(() => { S.debugHover = false; render(); });
    await sleep(2000);
    console.log('example rest', JSON.stringify(await state(win)));
    await shot(app, 't2_example_rest');
    // dark page
    await win.evaluate(() => tab().wv.loadURL('data:text/html,<body style="background:%23111;color:%23eee"><h1>Dark</h1></body>').catch(() => {}));
    await sleep(2500);
    console.log('dark rest', JSON.stringify(await state(win)));
    await shot(app, 't2_dark_rest');
    console.log('LOGS', JSON.stringify(logs));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
