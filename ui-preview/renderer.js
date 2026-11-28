'use strict';
// Lum - interfejs mini przeglądarki: pasek, karty, wyszukiwanie, ustawienia.

const SEARCH = 'https://www.google.com/search?q=';       // wyszukiwarka
const START = new URL('start.html', location.href).href; // nowa karta

const $ = (id) => document.getElementById(id);
const bar = $('bar'), leftEl = $('left'), tabsEl = $('tabs'), plusBtn = $('newtab'), labelEl = $('label'), input = $('q');
const newField = $('newfield'), newInput = $('nq');
const panel = $('panel'), progressEl = $('progress'), pages = $('pages'), trackPath = $('trackPath');
const bandPath = $('band'), tabFillPath = $('tabFill');

// Cienki, zaokrąglony pasek przewijania na każdej stronie (w Chromium zrobimy to łatką)
const SCROLLBAR_CSS = '::-webkit-scrollbar{width:10px;height:10px;background:transparent}' +
  '::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent}' +
  '::-webkit-scrollbar-thumb{background-color:rgba(128,128,128,.42);border-radius:10px;border:3px solid transparent;background-clip:content-box;min-height:40px}' +
  '::-webkit-scrollbar-thumb:hover{background-color:rgba(128,128,128,.7)}' +
  '::-webkit-scrollbar-button{display:none;width:0;height:0}';
const errBox = $('err'), errUrl = $('errUrl'), errDesc = $('errDesc');

// Motywy od czarnego do białego. Pasek nad linią (band) ma dokładnie kolor przeglądarki (page):
// tło nowej karty i ekranu błędu, więc pasek i przeglądarka są jednym kolorem.
const THEMES = {
  black:    { name: 'Czarny',     band: '#000000', page: '#000000', light: false },
  graphite: { name: 'Grafit',     band: '#1C1D20', page: '#1C1D20', light: false },
  gray:     { name: 'Szary',      band: '#3A3B40', page: '#3A3B40', light: false },
  silver:   { name: 'Jasnoszary', band: '#DFE0E3', page: '#DFE0E3', light: true },
  white:    { name: 'Biały',      band: '#FAFAFA', page: '#FAFAFA', light: true },
  // Pastele
  mint:     { name: 'Miętowy',     band: '#CFEBDD', page: '#CFEBDD', light: true },
  sky:      { name: 'Błękitny',    band: '#CFE3F3', page: '#CFE3F3', light: true },
  lavender: { name: 'Lawendowy',   band: '#DCD3F2', page: '#DCD3F2', light: true },
  rose:     { name: 'Różowy',      band: '#F3D3DE', page: '#F3D3DE', light: true },
  peach:    { name: 'Brzoskwiniowy', band: '#F6D9C7', page: '#F6D9C7', light: true },
  lemon:    { name: 'Cytrynowy',   band: '#F3EDC4', page: '#F3EDC4', light: true }
};
const hexLum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
let customColor = '#B9D7EA';
try { const c = localStorage.getItem('lum-custom-color'); if (/^#[0-9a-f]{6}$/i.test(c || '')) customColor = c; } catch { /* domyślny */ }
const normTheme = (v) => (v === 'light' ? 'white' : v === 'dark' ? 'black' : (v === 'custom' || THEMES[v] ? v : 'black'));
let theme = 'black';
try { theme = normTheme(localStorage.getItem('lum-theme')); } catch { /* bez pamięci: czarny */ }
// Motyw 'custom': kolor wybrany w polu koloru; jasność liczona z koloru
const TH = () => (theme === 'custom'
  ? { name: 'Własny', band: customColor, page: customColor, light: hexLum(customColor) > 0.55 }
  : THEMES[theme]);
// Pasek: 'auto' - chowany (wraca przy górnej krawędzi), 'fixed' - zawsze widoczny, strona pod nim
let barMode = 'auto';
try { barMode = localStorage.getItem('lum-bar') === 'fixed' ? 'fixed' : 'auto'; } catch { /* domyślnie chowany */ }
// Styl: 'round' - łuki i zaokrąglona linia karty, 'square' - klasyczne — □ ✕ i kanciasta linia
let uiStyle = 'round';
try { uiStyle = localStorage.getItem('lum-style') === 'square' ? 'square' : 'round'; } catch { /* domyślnie zaokrąglony */ }

const S = { tabs: [], active: null, nextId: 1, near: false, search: false, settings: false, debugHover: false };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const startUrl = () => START + '?bg=' + encodeURIComponent(TH().page) + '&bar=' + barMode;
const isStart = (url) => !url || url.split('?')[0].split('#')[0] === START;
const shown = () => S.near || S.search || S.settings || S.debugHover;
// Karty widać, gdy pasek jest pokazany - także przy wpisywaniu w polu w miejscu plusa, ale nie przy Ctrl+L
const tabsVisible = () => shown() && !(S.search && S.searchTarget === 'current');
const tab = (id) => S.tabs.find((t) => t.id === (id == null ? S.active : id));

// Adres czy fraza? Ta sama logika jest w start.js.
//  - http(s)://... i about:blank -> otwórz
//  - localhost, poprawny IPv4 -> http://
//  - domena z końcówką z liter, ale nie nazwa pliku (node.js, index.html) -> https://
//  - inne schematy (file:, javascript: ...) -> nic (nie wysyłamy lokalnych ścieżek do wyszukiwarki)
//  - wszystko inne -> wyszukiwarka
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

/* ================= Karty ================= */
function createTab(url, focus = true) {
  const t = { id: S.nextId++, url: url || startUrl(), title: 'Nowa karta', favicon: null, loading: true, ready: false,
    focusNote: false, error: null, light: TH().light, color: null, colorLight: TH().light, el: null };
  const wv = document.createElement('webview');
  wv.setAttribute('partition', 'persist:lum');
  wv.setAttribute('allowpopups', '');                      // linki "w nowym oknie" -> nowa karta (main.js)
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
    t.url = e.url; t.error = null;
    if (isStart(t.url)) { t.title = 'Nowa karta'; t.favicon = null; }
    render(); sampleSoon(t);
  });
  wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) { t.url = e.url; render(); sampleSoon(t); } });
  wv.addEventListener('did-start-loading', () => { t.loading = true; if (t.id === S.active) progress(true); renderTabs(); });
  wv.addEventListener('did-stop-loading', () => { t.loading = false; if (t.id === S.active) progress(false); renderTabs(); updateNav(); sampleSoon(t); });
  wv.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3: przerwane (np. kolejna nawigacja)
    t.error = { url: e.validatedURL || t.url, desc: e.errorDescription || String(e.errorCode) };
    t.url = t.error.url; t.title = 'Nie udało się otworzyć strony'; t.favicon = null; t.loading = false;
    if (t.id === S.active) progress(false);
    render();
  });
  wv.addEventListener('console-message', (e) => { if (e.message === '__lum_scroll__') sampleSoon(t); });
  // Kliknięcie w stronę zamyka ustawienia i wyszukiwanie na pasku
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

// Na stronie głównej pole wyszukiwania jest zawsze gotowe do pisania i wklejania
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

// Pola wpisywania:
//  'new'     - plus / Ctrl+T: małe pole w miejscu plusa, karty zostają widoczne; karta powstaje dopiero po Enterze
//  'current' - Ctrl+L: pole na środku paska z adresem obecnej karty
const activeInput = () => (S.searchTarget === 'new' ? newInput : input);
function openSearch(target = 'new') {
  S.settings = false;
  S.searchTarget = target;
  // Bez drugiego migającego kursora w stronie
  const t = tab();
  if (t && t.ready) t.wv.executeJavaScript('document.activeElement && document.activeElement.blur()').catch(() => {});
  S.search = true;
  newInput.value = '';
  newField.classList.remove('typing');
  input.value = target === 'current' && t && !isStart(t.url) && !t.error ? t.url : '';
  render();
  setTimeout(() => { const el = activeInput(); el.focus(); el.select(); }, 30);
}

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

// Motyw zmienia się na miejscu, bez przeładowania i bez nowego wpisu w historii
function applyStartTheme(t) {
  t.wv.executeJavaScript('typeof lumTheme === "function" && lumTheme(' + JSON.stringify(TH().page) + ');' +
    'typeof lumBar === "function" && lumBar(' + JSON.stringify(barMode) + ')').catch(() => {});
  t.light = t.colorLight = TH().light;
  t.color = TH().page;
}
// Kolory motywu na pasku, w panelu i na ekranie błędu
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
  try { localStorage.setItem('lum-style', uiStyle); } catch { /* bez pamięci */ }
  render();
  track.ready = false; updateTrack(tabsVisible(), true); // linia od razu w nowym kształcie
}
function setBarMode(mode) {
  barMode = mode === 'fixed' ? 'fixed' : 'auto';
  try { localStorage.setItem('lum-bar', barMode); } catch { /* bez pamięci */ }
  // Strony główne dostają tryb od razu, żeby pole zostało w tym samym miejscu okna
  S.tabs.forEach((x) => { if (isStart(x.url) && x.ready) x.wv.executeJavaScript('typeof lumBar === "function" && lumBar(' + JSON.stringify(barMode) + ')').catch(() => {}); });
  render();
  setTimeout(() => { renderTabs(); sampleSoon(); }, 60); // strona zmienia rozmiar
}
function setTheme(next) {
  theme = normTheme(next);
  try { localStorage.setItem('lum-theme', theme); } catch { /* bez pamięci */ }
  S.tabs.forEach((x) => { if (isStart(x.url) && x.ready) applyStartTheme(x); });
  render();
}
// Własny kolor z pola koloru (zmienia się na żywo podczas wybierania)
function setCustomColor(c) {
  if (!/^#[0-9a-f]{6}$/i.test(c)) return;
  customColor = c;
  try { localStorage.setItem('lum-custom-color', c); } catch { /* bez pamięci */ }
  setTheme('custom');
}

/* ================= Rysowanie paska ================= */
const ICON_MOON = '<svg viewBox="0 0 120 120"><path d="M52.34 0.5 A60 60 0 1 0 119.5 67.67 A48 48 0 1 1 52.34 0.5 Z" fill="currentColor"/></svg>';
const ICON_GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16"/></svg>';
const ICON_X = '<svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3 3 9"/></svg>';

function render() { renderBar(); renderTabs(); updateTone(); renderError(); }

function labelFor(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      let path = (u.pathname === '/' ? '' : u.pathname) + u.search;
      try { path = decodeURIComponent(path); } catch { /* zostaje zakodowany */ }
      if (path.length > 70) path = path.slice(0, 68) + '…';
      return esc(u.host) + '<span class="path">' + esc(path) + '</span>';
    }
    return esc(u.protocol.replace(/:$/, ''));
  } catch {
    return esc(url);
  }
}

function renderBar() {
  const t = tab();
  bar.classList.toggle('show', shown());
  bar.classList.toggle('searching', S.search && S.searchTarget === 'current');
  bar.classList.toggle('adding', S.search && S.searchTarget === 'new');
  // Na nowej karcie napis Lum jest na środku strony, więc na pasku nie ma nic
  if (!t || isStart(t.url)) { labelEl.className = 'label'; labelEl.textContent = ''; }
  else { labelEl.className = 'label'; labelEl.innerHTML = labelFor(t.url); }
  panel.classList.toggle('open', S.settings);
  panel.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.theme === theme ? 'true' : 'false'));
  panel.querySelectorAll('[data-barmode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.barmode === barMode ? 'true' : 'false'));
  panel.querySelectorAll('[data-style]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.style === uiStyle ? 'true' : 'false'));
  document.body.classList.toggle('style-square', uiStyle === 'square');
  TK.r = uiStyle === 'square' ? 0 : 8;
  applyThemeChrome();
  document.body.classList.toggle('bar-auto', barMode === 'auto');
  document.body.classList.toggle('bar-fixed', barMode === 'fixed');
  document.body.classList.toggle('bar-shown', shown());
  updateNav();
}

// Karty są aktualizowane na miejscu (bez przebudowy), więc kliknięcia nie giną, a przejścia CSS działają.
function tabElement(t) {
  if (t.el) return t.el;
  const el = document.createElement('div');
  el.className = 'tab';
  el.setAttribute('role', 'tab');
  el.dataset.tab = t.id;
  el.innerHTML = '<span class="fav"></span><span class="t"></span><span class="x" data-close="' + t.id + '" title="Zamknij kartę (Ctrl+W, środkowy przycisk myszy)">' + ICON_X + '</span>';
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
  const avail = leftEl.clientWidth - tabsEl.offsetLeft + leftEl.offsetLeft - (plusBtn.offsetWidth || newField.offsetWidth) - 8;
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
  if (t && t.ready) { try { back = t.wv.canGoBack(); fwd = t.wv.canGoForward(); } catch { /* jeszcze się ładuje */ } }
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

// Pasek schowany: przezroczysty, kolor ikon według jasności strony.
// Pasek pokazany: nad linią kolor motywu przeglądarki, a wnętrze otwartej karty w kolorze,
// którego jest najwięcej u góry strony - karta wygląda jak przedłużenie strony.
function updateTone() {
  const t = tab(), on = shown();
  const themeLight = TH().light;
  let pageColor = TH().page, pageLight = themeLight;
  if (t && !t.error && t.color) { pageColor = t.color; pageLight = t.colorLight; }
  const solid = on || barMode === 'fixed';
  bar.classList.toggle('on-light', solid ? themeLight : !!(t && !t.error ? t.light : themeLight));
  tabFillPath.style.fill = pageColor;
  bar.style.setProperty('--tab-ink', pageLight ? '#16181B' : '#FFFFFF');
}

/* Linia otwartej karty: od lewej do prawej krawędzi okna, obejmuje otwartą kartę */
const track = { L: 0, R: 0, ready: false, timer: null };
// Góra karty, poziom linii (dół paska, więc przyciski są na środku między górą okna a linią), promień zaokrąglenia
const TK = { t: 6, b: 37, r: uiStyle === 'square' ? 0 : 8 };
// Linia zaczyna się u góry przy lewej krawędzi okna, schodzi w dół, biegnie do otwartej karty,
// obejmuje ją, biegnie dalej i przy prawej krawędzi wraca do góry - przechodzi w granicę okna.
function edgeStart() { const { b, r } = TK, x = 0.6; return 'M' + x + ' 0V' + (b - r) + 'Q' + x + ' ' + b + ' ' + (x + r) + ' ' + b; }
function edgeEnd() { const { b, r } = TK, x = bar.clientWidth - 0.6; return 'H' + (x - r) + 'Q' + x + ' ' + b + ' ' + x + ' ' + (b - r) + 'V0'; }
function trackD(L, R) {
  const { t, b, r } = TK;
  return edgeStart() + 'H' + (L - r) + 'Q' + L + ' ' + b + ' ' + L + ' ' + (b - r) + 'V' + (t + r) + 'Q' + L + ' ' + t + ' ' + (L + r) + ' ' + t +
    'H' + (R - r) + 'Q' + R + ' ' + t + ' ' + R + ' ' + (t + r) + 'V' + (b - r) + 'Q' + R + ' ' + b + ' ' + (R + r) + ' ' + b + edgeEnd();
}
// Kształt wnętrza otwartej karty (do linii) i pas nad linią z wyciętą kartą
function tabShape(L, R) {
  const { t, r } = TK, b = TK.b + 1;
  return 'M' + L + ' ' + b + 'V' + (t + r) + 'Q' + L + ' ' + t + ' ' + (L + r) + ' ' + t + 'H' + (R - r) + 'Q' + R + ' ' + t + ' ' + R + ' ' + (t + r) + 'V' + b + 'Z';
}
function setShapes(e) {
  const w = bar.clientWidth, rect = 'M0 0H' + w + 'V' + (TK.b + 1) + 'H0Z';
  if (!e) {
    trackPath.setAttribute('d', edgeStart() + edgeEnd());
    bandPath.setAttribute('d', rect);
    tabFillPath.setAttribute('d', 'M0 0Z');
    return;
  }
  trackPath.setAttribute('d', trackD(e.L, e.R));
  // Wycięcie na otwartą kartę tylko wtedy, gdy karty są pokazane; inaczej pasek jest jednolity
  bandPath.setAttribute('d', tabsVisible() ? rect + tabShape(e.L, e.R) : rect);
  tabFillPath.setAttribute('d', tabShape(e.L, e.R));
}
// Krawędzie otwartej karty w oknie; przycięte do widocznej części paska kart. Gdy karty nie widać: null (sama prosta linia).
function activeEdges() {
  const a = tabsEl.querySelector('.tab.active');
  if (!a) return null;
  const minL = tabsEl.offsetLeft, maxR = tabsEl.offsetLeft + tabsEl.clientWidth;
  let L = a.offsetLeft - tabsEl.scrollLeft, R = L + a.offsetWidth;
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

/* ================= Kolor i jasność górnej krawędzi strony ================= */
// Sprawdzane tylko wtedy, gdy coś się zmieniło: wczytanie, nawigacja, przewinięcie, zmiana karty.
// Do tego rzadki zapas co 4 s dla stron, które zmieniają się same (tylko gdy okno jest aktywne).
function sample(t) {
  t = t || tab();
  if (!t || !t.ready || t.error || document.hidden) return;
  let id;
  try { id = t.wv.getWebContentsId(); } catch { return; }
  // Kolor karty: pas wokół otwartej karty (z zapasem po bokach), jasność: cała szerokość
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

/* ================= Zdarzenia ================= */
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

// Środkowy przycisk myszy (kółko) zamyka kartę
tabsEl.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
tabsEl.addEventListener('auxclick', (e) => {
  if (e.button !== 1) return;
  const tb = e.target.closest('[data-tab]');
  if (tb) { e.preventDefault(); closeTab(Number(tb.dataset.tab)); }
});
// Gdy kart jest za dużo, kółko myszy przewija pasek kart
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
// Kliknięcie obok pola zamyka je (bez tworzenia karty); lupa w polu nie zabiera fokusu
input.addEventListener('blur', () => setTimeout(() => { if (S.search && document.activeElement !== input) closeSearch(); }, 120));
document.querySelector('.sbox [data-act=submit]').addEventListener('mousedown', (e) => e.preventDefault());
// To samo dla małego pola w miejscu plusa
newInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submit(newInput.value); }
  else if (e.key === 'Escape') closeSearch();
});
// Lupa obok pola pokazuje się dopiero, gdy coś wpiszesz (jak na stronie głównej)
newInput.addEventListener('input', () => newField.classList.toggle('typing', newInput.value.trim().length > 0));
// Powrót do okna na stronie głównej: kursor od razu w polu wyszukiwania
window.addEventListener('focus', () => setTimeout(focusHomeField, 30));
newInput.addEventListener('blur', () => setTimeout(() => { if (S.search && S.searchTarget === 'new' && document.activeElement !== newInput) closeSearch(); }, 120));
newField.querySelector('[data-act=addgo]').addEventListener('mousedown', (e) => e.preventDefault());

// Przesuwanie okna: systemowe (CSS -webkit-app-region: drag na pustym pasku), więc działa
// przyklejanie do krawędzi i narożników ekranu, Win+strzałki i dwuklik = maksymalizuj.
$('customColor').addEventListener('input', (e) => setCustomColor(e.target.value));

// Pasek pokazuje się dopiero przy samej górnej krawędzi (żeby nie zasłaniać strony przy zwykłym klikaniu u góry)
// i zostaje, dopóki kursor jest w okolicy paska.
window.lum.on('zone', (zone) => {
  // Chowany: pasek pojawia się, gdy kursor wejdzie w jego (niewidoczny) obszar, i zostaje tuż pod nim.
  // Zawsze widoczny: karty pokazują się, gdy kursor jest na pasku.
  const onBar = zone === 'edge' || zone === 'bar';
  const near = barMode === 'fixed' ? onBar : (onBar || (S.near && zone === 'near'));
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
  else if (c === 'search') openSearch('current');
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
