// Address on the bar: stays visible near the cursor, click places the caret, drag selects, typing edits,
// Enter opens, Esc restores. Ctrl+L selects the whole address. Clear mode: hover does not change the shade.
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
(async () => {
  const cwd = path.join(__dirname, '..');
  const profile = path.join(__dirname, '.profile-v12');
  const shots = path.join(__dirname, 'shots-v12');
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(shots, { recursive: true });
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  const shot = async (f) => { const b = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(shots, f), Buffer.from(b, 'base64')); };
  const st = () => win.evaluate(() => ({
    labelOpacity: getComputedStyle(labelEl).opacity, editing: !!S.editing, focused: document.activeElement === addrIn,
    value: addrIn.value, sel: [addrIn.selectionStart, addrIn.selectionEnd], url: tab().url
  }));

  await win.evaluate(() => createTab('https://en.wikipedia.org/wiki/Norway_spruce'));
  await win.waitForTimeout(6000);
  await win.evaluate(() => { S.debugHover = true; render(); });
  await win.waitForTimeout(900);
  console.log('shown, cursor away ', JSON.stringify(await st()));
  const box = await win.evaluate(() => { const r = labelEl.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await win.mouse.move(box.x - 20, box.y + box.h / 2); await win.waitForTimeout(900);
  console.log('cursor near address', JSON.stringify(await st()));
  // text alignment: label text vs field text start
  console.log('alignment (label left / field left):', await win.evaluate(() => [Math.round(labelEl.getBoundingClientRect().left), Math.round(addrIn.getBoundingClientRect().left)]));
  await shot('1-near.png');

  // drag to select part of the address
  await win.mouse.move(box.x + 4, box.y + box.h / 2);
  await win.mouse.down(); await win.mouse.move(box.x + 100, box.y + box.h / 2, { steps: 6 }); await win.mouse.up();
  await win.waitForTimeout(300);
  console.log('drag select        ', JSON.stringify(await st()), 'selected:', JSON.stringify(await win.evaluate(() => addrIn.value.slice(addrIn.selectionStart, addrIn.selectionEnd))));
  await shot('2-selected.png');

  // click at the end and append something, Enter opens it
  await win.keyboard.press('End');
  await win.keyboard.type('#Description');
  console.log('typed              ', JSON.stringify(await st()));
  await win.keyboard.press('Enter'); await win.waitForTimeout(2500);
  console.log('after Enter        ', JSON.stringify(await st()));

  // Esc restores the address
  await win.evaluate(() => editAddress()); await win.waitForTimeout(200);
  console.log('Ctrl+L (all sel.)  ', JSON.stringify(await st()));
  await win.keyboard.type('garbage'); await win.keyboard.press('Escape'); await win.waitForTimeout(200);
  console.log('after Esc          ', JSON.stringify(await st()));

  // Clear mode: hover keeps the shade the same
  await win.evaluate(() => { S.debugHover = false; render(); setBarMode('clear'); });
  await win.evaluate(() => tab().wv.executeJavaScript('scrollTo(0,500)')); await win.waitForTimeout(1200);
  const look = () => win.evaluate(() => ({ docked: tab().wv.classList.contains('docked'), scrim: getComputedStyle(scrimEl).opacity, blur: getComputedStyle(scrimEl).backdropFilter, halo: getComputedStyle(bar).getPropertyValue('--halo').trim().slice(0, 30) }));
  const rest = await look();
  await win.evaluate(() => { S.debugHover = true; render(); }); await win.waitForTimeout(1200);
  const hov = await look();
  console.log('clear rest  ', JSON.stringify(rest));
  console.log('clear hover ', JSON.stringify(hov));
  await shot('3-clear-hover.png');
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
