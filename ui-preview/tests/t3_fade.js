const { launch, shot, waitFor, sleep } = require('./lib');
(async () => {
  const { app, win } = await launch('t3');
  try {
    await win.evaluate(() => { createTab('https://example.com', false); createTab('https://example.com', false); });
    await sleep(3000);
    // 1) through render() as the app does
    const viaRender = await win.evaluate(async () => {
      const out = [];
      S.debugHover = true; render();
      const t0 = performance.now();
      for (const ms of [30, 150, 300, 600]) {
        await new Promise((r) => setTimeout(r, ms - (performance.now() - t0)));
        const tabs = [...document.querySelectorAll('.tab, .newtab')].map((e) => (+getComputedStyle(e).opacity).toFixed(2));
        out.push(ms + 'ms tabs=' + tabs.join('/') + ' label=' + (+getComputedStyle(labelEl).opacity).toFixed(2) + ' track=' + (+getComputedStyle(trackPath).opacity).toFixed(2));
      }
      S.debugHover = false; render();
      await new Promise((r) => setTimeout(r, 30));
      out.push('hide +30ms tabs=' + [...document.querySelectorAll('.tab')].map((e) => (+getComputedStyle(e).opacity).toFixed(2)).join('/'));
      return out;
    });
    console.log('via render():\n ' + viaRender.join('\n '));
    await sleep(1500);
    // 2) control: toggle only the class, keep tab DOM
    const viaClass = await win.evaluate(async () => {
      const out = [];
      bar.classList.add('show');
      const t0 = performance.now();
      for (const ms of [30, 150, 300, 600]) {
        await new Promise((r) => setTimeout(r, ms - (performance.now() - t0)));
        out.push(ms + 'ms tabs=' + [...document.querySelectorAll('.tab, .newtab')].map((e) => (+getComputedStyle(e).opacity).toFixed(2)).join('/'));
      }
      bar.classList.remove('show');
      return out;
    });
    console.log('class only (control):\n ' + viaClass.join('\n '));
    // 3) are tabs re-created while shown on any load event? count DOM replacements during a reload
    const churn = await win.evaluate(async () => {
      S.debugHover = true; render();
      let n = 0; const mo = new MutationObserver((m) => { n += m.length; }); mo.observe(tabsEl, { childList: true });
      tab().wv.reload();
      await new Promise((r) => setTimeout(r, 2500));
      mo.disconnect(); return n;
    });
    console.log('tabsEl childList mutations during one reload:', churn);
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
