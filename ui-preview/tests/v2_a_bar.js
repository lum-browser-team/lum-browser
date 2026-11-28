// v2: start page, zones, hidden-bar clickability, veil color, fades, toUrl, labels
const { launch, shot2, inPage, waitFor, sleep, zone } = require('./lib');
const WIKI = 'https://pl.wikipedia.org/wiki/%C5%9Awierk_pospolity';
const idle = (win) => waitFor(() => win.evaluate(() => tab().ready && !tab().loading), 25000);
const tone = (win) => win.evaluate(() => ({ show: bar.classList.contains('show'), onLight: bar.classList.contains('on-light'), veilOn: veil.classList.contains('on'), veilBg: getComputedStyle(veil).backgroundColor, tColor: tab().color, tLight: tab().light, tColorLight: tab().colorLight, label: labelEl.innerText }));
(async () => {
  const log = (...a) => console.log(...a);
  const { app, win, logs } = await launch('v2a');
  try {
    await waitFor(() => win.evaluate(() => tab().ready)); await sleep(800);
    log('A start', JSON.stringify(await win.evaluate(async () => { await document.fonts.ready; return { label: labelEl.textContent, font: document.fonts.check('32px Sacramento') }; })), 'guest focus', await inPage(win, 'document.activeElement.id'));
    await win.keyboard.type('hello world'); await sleep(500);
    log('A typing', JSON.stringify(await inPage(win, `({v:nin.value, cls:note.className, hint:document.querySelector('.hint').innerText, op:getComputedStyle(document.querySelector('.hint')).opacity})`)));
    log('A isLink(start.js)', JSON.stringify(await inPage(win, `['localhost','localhost:3000','192.168.1.1','about:blank','file:///C:/x','node.js','example.com','hello world','999.999.1.1'].map(v=>[v,isLink(v)])`)));
    log('A toUrl(renderer)', JSON.stringify(await win.evaluate(() => ['localhost', 'localhost:3000/x', '192.168.1.1', 'about:blank', 'file:///C:/Windows/win.ini', 'javascript:alert(1)', 'chrome://gpu', 'node.js', 'index.html', 'example.com', 'świerk pospolity'].map((v) => [v, toUrl(v)]))));
    await shot2(app, 'a_start_typing');
    await win.keyboard.press('Control+a'); await win.keyboard.type('example.com'); await sleep(400);
    log('A link hint', await inPage(win, `document.querySelector('.hint').innerText + ' / ' + note.className`));
    await win.keyboard.press('Enter'); await idle(win); await sleep(1500);
    log('A Enter ->', await win.evaluate(() => tab().url));
    // ---- example.com rest + hover
    log('B example rest', JSON.stringify(await tone(win)));
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(3200);
    log('B example shown', JSON.stringify(await tone(win)));
    await shot2(app, 'b_example_shown');
    await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(1200);
    // ---- Wikipedia
    await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), WIKI); await idle(win); await sleep(1500);
    log('B wiki rest', JSON.stringify(await tone(win)));
    log('B wiki hidden: host elementFromPoint', JSON.stringify(await win.evaluate(() => [[60, 25], [450, 30], [700, 25], [1250, 25], [1330, 25]].map(([x, y]) => { const e = document.elementFromPoint(x, y); return [x, y, e.tagName + (e.id ? '#' + e.id : '') + (e.dataset && e.dataset.act ? '[' + e.dataset.act + ']' : '')]; }))));
    await shot2(app, 'b_wiki_rest');
    // real click into Wikipedia search box through the host (bar hidden)
    await win.mouse.click(450, 32); await sleep(400);
    log('B click wiki search box at (450,32): guest activeElement', await inPage(win, `document.activeElement.tagName+'.'+document.activeElement.className`));
    // zones
    const seq = [];
    for (const z of ['near', 'edge', 'near', 'far', 'near', 'edge', 'out', 'edge', 'near', 'out']) { await zone(app, z); await sleep(120); seq.push(z + '=' + (await win.evaluate(() => bar.classList.contains('show')) ? 'SHOW' : 'hide')); }
    log('B zones', seq.join(' '));
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(3200);
    log('B wiki shown', JSON.stringify(await tone(win)));
    await shot2(app, 'b_wiki_shown');
    // ---- fades
    await win.evaluate(() => { S.debugHover = false; render(); }); await sleep(1500);
    await win.evaluate(() => { createTab('https://example.com', false); createTab('https://example.com', false); });
    await sleep(2500);
    const fade = await win.evaluate(async () => {
      const out = []; const t0 = performance.now(); const op = (e) => (+getComputedStyle(e).opacity).toFixed(2);
      S.debugHover = true; render();
      for (const ms of [30, 150, 300, 600, 1000]) { await new Promise((r) => setTimeout(r, ms - (performance.now() - t0))); out.push(ms + 'ms tabs=' + [...document.querySelectorAll('.tab'), plusBtn].map(op).join('/') + ' label=' + op(labelEl) + ' track=' + op(trackPath)); }
      await new Promise((r) => setTimeout(r, 2500));
      S.debugHover = false; render(); const t1 = performance.now();
      for (const ms of [30, 150, 400]) { await new Promise((r) => setTimeout(r, ms - (performance.now() - t1))); out.push('hide ' + ms + 'ms tabs=' + [...document.querySelectorAll('.tab')].map(op).join('/') + ' label=' + op(labelEl)); }
      return out;
    });
    log('C fades\n  ' + fade.join('\n  '));
    // ---- dark start page shown
    await win.evaluate(() => openNewTab()); await idle(win); await sleep(1200);
    await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(3000);
    log('B dark start shown', JSON.stringify(await tone(win)));
    await shot2(app, 'b_start_dark_shown');
    // ---- colored sites
    for (const [name, u] of [['python', 'https://www.python.org/'], ['github', 'https://github.com/']]) {
      await win.evaluate(() => { S.debugHover = false; render(); });
      await win.evaluate((u) => tab().wv.loadURL(u).catch(() => {}), u); await idle(win); await sleep(2500);
      log('B ' + name + ' rest', JSON.stringify(await tone(win)));
      await shot2(app, 'b_' + name + '_rest');
      await win.evaluate(() => { S.debugHover = true; render(); }); await sleep(3000);
      log('B ' + name + ' shown', JSON.stringify(await tone(win)));
      await shot2(app, 'b_' + name + '_shown');
      // scroll down and check color re-sample
      await win.evaluate(() => { S.debugHover = false; render(); });
      await inPage(win, 'window.scrollTo(0, 1500)'); await sleep(1500);
      log('B ' + name + ' after scroll', JSON.stringify(await tone(win)));
    }
    await shot2(app, 'b_github_scrolled_rest');
    // labels for non-http
    await win.evaluate(() => tab().wv.loadURL('data:text/html,<body style="background:%23123">x</body>').catch(() => {})); await sleep(1500);
    log('M data label', await win.evaluate(() => labelEl.innerText), JSON.stringify(await tone(win)));
    await win.evaluate(() => submit('about:blank')); await sleep(1500);
    log('M about:blank via bar ->', await win.evaluate(() => tab().url), 'label', await win.evaluate(() => labelEl.innerText));
    log('LOGS', JSON.stringify(logs));
  } finally { await app.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
