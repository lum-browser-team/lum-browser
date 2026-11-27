# Branding Lum

- `logo/` - źródła logo (SVG) i `preview.html` z podglądem.
- `overlay/` - gotowe ikony (PNG/ICO) ułożone tak jak w `build/src`. `build.py` kopiuje je na
  odpowiednie pliki Chromium po nałożeniu łatek (blok `# LUM:` z `_apply_lum_overlay`).
  Podmieniane są tylko pliki, które istnieją w źródle; brakująca ścieżka (np. po aktualizacji
  Chromium) daje ostrzeżenie `LUM overlay: ... skipped` w logu kompilacji.
- `generate_icons.py` - generuje `overlay/` z SVG (renderuje przez Edge/Chrome headless,
  bez dodatkowych bibliotek). Po każdej zmianie logo:

      python3 lum/branding/generate_icons.py

Ikony binarne nie mogą być w łatkach `.patch`, dlatego idą przez `overlay/`.
Nazwę przeglądarki i inne zmiany tekstowe nadal robimy łatkami w `lum/patches/branding/`.

## Co jest podmieniane

| Plik w Chromium | Źródło |
|---|---|
| `chrome/app/theme/chromium/win/chromium.ico` (ikona .exe, pasek zadań; 16-256 px) | 16-32 px: `lum-favicon.svg`, 48-256 px: `lum-mark-round.svg` |
| `chrome/app/theme/chromium/product_logo_*.png` | j.w. |
| `chrome/app/theme/default_{100,200}_percent/chromium/product_logo_{16,32}.png` | j.w. |
| `chrome/app/theme/chromium/win/tiles/{Logo,SmallLogo}.png` (kafelki menu Start) | `lum-mark-round.svg` |
