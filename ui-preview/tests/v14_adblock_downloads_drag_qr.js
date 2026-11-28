// Ad blocking (uBlock Origin lists), downloads straight to Downloads (no dialog), dragging tabs to reorder,
// tab menu -> Show QR code.
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
(async () => {
  const cwd = path.join(__dirname, '..');
  const profile = path.join(__dirname, '.profile-v14');
  const shots = path.join(__dirname, 'shots-v14');
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'lum-dl-'));
  fs.mkdirSync(shots, { recursive: true });
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + profile], cwd, executablePath: require('electron') });
  await app.evaluate(({ app }, dl) => app.setPath('downloads', dl), dl);
  const win = await app.firstWindow();
  const shot = async (f) => { const b = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(shots, f), Buffer.from(b, 'base64')); };

  // 1) ad blocker
  let ab;
  for (let i = 0; i < 60; i++) { ab = await app.evaluate(() => ({ ...global.lumAdblock })); if (ab.enabled || ab.error) break; await win.waitForTimeout(500); }
  console.log('adblock', JSON.stringify(ab));
  await win.evaluate(() => createTab('https://www.cnn.com/'));
  await win.waitForTimeout(9000);
  console.log('blocked requests after cnn.com:', await app.evaluate(() => global.lumAdblock.blocked));
  const probe = await win.evaluate(() => tab().wv.executeJavaScript("fetch('https://www.googletagmanager.com/gtm.js?id=GTM-TEST',{mode:'no-cors'}).then(()=>'loaded',()=>'blocked')"));
  console.log('googletagmanager probe:', probe);

  // 2) download: no dialog, saved to the Downloads folder, a second one gets " (1)"
  for (let k = 0; k < 2; k++) {
    await win.evaluate(() => tab().wv.executeJavaScript("var a=document.createElement('a');a.href='data:text/plain,hello%20from%20Lum';a.download='lum-test.txt';document.body.appendChild(a);a.click();"));
    await win.waitForTimeout(1500);
  }
  console.log('downloads folder:', JSON.stringify(fs.readdirSync(dl)), 'content:', fs.existsSync(path.join(dl, 'lum-test.txt')) && fs.readFileSync(path.join(dl, 'lum-test.txt'), 'utf8'));

  // 3) drag tabs: 3 tabs, drag the first one past the last
  await win.evaluate(() => { createTab('https://example.com/'); S.debugHover = true; render(); });
  await win.waitForTimeout(2500);
  const ids = () => win.evaluate(() => S.tabs.map((t) => t.id));
  const before = await ids();
  const p = await win.evaluate(() => S.tabs.map((t) => { const r = t.el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.right]; }));
  await win.mouse.move(p[0][0], p[0][1]); await win.mouse.down();
  await win.mouse.move(p[2][2] - 10, p[0][1], { steps: 15 }); await win.waitForTimeout(150);
  await shot('1-dragging.png');
  await win.mouse.up(); await win.waitForTimeout(500);
  const after = await ids();
  console.log('tab order', JSON.stringify(before), '->', JSON.stringify(after), '| active is dragged tab:', await win.evaluate((id) => S.active === id, before[0]),
    '| DOM order matches:', await win.evaluate(() => S.tabs.every((t, i) => tabsEl.children[i] === t.el)), '| line on tab:', await win.evaluate(() => { const r = tab().el.getBoundingClientRect(), b = bar.getBoundingClientRect(), e = activeEdges(); return Math.abs(e.L - (r.left - b.left)) < 1; }));
  // a plain click still switches tabs
  const q = await win.evaluate(() => { const r = S.tabs[0].el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await win.mouse.click(q[0], q[1]); await win.waitForTimeout(300);
  console.log('plain click activates:', await win.evaluate(() => S.active === S.tabs[0].id));

  // 4) QR code from the tab menu
  const c = await win.evaluate(() => { const t = S.tabs.find((x) => /cnn/.test(x.url)); const r = t.el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await win.mouse.click(c[0], c[1], { button: 'right' }); await win.waitForTimeout(300);
  await win.click('[data-ctx=qr]'); await win.waitForTimeout(700);
  console.log('qr open:', await win.evaluate(() => [S.qr, qrWrap.classList.contains('open'), !!$('qrImg').querySelector('svg'), $('qrUrl').textContent]));
  await shot('2-qr.png');
  await win.keyboard.press('Escape'); await win.waitForTimeout(400);
  console.log('qr closed by Esc:', await win.evaluate(() => !S.qr && !qrWrap.classList.contains('open')));
  await app.close();
  fs.rmSync(dl, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
