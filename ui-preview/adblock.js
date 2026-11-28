// Built-in ad and tracker blocking for Lum Preview.
// Engine: @ghostery/adblocker-electron (MPL-2.0) - network + cosmetic filtering with the same filter syntax as
// uBlock Origin. Lists: uBlock Origin's default set (uBO filters, privacy, badware, quick fixes, unbreak) plus
// EasyList, EasyPrivacy and Peter Lowe's list. The compiled engine is cached in the profile folder; lists are
// fetched only when there is no cache or it is older than 7 days, in the background, so start-up is not delayed.
const fs = require('fs');
const path = require('path');
const { net } = require('electron');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

const LISTS = [
  'https://ublockorigin.github.io/uAssets/filters/filters.min.txt',
  'https://ublockorigin.github.io/uAssets/filters/privacy.min.txt',
  'https://ublockorigin.github.io/uAssets/filters/badware.min.txt',
  'https://ublockorigin.github.io/uAssets/filters/quick-fixes.min.txt',
  'https://ublockorigin.github.io/uAssets/filters/unbreak.min.txt',
  'https://easylist.to/easylist/easylist.txt',
  'https://easylist.to/easylist/easyprivacy.txt',
  'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=0&mimetype=plaintext'
];
const MAX_AGE = 7 * 24 * 3600 * 1000;
const CONFIG = { enableCompression: true, loadNetworkFilters: true, loadCosmeticFilters: true };

const state = { enabled: false, blocked: 0, lists: 0, source: 'none', error: null };

function track(blocker) {
  blocker.on('request-blocked', () => { state.blocked++; });
}

async function fetchLists() {
  // Chromium's network stack (net.fetch), not Node's fetch: Node's fetch can crash the main process
  // with an uncaught error when the app closes in the middle of a download.
  const res = await Promise.allSettled(LISTS.map((u) => net.fetch(u).then((r) => (r.ok ? r.text() : Promise.reject(new Error(u + ': ' + r.status))))));
  const ok = res.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  state.lists = ok.length;
  if (!ok.length) throw new Error('no filter list could be downloaded');
  return ElectronBlocker.parse(ok.join('\n'), CONFIG);
}

// Starts blocking in `ses`. Uses the cached engine right away when there is one.
async function startAdblock(ses, cacheDir) {
  const file = path.join(cacheDir, 'adblock-engine.bin');
  let blocker = null, age = Infinity;
  try {
    age = Date.now() - fs.statSync(file).mtimeMs;
    blocker = ElectronBlocker.deserialize(new Uint8Array(fs.readFileSync(file)));
    state.source = 'cache';
  } catch { /* no cache yet */ }
  if (blocker) { track(blocker); blocker.enableBlockingInSession(ses); state.enabled = true; }
  if (blocker && age < MAX_AGE) return state;
  try {
    const fresh = await fetchLists();
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, fresh.serialize());
    if (!blocker) { track(fresh); fresh.enableBlockingInSession(ses); state.enabled = true; state.source = 'downloaded'; }
    // with an old cache already running, the fresh engine is used from the next start
  } catch (e) {
    state.error = String(e && e.message || e);
  }
  return state;
}

module.exports = { startAdblock, adblockState: state };
