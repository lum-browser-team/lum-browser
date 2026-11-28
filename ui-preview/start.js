'use strict';
// Nowa karta Lum: pole jak notatka. Fraza -> wyszukiwarka, adres -> strona.
const SEARCH = 'https://www.google.com/search?q=';

// Kolor tła z przeglądarki (?bg=#rrggbb, ustawiane też na żywo przez lumTheme()).
// Tekst: jasny na ciemnym tle, ciemny (w odcieniu tła) na jasnym.
function lumTheme(bg) {
  if (!/^#[0-9a-f]{6}$/i.test(bg || '')) bg = '#000000';
  const r = parseInt(bg.slice(1, 3), 16), g = parseInt(bg.slice(3, 5), 16), b = parseInt(bg.slice(5, 7), 16);
  const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
  const root = document.documentElement.style;
  root.setProperty('--bg', bg);
  root.setProperty('--text', light ? 'color-mix(in srgb, ' + bg + ' 12%, #141518)' : 'color-mix(in srgb, ' + bg + ' 8%, #F2F2F4)');
  root.setProperty('color-scheme', light ? 'light' : 'dark');
}
lumTheme(new URLSearchParams(location.search).get('bg'));

const note = document.getElementById('note');
const nin = document.getElementById('nin');

// Ta sama logika co classify() w renderer.js
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

function go() {
  const c = classify(nin.value);
  if (c && c.kind !== 'blocked') location.href = c.url;
}

nin.addEventListener('input', () => {
  const c = classify(nin.value);
  note.classList.toggle('typing', !!c && c.kind !== 'blocked');
  note.classList.toggle('is-link', !!c && c.kind === 'url');
});
nin.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
document.getElementById('act').addEventListener('click', go);

// Pole jest zawsze gotowe: pisanie i wklejanie w dowolnym miejscu strony trafia do pola,
// kliknięcie gdziekolwiek ustawia w nim kursor.
function focusField() { if (document.activeElement !== nin) { nin.focus(); const n = nin.value.length; nin.setSelectionRange(n, n); } }
document.addEventListener('keydown', (e) => {
  if (document.activeElement === nin) return;
  const paste = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v';
  if (paste || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) focusField();
}, true);
document.addEventListener('paste', (e) => {
  if (e.target === nin) return;
  const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
  if (!text) return;
  e.preventDefault();
  focusField();
  nin.setRangeText(text, nin.selectionStart, nin.selectionEnd, 'end');
  nin.dispatchEvent(new Event('input'));
});
document.addEventListener('mousedown', (e) => { if (e.target !== nin && !e.target.closest('#act')) { e.preventDefault(); focusField(); } });
window.addEventListener('focus', () => setTimeout(focusField, 0));
focusField();

// Tryb paska z przeglądarki (?bar=fixed albo na żywo przez lumBar()): przy pasku zawsze widocznym
// strona jest niższa o 38 px, więc pole przesuwamy o 19 px w górę - zostaje w tym samym miejscu okna.
function lumBar(mode) { document.documentElement.style.setProperty('--lift', mode === 'fixed' ? '19px' : '0px'); }
lumBar(new URLSearchParams(location.search).get('bar'));
