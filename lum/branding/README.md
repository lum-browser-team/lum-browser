# Lum branding

- `logo/` - logo sources (SVG) and `preview.html` with a preview.
- `overlay/` - ready icons (PNG/ICO) laid out like in `build/src`. `build.py` copies them over
  the matching Chromium files after the patches are applied (the `# LUM:` block with `_apply_lum_overlay`).
  Only files that exist in the source are replaced; a missing path (e.g. after a Chromium
  update) gives a `LUM overlay: ... skipped` warning in the build log.
- `generate_icons.py` - generates `overlay/` from the SVGs (renders with headless Edge/Chrome,
  no extra libraries). After every logo change:

      python3 lum/branding/generate_icons.py

Binary icons cannot be in `.patch` files, so they go through `overlay/`.
The browser name and other text changes are still done with patches in `lum/patches/branding/`.

## What gets replaced

| File in Chromium | Source |
|---|---|
| `chrome/app/theme/chromium/win/chromium.ico` (.exe icon, taskbar; 16-256 px) | 16-32 px: `lum-favicon.svg`, 48-256 px: `lum-mark-round.svg` |
| `chrome/app/theme/chromium/product_logo_*.png` | same as above |
| `chrome/app/theme/default_{100,200}_percent/chromium/product_logo_{16,32}.png` | same as above |
| `chrome/app/theme/chromium/win/tiles/{Logo,SmallLogo}.png` (Start menu tiles) | `lum-mark-round.svg` |
