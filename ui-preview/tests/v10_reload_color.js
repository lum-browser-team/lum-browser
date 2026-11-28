// Tab color after a reload: the previous one stays while loading, the new one only after load.
const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const cwd = path.join(__dirname, '..');
  const app = await electron.launch({ args: ['.', '--user-data-dir=' + path.join(__dirname, '.profile-v10')], cwd, executablePath: require('electron') });
  const win = await app.firstWindow();
  await win.waitForTimeout(2000);
  await win.evaluate(() => createTab('https://www.python.org'));
  await win.waitForTimeout(6000);
  const before = await win.evaluate(() => tab().color);
  const log = [];
  await win.evaluate(() => { window.__colors = []; const t = tab(); const iv = setInterval(() => window.__colors.push([Math.round(performance.now()), t.loading, t.color]), 100); setTimeout(() => clearInterval(iv), 7000); reload(); });
  await win.waitForTimeout(7500);
  const seq = await win.evaluate(() => window.__colors);
  const whileLoading = [...new Set(seq.filter((s) => s[1]).map((s) => s[2]))];
  const after = seq[seq.length - 1][2];
  console.log('before', before, '| colors while loading', JSON.stringify(whileLoading), '| after', after);
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
