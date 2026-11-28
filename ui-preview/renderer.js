'use strict';
// Lum - mini browser UI: bar, tabs, search, settings.

const SEARCH = 'https://www.google.com/search?q=';       // search engine
const START = new URL('start.html', location.href).href; // new tab page

const $ = (id) => document.getElementById(id);
const bar = $('bar'), leftEl = $('left'), tabsEl = $('tabs'), plusBtn = $('newtab'), labelEl = $('label'), input = $('q');
const newField = $('newfield'), newInput = $('nq'), addrEl = $('addr'), addrIn = $('addrIn');
const panel = $('panel'), progressEl = $('progress'), pages = $('pages'), trackPath = $('trackPath');
const bandPath = $('band'), tabFillPath = $('tabFill'), scrimEl = $('scrim');

// Thin, rounded scrollbar on every page (in Chromium this will be a patch)
const SCROLLBAR_CSS = '::-webkit-scrollbar{width:10px;height:10px;background:transparent}' +
  '::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent}' +
  '::-webkit-scrollbar-thumb{background-color:rgba(128,128,128,.42);border-radius:10px;border:3px solid transparent;background-clip:content-box;min-height:40px}' +
  '::-webkit-scrollbar-thumb:hover{background-color:rgba(128,128,128,.7)}' +
  '::-webkit-scrollbar-button{display:none;width:0;height:0}';
const errBox = $('err'), errUrl = $('errUrl'), errDesc = $('errDesc');

// Themes from black to white. The strip above the line (band) is exactly the browser color (page):
// the background of the new tab page and the error screen, so the bar and the browser are one color.
const THEMES = {
  black:    { name: 'Black',      band: '#000000', page: '#000000', light: false },
  graphite: { name: 'Graphite',   band: '#1C1D20', page: '#1C1D20', light: false },
  gray:     { name: 'Gray',       band: '#3A3B40', page: '#3A3B40', light: false },
  silver:   { name: 'Light gray', band: '#DFE0E3', page: '#DFE0E3', light: true },
  white:    { name: 'White',      band: '#FAFAFA', page: '#FAFAFA', light: true },
  // Pastels
  mint:     { name: 'Mint',       band: '#CFEBDD', page: '#CFEBDD', light: true },
  sky:      { name: 'Sky',        band: '#CFE3F3', page: '#CFE3F3', light: true },
  lavender: { name: 'Lavender',   band: '#DCD3F2', page: '#DCD3F2', light: true },
  rose:     { name: 'Rose',       band: '#F3D3DE', page: '#F3D3DE', light: true }
};
const hexLum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
let customColor = '#B9D7EA';
try { const c = localStorage.getItem('lum-custom-color'); if (/^#[0-9a-f]{6}$/i.test(c || '')) customColor = c; } catch { /* default */ }
const normTheme = (v) => (v === 'light' ? 'white' : v === 'dark' ? 'black' : (v === 'custom' || THEMES[v] ? v : 'black'));
let theme = 'black';
try { theme = normTheme(localStorage.getItem('lum-theme')); } catch { /* no storage: black */ }
// 'custom' theme: the color picked in the color input; lightness computed from the color
const TH = () => (theme === 'custom'
  ? { name: 'Custom', band: customColor, page: customColor, light: hexLum(customColor) > 0.55 }
  : THEMES[theme]);
// Bar: 'auto' - hidden (comes back at the top edge), 'clear' - always there but transparent, over the page,
// with a soft shade behind it, 'fixed' - always visible in the theme color, page below it,
// 'full' - like 'fixed', but the tabs and the line are always visible too
const BAR_MODES = ['auto', 'clear', 'fixed', 'full'];
const barSolid = () => barMode === 'fixed' || barMode === 'full';
const normBar = (v) => (BAR_MODES.includes(v) ? v : 'auto');
let barMode = 'auto';
try { barMode = normBar(localStorage.getItem('lum-bar')); } catch { /* hidden by default */ }
// Style: 'round' - arcs and a rounded tab line, 'square' - classic — □ ✕ and a square line
// Window buttons: 'color' - green / yellow / red, 'plain' - the same color as the other icons
let btnColor = 'color';
try { btnColor = localStorage.getItem('lum-btn-color') === 'plain' ? 'plain' : 'color'; } catch { /* colored by default */ }
let uiStyle = 'round';
try { uiStyle = localStorage.getItem('lum-style') === 'square' ? 'square' : 'round'; } catch { /* round by default */ }

const S = { tabs: [], active: null, nextId: 1, near: false, search: false, settings: false, debugHover: false };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const startUrl = () => START + '?bg=' + encodeURIComponent(TH().page) + '&bar=' + barMode;
const isStart = (url) => !url || url.split('?')[0].split('#')[0] === START;
const shown = () => S.near || S.search || S.settings || S.editing || S.menu || S.debugHover;
// Tabs and the line are drawn: on hover etc., or always in the 'full' bar mode
const barOpen = () => shown() || barMode === 'full';
// Tabs are visible when the bar is shown - also while typing in the field in place of +, but not on Ctrl+L
const tabsVisible = () => barOpen() && !(S.search && S.searchTarget === 'current');
const tab = (id) => S.tabs.find((t) => t.id === (id == null ? S.active : id));

// Address or search phrase? The same logic lives in start.js.
//  - http(s)://... and about:blank -> open
//  - localhost, valid IPv4 -> http://
//  - domain with a letter TLD, but not a file name (node.js, index.html) -> https://
//  - other schemes (file:, javascript: ...) -> nothing (local paths are not sent to the search engine)
//  - everything else -> search engine
const FILE_EXT = /\.(js|mjs|ts|html?|css|json|md|txt|py|exe|png|jpe?g|gif|svg|pdf|zip|docx?|xlsx?)$/i;
function classify(text) {
  const v = (text || '').trim();
  if (!v) return null;
  if (/^https?:\/\/\S+$/i.test(v) || v === 'about:blank') return { kind: 'url', url: v };
  if (/^[a-z][a-z0-9+.-]*:(\/\/|[^\d])/i.test(v) && !/^localhost:/i.test(v)) return { kind: 'blocked' };
  const m = v.match(/^([^\s\/?#:]+)(:\d{1,5})?([\/?#]\S*)?$/);
  if (m) {
    const host = m[1];
    const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (host.toLowerCase() === 'localhost' || (ip && ip.slice(1).every((n) => Number(n) <= 255))) return { kind: 'url', url: 'http://' + v };
    if (!ip && /^[^.]+(\.[^.]+)*\.[a-z]{2,}$/i.test(host) && !(FILE_EXT.test(host) && !m[3])) return { kind: 'url', url: 'https://' + v };
  }
  return { kind: 'search', url: SEARCH + encodeURIComponent(v) };
}
function toUrl(text) { const c = classify(text); return c && c.kind !== 'blocked' ? c.url : null; }

/* ================= Tabs ================= */
function createTab(url, focus = true) {
  const t = { id: S.nextId++, url: url || startUrl(), title: 'New tab', favicon: null, loading: true, ready: false, atTop: true,
    focusNote: false, error: null, light: TH().light, color: null, colorLight: TH().light, el: null };
  const wv = document.createElement('webview');
  wv.setAttribute('partition', 'persist:lum');
  wv.setAttribute('allowpopups', '');                      // "open in new window" links -> new tab (main.js)
  wv.setAttribute('webpreferences', 'contextIsolation=yes');
  wv.setAttribute('src', t.url);
  t.wv = wv;

  wv.addEventListener('dom-ready', () => {
    t.ready = true;
    wv.insertCSS(SCROLLBAR_CSS).catch(() => {});
    if (isStart(t.url)) applyStartTheme(t);
    else { try { window.lum.hook(wv.getWebContentsId()); } catch { /* */ } }
    if (t.focusNote) { t.focusNote = false; focusNote(t); }
    if (t.blurOnReady) { t.blurOnReady = false; wv.executeJavaScript('document.activeElement && document.activeElement.blur()').catch(() => {}); }
    updateNav(); sampleSoon(t);
  });
  wv.addEventListener('page-title-updated', (e) => { if (!isStart(t.url)) { t.title = e.title; renderTabs(); } });
  wv.addEventListener('page-favicon-updated', (e) => { t.favicon = (e.favicons && e.favicons[0]) || null; renderTabs(); });
  wv.addEventListener('did-navigate', (e) => {
    t.url = e.url; t.error = null; t.atTop = true; // a new page starts at the top (the hook corrects it)
    if (isStart(t.url)) { t.title = 'New tab'; t.favicon = null; }
    render(); sampleSoon(t);
  });
  wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) { t.url = e.url; render(); sampleSoon(t); } });
  wv.addEventListener('did-start-loading', () => { t.loading = true; t.navSeq = (t.navSeq || 0) + 1; if (t.id === S.active) progress(true); renderTabs(); });
  wv.addEventListener('did-stop-loading', () => { t.loading = false; if (t.id === S.active) progress(false); renderTabs(); updateNav(); sampleWhenReady(t); });
  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3: aborted (e.g. another navigation)
    t.error = { url: e.validatedURL || t.url, desc: e.errorDescription || String(e.errorCode) };
    t.url = t.error.url; t.title = "Couldn't open the page"; t.favicon = null; t.loading = false;
    if (t.id === S.active) progress(false);
    render();
  });
  wv.addEventListener('console-message', (e) => {
    if (e.message === '__lum_scroll__') sampleSoon(t);
    else if (e.message === '__lum_top__1' || e.message === '__lum_top__0') {
      const top = e.message.endsWith('1');
      if (top !== t.atTop) { t.atTop = top; if (t.id === S.active) updateTone(); else applyDock(); }
    }
  });
  // Clicking the page closes settings and the search on the bar
  wv.addEventListener('focus', () => { if (S.settings || S.search) { S.settings = false; S.search = false; render(); } });

  pages.appendChild(wv);
  S.tabs.push(t);
  if (focus) activateTab(t.id); else { wv.classList.add('hidden'); renderTabs(); }
  return t;
}

function activateTab(id) {
  S.active = id;
  S.tabs.forEach((t) => t.wv.classList.toggle('hidden', t.id !== id));
  const t = tab();
  progress(t && t.loading);
  render();
  if (t && t.el) scrollTabIntoView(t.el);
  if (t) sampleSoon(t);
  focusHomeField();
}

// On the home page the search field is always ready for typing and pasting
function focusHomeField() {
  const t = tab();
  if (!t || !isStart(t.url) || S.search || S.settings) return;
  if (t.ready) focusNote(t); else t.focusNote = true;
}

function closeTab(id) {
  const i = S.tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const [t] = S.tabs.splice(i, 1);
  t.wv.remove();
  if (t.el) t.el.remove();
  if (!S.tabs.length) { openNewTab(); return; }
  if (S.active === id) activateTab(S.tabs[Math.min(i, S.tabs.length - 1)].id);
  else render();
}

function focusNote(t) {
  t.wv.focus();
  t.wv.executeJavaScript("var n = document.getElementById('nin'); if (n) n.focus();").catch(() => {});
}

function openNewTab() {
  S.settings = false; S.search = false;
  const t = createTab(startUrl());
  t.focusNote = true;
}

// Input fields:
//  'new'     - + / Ctrl+T: small field in place of +, tabs stay visible; the tab is created only on Enter
//  'current' - Ctrl+L: field in the middle of the bar with the current tab's address
const activeInput = () => (S.searchTarget === 'new' ? newInput : input);
function openSearch(target = 'new') {
  S.settings = false;
  S.searchTarget = target;
  // No second blinking caret inside the page
  const t = tab();
  if (t && t.ready) t.wv.executeJavaScript('document.activeElement && document.activeElement.blur()').catch(() => {});
  S.search = true;
  newInput.value = '';
  newField.classList.remove('typing');
  input.value = target === 'current' && t && !isStart(t.url) && !t.error ? t.url : '';
  render();
  setTimeout(() => { const el = activeInput(); el.focus(); el.select(); }, 30);
}

// Address on the bar: click it to place the caret, drag to select, type to change it; Enter opens, Esc cancels.
// Ctrl+L selects the whole address. On the new tab page (no address) Ctrl+L opens the search field instead.
function editAddress() {
  const t = tab();
  if (!t || isStart(t.url)) { openSearch('current'); return; }
  S.editing = true; S.settings = false; S.search = false;
  render();
  setTimeout(() => { addrIn.focus(); addrIn.select(); }, 30);
}
function submitAddress() {
  const t = tab(), v = addrIn.value.trim();
  const url = v === addrIn.dataset.orig ? t.url : toUrl(v);
  addrIn.blur();
  if (url && t) t.wv.loadURL(url).catch(() => {});
}
addrIn.addEventListener('focus', () => { if (!S.editing) { S.editing = true; S.settings = false; render(); } });
addrIn.addEventListener('blur', () => {
  S.editing = false;
  addrIn.value = addrIn.dataset.orig || '';
  addrIn.scrollLeft = 0;
  render(); focusHomeField();
});
addrIn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitAddress(); }
  else if (e.key === 'Escape') { e.preventDefault(); addrIn.blur(); }
});
// The address stays visible while the cursor is near it (instead of fading out when the tabs appear)
addrEl.addEventListener('mouseenter', () => bar.classList.add('near-label'));
addrEl.addEventListener('mouseleave', () => bar.classList.remove('near-label'));

function closeSearch() { S.search = false; input.blur(); newInput.blur(); render(); focusHomeField(); }

function submit(text) {
  const url = toUrl(text);
  if (!url) return;
  const target = S.searchTarget;
  S.search = false; input.blur(); newInput.blur();
  if (target === 'new') createTab(url);
  else tab().wv.loadURL(url).catch(() => {});
  render();
}

function reload() {
  const t = tab();
  if (t.error) t.wv.loadURL(t.error.url).catch(() => {});
  else t.wv.reload();
}

function step(dir) {
  const i = S.tabs.findIndex((t) => t.id === S.active);
  const n = S.tabs[(i + dir + S.tabs.length) % S.tabs.length];
  if (n) activateTab(n.id);
}

// The theme changes in place, without a reload and without a new history entry
function applyStartTheme(t) {
  t.wv.executeJavaScript('typeof lumTheme === "function" && lumTheme(' + JSON.stringify(TH().page) + ');' +
    'typeof lumBar === "function" && lumBar(' + JSON.stringify(barMode) + ')').catch(() => {});
  t.light = t.colorLight = TH().light;
  t.color = TH().page;
}
// Theme colors on the bar, in the panel and on the error screen
function applyThemeChrome() {
  const T = TH();
  document.body.dataset.lumTheme = theme;
  document.body.classList.toggle('theme-light', T.light);
  document.body.style.setProperty('--band', T.band);
  document.body.style.setProperty('--page', T.page);
  const nameEl = $('tname');
  if (nameEl) nameEl.textContent = T.name;
  const cc = $('customColor'), cs = $('customSwatch');
  if (cc && cc.value.toLowerCase() !== customColor.toLowerCase()) cc.value = customColor;
  if (cs) cs.style.setProperty('--cc', customColor);
}
function setUiStyle(s) {
  uiStyle = s === 'square' ? 'square' : 'round';
  try { localStorage.setItem('lum-style', uiStyle); } catch { /* no storage */ }
  render();
  track.ready = false; updateTrack(tabsVisible(), true); // line switches to the new shape right away
}
function setBtnColor(v) {
  btnColor = v === 'plain' ? 'plain' : 'color';
  try { localStorage.setItem('lum-btn-color', btnColor); } catch { /* no storage */ }
  render();
}
function setBarMode(mode) {
  barMode = normBar(mode);
  try { localStorage.setItem('lum-bar', barMode); } catch { /* no storage */ }
  // Home pages get the mode right away, so the field stays in the same spot in the window
  S.tabs.forEach((x) => { if (isStart(x.url) && x.ready) x.wv.executeJavaScript('typeof lumBar === "function" && lumBar(' + JSON.stringify(barMode) + ')').catch(() => {}); });
  render();
  setTimeout(() => { renderTabs(); sampleSoon(); }, 60); // the page resizes
}
function setTheme(next) {
  theme = normTheme(next);
  try { localStorage.setItem('lum-theme', theme); } catch { /* no storage */ }
  S.tabs.forEach((x) => { if (isStart(x.url) && x.ready) applyStartTheme(x); });
  render();
}
// Custom color from the color input (updates live while picking)
function setCustomColor(c) {
  if (!/^#[0-9a-f]{6}$/i.test(c)) return;
  customColor = c;
  try { localStorage.setItem('lum-custom-color', c); } catch { /* no storage */ }
  setTheme('custom');
}

/* ================= Drawing the bar ================= */
const ICON_MOON = '<svg viewBox="0 0 120 120"><path d="M52.34 0.5 A60 60 0 1 0 119.5 67.67 A48 48 0 1 1 52.34 0.5 Z" fill="currentColor"/></svg>';
const ICON_GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16"/></svg>';
const ICON_X = '<svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3 3 9"/></svg>';

function render() { renderBar(); renderTabs(); updateTone(); renderError(); }

// Address shown on the bar: host + decoded path, without the scheme. Returns [host, path].
// The same text is in the edit field on top of it, so the text does not move when you click it.
function addrParts(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      let path = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
      try { path = decodeURIComponent(path); } catch { /* stays encoded */ }
      return [u.host, path];
    }
    return [u.protocol.replace(/:$/, ''), ''];
  } catch {
    return [url, ''];
  }
}
function labelFor(url) { const [h, p] = addrParts(url); return esc(h) + '<span class="path">' + esc(p) + '</span>'; }

function renderBar() {
  const t = tab();
  bar.classList.toggle('show', barOpen());
  bar.classList.toggle('searching', S.search && S.searchTarget === 'current');
  bar.classList.toggle('adding', S.search && S.searchTarget === 'new');
  // On the new tab page the search field is in the middle of the page, so the bar shows no address
  const hasUrl = !!t && !isStart(t.url);
  if (!S.editing) {
    if (!hasUrl) { labelEl.textContent = ''; addrIn.value = ''; }
    else { labelEl.innerHTML = labelFor(t.url); addrIn.value = addrParts(t.url).join(''); }
    addrIn.dataset.orig = addrIn.value;
  }
  addrEl.classList.toggle('has-url', hasUrl);
  bar.classList.toggle('editing', !!S.editing);
  panel.classList.toggle('open', S.settings);
  panel.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.theme === theme ? 'true' : 'false'));
  panel.querySelectorAll('[data-barmode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.barmode === barMode ? 'true' : 'false'));
  panel.querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.style === uiStyle ? 'true' : 'false'));
  panel.querySelectorAll('[data-btncolor]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.btncolor === btnColor ? 'true' : 'false'));
  document.body.classList.toggle('btn-plain', btnColor === 'plain');
  document.body.classList.toggle('style-square', uiStyle === 'square');
  TK.r = uiStyle === 'square' ? 0 : 8;
  applyThemeChrome();
  document.body.classList.toggle('bar-auto', barMode === 'auto');
  document.body.classList.toggle('bar-fixed', barSolid());
  document.body.classList.toggle('bar-full', barMode === 'full');
  document.body.classList.toggle('bar-clear', barMode === 'clear');
  document.body.classList.toggle('bar-shown', shown());
  updateNav();
}

// Tabs are updated in place (no rebuild), so clicks are not lost and CSS transitions work.
function tabElement(t) {
  if (t.el) return t.el;
  const el = document.createElement('div');
  el.className = 'tab';
  el.setAttribute('role', 'tab');
  el.dataset.tab = t.id;
  el.innerHTML = '<span class="fav"></span><span class="t"></span><span class="x" data-close="' + t.id + '" title="Close tab (Ctrl+W, middle mouse button)">' + ICON_X + '</span>';
  t.el = el;
  return el;
}

function renderTabs() {
  S.tabs.forEach((t, i) => {
    const el = tabElement(t);
    if (tabsEl.children[i] !== el) tabsEl.insertBefore(el, tabsEl.children[i] || null);
    el.style.setProperty('--i', Math.min(i, 10));
    el.classList.toggle('active', t.id === S.active);
    el.classList.toggle('loading', t.loading);
    el.setAttribute('aria-selected', String(t.id === S.active));
    if (el.title !== t.title) el.title = t.title;
    const favKey = t.favicon || (isStart(t.url) ? 'moon' : 'globe');
    if (el.dataset.fav !== favKey) {
      el.dataset.fav = favKey;
      el.querySelector('.fav').innerHTML = t.favicon ? '<img src="' + esc(t.favicon) + '" alt="">' : (favKey === 'moon' ? ICON_MOON : ICON_GLOBE);
      const img = el.querySelector('.fav img');
      if (img) img.onerror = () => { el.querySelector('.fav').innerHTML = ICON_GLOBE; };
    }
    const tt = el.querySelector('.t');
    if (tt.textContent !== t.title) tt.textContent = t.title;
  });
  Array.from(tabsEl.children).forEach((c) => { if (!S.tabs.some((t) => t.el === c)) c.remove(); });
  plusBtn.style.setProperty('--i', Math.min(S.tabs.length, 11));
  // tabsEl.offsetLeft is relative to #left (it is positioned), so it is already the space before the tabs
  const avail = leftEl.clientWidth - tabsEl.offsetLeft - (plusBtn.offsetWidth || newField.offsetWidth) - 8;
  tabsEl.classList.toggle('dense', avail / Math.max(1, S.tabs.length) < 110);
  updateTrack(tabsVisible());
}

function scrollTabIntoView(el) {
  const l = el.offsetLeft - tabsEl.offsetLeft, r = l + el.offsetWidth;
  if (l < tabsEl.scrollLeft) tabsEl.scrollLeft = l - 8;
  else if (r > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = r - tabsEl.clientWidth + 8;
}

function updateNav() {
  const t = tab();
  let back = false, fwd = false;
  if (t && t.ready) { try { back = t.wv.canGoBack(); fwd = t.wv.canGoForward(); } catch { /* still loading */ } }
  bar.querySelector('[data-act=back]').classList.toggle('off', !back);
  bar.querySelector('[data-act=forward]').classList.toggle('off', !fwd);
}

function renderError() {
  const t = tab();
  const err = t && t.id === S.active && t.error;
  errBox.hidden = !err;
  if (err) { errUrl.textContent = err.url; errDesc.textContent = err.desc; }
  S.tabs.forEach((x) => x.wv.classList.toggle('errored', !!x.error));
}

// Bar hidden: transparent, icon color follows the page's lightness.
// Bar shown: above the line the browser theme color, and the inside of the open tab in the color
// most common at the top of the page - the tab looks like an extension of the page.
// 'clear' mode: the bar stays transparent. Page scrolled to the very top: the page starts below the bar
// (its own buttons do not collide with ours) and the bar sits on the theme color. Scrolled down: the page
// runs under the bar and a dark shade behind it keeps the light icons readable.
function updateTone() {
  const t = tab(), on = shown();
  const themeLight = TH().light;
  let pageColor = TH().page, pageLight = themeLight;
  if (t && !t.error && t.color) { pageColor = t.color; pageLight = t.colorLight; }
  const topLight = !!(t && !t.error ? t.light : themeLight);
  const docked = applyDock();
  // Lum's own pages (new tab, error screen) already have the theme color: no shade needed there
  const plain = !t || isStart(t.url) || !!t.error || docked;
  scrimEl.classList.toggle('off', plain);
  const solid = barSolid() || (on && barMode === 'auto');
  bar.classList.toggle('on-light', barMode === 'clear' ? (plain ? themeLight : false) : solid ? themeLight : topLight);
  tabFillPath.style.fill = pageColor;
  bar.style.setProperty('--tab-ink', pageLight ? '#16181B' : '#FFFFFF');
}

// 'clear' mode: a web page scrolled to the very top is moved below the bar ("docked").
// Returns whether the active tab is docked.
function applyDock() {
  let active = false;
  S.tabs.forEach((x) => {
    const d = barMode === 'clear' && !isStart(x.url) && !x.error && x.atTop !== false;
    x.wv.classList.toggle('docked', d);
    if (x.id === S.active) active = d;
  });
  return active;
}

/* Open tab line: from the left to the right window edge, wraps around the open tab */
const track = { L: 0, R: 0, ready: false, timer: null };
// Tab top, line level (bottom of the bar, so buttons sit midway between the window top and the line), corner radius
const TK = { t: 6, b: 37, r: uiStyle === 'square' ? 0 : 8 };
// The line starts at the top of the left window edge, runs down, goes to the open tab,
// wraps around it, continues and at the right edge goes back up - it becomes the window border.
// Crisp line on any screen scaling (100%, 125%, 150%...): a whole number of screen pixels thick
// and straight parts placed on the screen pixel grid, so they do not smear across two pixels.
function pixelGrid() {
  const d = window.devicePixelRatio || 1, w = Math.max(1, Math.round(1.2 * d)), o = w % 2 ? 0.5 : 0;
  return { width: w / d, snap: (v) => (Math.round(v * d - o) + o) / d };
}
function edgeStart() { const { r } = TK, { snap } = pixelGrid(), b = snap(TK.b), x = snap(0.6); return 'M' + x + ' 0V' + (b - r) + 'Q' + x + ' ' + b + ' ' + (x + r) + ' ' + b; }
function edgeEnd() { const { r } = TK, { snap } = pixelGrid(), b = snap(TK.b), x = snap(bar.clientWidth - 0.6); return 'H' + (x - r) + 'Q' + x + ' ' + b + ' ' + x + ' ' + (b - r) + 'V0'; }
function trackD(L, R) {
  const { r } = TK, { snap } = pixelGrid(), t = snap(TK.t), b = snap(TK.b);
  L = snap(L); R = snap(R);
  return edgeStart() + 'H' + (L - r) + 'Q' + L + ' ' + b + ' ' + L + ' ' + (b - r) + 'V' + (t + r) + 'Q' + L + ' ' + t + ' ' + (L + r) + ' ' + t +
    'H' + (R - r) + 'Q' + R + ' ' + t + ' ' + R + ' ' + (t + r) + 'V' + (b - r) + 'Q' + R + ' ' + b + ' ' + (R + r) + ' ' + b + edgeEnd();
}
// Everything below the line inside the bar box gets the page color: the open tab's inside (with the outward
// curves at its bottom corners), the curved pockets at the window corners and the thin strip under the line.
// The theme color (band) is only above the line, so no theme-colored sliver shows under it.
function underShape(e) {
  const w = bar.clientWidth, line = e ? trackD(e.L, e.R) : edgeStart() + edgeEnd();
  return line + 'L' + w + ' 0V' + (TK.b + 1) + 'H0V0Z';
}
function setShapes(e) {
  const w = bar.clientWidth, rect = 'M0 0H' + w + 'V' + (TK.b + 1) + 'H0Z';
  trackPath.style.strokeWidth = pixelGrid().width + 'px';
  trackPath.setAttribute('d', e ? trackD(e.L, e.R) : edgeStart() + edgeEnd());
  // The tab bump only while the tabs are shown; otherwise the line under the bar is straight
  const under = underShape(e && tabsVisible() ? e : null);
  bandPath.setAttribute('d', rect + under);
  tabFillPath.setAttribute('d', under);
}
// Open tab edges in the window, clipped to the visible part of the tab strip. When the tab is not visible: null (a straight line).
function activeEdges() {
  const a = tabsEl.querySelector('.tab.active');
  if (!a) return null;
  // Offsets of the tabs are relative to #left (positioned); add #left's own offset to get bar/window coordinates
  const base = leftEl.offsetLeft;
  const minL = base + tabsEl.offsetLeft, maxR = minL + tabsEl.clientWidth;
  let L = base + a.offsetLeft - tabsEl.scrollLeft, R = L + a.offsetWidth;
  if (R <= minL + 12 || L >= maxR - 12) return null;
  return { L: Math.max(minL, L), R: Math.min(maxR, R) };
}
function updateTrack(visible, instant) {
  const e = activeEdges();
  clearTimeout(track.timer);
  if (!e) { track.ready = false; setShapes(null); return; }
  if (!visible || !track.ready || instant) { Object.assign(track, { L: e.L, R: e.R, ready: true }); setShapes(e); return; }
  const L0 = track.L, R0 = track.R, t0 = performance.now(), ms = 420;
  (function anim() {
    const f = Math.min(1, (performance.now() - t0) / ms), k = 1 - Math.pow(1 - f, 3);
    track.L = L0 + (e.L - L0) * k; track.R = R0 + (e.R - R0) * k;
    setShapes({ L: track.L, R: track.R });
    if (f < 1) track.timer = setTimeout(anim, 16);
  })();
}

function progress(on) {
  if (on) { progressEl.classList.remove('done'); progressEl.classList.add('run'); }
  else if (progressEl.classList.contains('run')) {
    progressEl.classList.remove('run'); progressEl.classList.add('done');
    setTimeout(() => progressEl.classList.remove('done'), 900);
  }
}

/* ================= Color and lightness of the page's top edge ================= */
// Checked only when something changed: load, navigation, scroll, tab switch.
// Plus a rare fallback every 4 s for pages that change on their own (only while the window is focused).
function sample(t) {
  t = t || tab();
  // While loading the page may be blank or half drawn - the previous color stays
  if (!t || !t.ready || t.error || t.loading || document.hidden) return;
  let id;
  try { id = t.wv.getWebContentsId(); } catch { return; }
  // Tab color: a strip around the open tab (with margin on the sides), lightness: full width
  const w = t.wv.clientWidth || window.innerWidth;
  let fx0 = 0, fx1 = 1;
  const e = t.id === S.active ? activeEdges() : null;
  if (e) { fx0 = Math.max(0, (e.L - 60) / w); fx1 = Math.min(1, (e.R + 60) / w); }
  window.lum.sample(id, w, fx0, fx1).then((v) => {
    if (!v) return;
    t.light = v.lum > 0.55;
    t.color = v.color;
    t.colorLight = v.colorLum > 0.55;
    if (t.id === S.active) updateTone();
  });
}
const sampleTimers = new Map();
function sampleSoon(t) {
  t = t || tab();
  if (!t) return;
  clearTimeout(sampleTimers.get(t.id));
  sampleTimers.set(t.id, setTimeout(() => sample(t), 160));
}
setInterval(() => { if (document.hasFocus()) sample(); }, 4000);

// After a page loads, the color is sampled once the page is really ready: full load (load event),
// fonts loaded and two painted frames. Then once more a moment later, because some pages
// pull in content (e.g. a background, a banner) after loading.
const WHEN_READY = "new Promise(function (done) {" +
  "function frames() { requestAnimationFrame(function () { requestAnimationFrame(function () { done(true); }); }); }" +
  "function fonts() { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(frames, frames); }" +
  "if (document.readyState === 'complete') fonts(); else addEventListener('load', fonts, { once: true });" +
  "setTimeout(function () { done(false); }, 6000);" +
  "})";
function sampleWhenReady(t) {
  const nav = (t.navSeq = (t.navSeq || 0) + 1); // another navigation cancels the previous wait
  t.wv.executeJavaScript(WHEN_READY).catch(() => false).then(() => {
    if (t.navSeq !== nav || t.loading) return;
    sample(t);
    setTimeout(() => { if (t.navSeq === nav && !t.loading) sample(t); }, 1200);
  });
}

/* ================= Events ================= */
function pressFx(el) {
  const target = el.closest('.btn, .tab, .seg button, .sw-btn');
  if (!target) return;
  target.classList.add('pressed');
  setTimeout(() => target.classList.remove('pressed'), 140);
}
document.addEventListener('pointerdown', (e) => { if (e.button === 0) pressFx(e.target); });

document.addEventListener('click', (e) => {
  const el = e.target;
  const close = el.closest('[data-close]'); if (close) { e.stopPropagation(); closeTab(Number(close.dataset.close)); return; }
  const tb = el.closest('[data-tab]'); if (tb) { S.search = false; activateTab(Number(tb.dataset.tab)); return; }
  const th = el.closest('.sw-btn[data-theme]'); if (th) { setTheme(th.dataset.theme); return; }
  const bm = el.closest('button[data-barmode]'); if (bm) { setBarMode(bm.dataset.barmode); return; }
  const sb = el.closest('button[data-style]'); if (sb) { setUiStyle(sb.dataset.style); return; }
  const bc = el.closest('button[data-btncolor]'); if (bc) { setBtnColor(bc.dataset.btncolor); return; }
  if (el.closest('#panel')) return;
  const act = el.closest('[data-act]');
  if (!act) { if (S.settings) { S.settings = false; render(); focusHomeField(); } return; }
  const a = act.dataset.act, t = tab();
  if (a !== 'settings') S.settings = false;
  if (a === 'back') { try { if (t.wv.canGoBack()) t.wv.goBack(); } catch { /* */ } }
  else if (a === 'forward') { try { if (t.wv.canGoForward()) t.wv.goForward(); } catch { /* */ } }
  else if (a === 'reload' || a === 'retry') reload();
  else if (a === 'newtab') { if (S.search && S.searchTarget === 'new') closeSearch(); else openSearch('new'); return; }
  else if (a === 'submit') { submit(input.value); return; }
  else if (a === 'addgo') { submit(newInput.value); return; }
  else if (a === 'settings') { S.settings = !S.settings; S.search = false; if (!S.settings) { render(); focusHomeField(); return; } }
  else if (a === 'min' || a === 'max' || a === 'close') { window.lum.win(a); return; }
  render();
});

// Right click on a tab: a small menu - copy the tab's link, close the tab
const ctxEl = $('ctx');
function openTabMenu(id, x, y) {
  const t = tab(id);
  if (!t) return;
  S.menu = id;
  ctxEl.querySelector('[data-ctx=copy]').disabled = isStart(t.url);
  ctxEl.classList.add('open');
  render();
  const w = ctxEl.offsetWidth;
  ctxEl.style.left = Math.max(6, Math.min(x, window.innerWidth - w - 6)) + 'px';
  ctxEl.style.top = Math.max(y, 40) + 'px';
}
function closeTabMenu() { if (S.menu == null) return; S.menu = null; ctxEl.classList.remove('open'); render(); }
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('on'), 1300);
}
tabsEl.addEventListener('contextmenu', (e) => {
  const tb = e.target.closest('[data-tab]');
  if (!tb) return;
  e.preventDefault();
  openTabMenu(Number(tb.dataset.tab), e.clientX, e.clientY + 6);
});
ctxEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ctx]');
  if (!b || b.disabled) return;
  e.stopPropagation();
  const t = tab(S.menu);
  closeTabMenu();
  if (!t) return;
  if (b.dataset.ctx === 'copy') { window.lum.copy(t.url); toast('Link copied'); }
  else if (b.dataset.ctx === 'close') closeTab(t.id);
});
document.addEventListener('pointerdown', (e) => { if (S.menu != null && !e.target.closest('#ctx')) closeTabMenu(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTabMenu(); });
window.addEventListener('blur', closeTabMenu);

// Middle mouse button (wheel click) closes a tab
tabsEl.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
tabsEl.addEventListener('auxclick', (e) => {
  if (e.button !== 1) return;
  const tb = e.target.closest('[data-tab]');
  if (tb) { e.preventDefault(); closeTab(Number(tb.dataset.tab)); }
});
// With too many tabs, the mouse wheel scrolls the tab strip
tabsEl.addEventListener('wheel', (e) => {
  if (tabsEl.scrollWidth <= tabsEl.clientWidth) return;
  e.preventDefault();
  tabsEl.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX);
}, { passive: false });
tabsEl.addEventListener('scroll', () => updateTrack(tabsVisible(), true));

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submit(input.value); }
  else if (e.key === 'Escape') closeSearch();
});
// Clicking outside the field closes it (without creating a tab); the magnifier in the field does not take focus
input.addEventListener('blur', () => setTimeout(() => { if (S.search && document.activeElement !== input) closeSearch(); }, 120));
document.querySelector('.sbox [data-act=submit]').addEventListener('mousedown', (e) => e.preventDefault());
// Same for the small field in place of +
newInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submit(newInput.value); }
  else if (e.key === 'Escape') closeSearch();
});
// The magnifier next to the field appears only once you type something (like on the home page)
newInput.addEventListener('input', () => newField.classList.toggle('typing', newInput.value.trim().length > 0));
// Coming back to the window on the home page: the caret goes straight into the search field
window.addEventListener('focus', () => setTimeout(focusHomeField, 30));
newInput.addEventListener('blur', () => setTimeout(() => { if (S.search && S.searchTarget === 'new' && document.activeElement !== newInput) closeSearch(); }, 120));
newField.querySelector('[data-act=addgo]').addEventListener('mousedown', (e) => e.preventDefault());

// Window dragging: native (CSS -webkit-app-region: drag on the empty bar), so snapping
// to screen edges and corners, Win+arrows and double-click = maximize all work.
$('customColor').addEventListener('input', (e) => setCustomColor(e.target.value));

// The bar appears only at the very top edge (so it does not cover the page on normal clicks near the top)
// and stays while the cursor is around the bar.
window.lum.on('zone', (zone) => {
  // Hidden: the bar appears when the cursor enters its (invisible) area, and stays just below it.
  // Always visible: tabs show up when the cursor is on the bar.
  const onBar = zone === 'edge' || zone === 'bar';
  const near = barSolid() ? onBar : (onBar || (S.near && zone === 'near'));
  if (near !== S.near) {
    S.near = near;
    render();
    sampleSoon();
  }
});
window.lum.on('cmd', (c) => {
  const t = tab();
  if (c === 'newtab') openSearch('new');
  else if (c === 'close') closeTab(S.active);
  else if (c === 'search') editAddress();
  else if (c === 'next') step(1);
  else if (c === 'prev') step(-1);
  else if (c === 'reload') reload();
  else if (c === 'back') { try { if (t.wv.canGoBack()) t.wv.goBack(); } catch { /* */ } }
  else if (c === 'forward') { try { if (t.wv.canGoForward()) t.wv.goForward(); } catch { /* */ } }
});
window.lum.on('open-tab', (url) => createTab(url));
window.lum.on('debug-hover', (on) => { S.debugHover = !!on; render(); });
window.addEventListener('resize', () => {
  renderTabs();
  const t = tab();
  if (t && t.el) { scrollTabIntoView(t.el); updateTrack(tabsVisible(), true); }
});

applyThemeChrome();
openNewTab();
