# Lum UI – spec for Claude

> For Claude working on Lum (e.g. on Bartek's machine). Describes **how the browser should look and behave**.
> UI design: **olehnykorovych** (entirely). The name "Lum": Savio. See [`../AUTHORS.md`](../AUTHORS.md).
>
> **The source of truth is the working mockup [`../ui-preview/`](../ui-preview/)** (Electron): run `ui-preview/Lum.cmd`
> and compare. The values below come from its code (`style.css`, `renderer.js`, `start.html`). If this document
> and the mockup differ, the mockup is right; fix this file then.
> Task: recreate this UI in Chromium with patches in `lum/patches/ui/` (rules in `CLAUDE.md`).

## General rules

- Minimalism: only a 38 px bar at the top, no Chrome-style tab strip, no address bar as a field, no "three dots" menu.
- Window without the system frame (own title bar), but with system behavior: dragging by an empty spot on the bar,
  snapping to edges and corners (Aero Snap), Win+arrows, double-click = maximize.
- Everything smooth: appearing and disappearing are 0.2–2 s transitions, nothing "jumps in".
- Lightness: animations only via CSS/compositor, no timers running without a need.

## Bar (38 px)

### Modes ("Bar" setting, Hidden by default)

| Mode | Behavior |
|---|---|
| **Hidden** | The page fills the whole window. The bar is invisible (opacity 0, does not catch clicks). When the cursor enters the bar area (top 38 px of the window, also a few px above the window), the bar appears; it stays while the cursor is within 80 px of the top; further down it disappears. |
| **Clear** | The bar never hides and **stays transparent** (no theme color, also on hover). **Page scrolled to the very top:** the page starts **below the bar** (like Always visible), so the page's own top buttons do not collide with ours; the bar sits on the theme color. **Scrolled down:** the page moves up and runs **under the bar**, with a **dark shade** behind it (84 px, fading into the page) and light icons. Switching between the two: the page's top/height animate over 0.22 s, the shade fades. A page that is barely scrollable (≤ 40 px) stays below the bar, so it does not flip back and forth. Lum's own pages (new tab, error screen) stay full-window without a shade. On hover **nothing about the shade changes** (no blur, no extra darkening, icons keep their halo) – only the tabs and the line are drawn in. |
| **Always visible** | The bar is always visible in the theme color, the page starts **below it** (it does not overlap page buttons, e.g. on YouTube). Tabs and the line appear on bar hover. |

Shade gradient (top → bottom): `rgba(0,0,0,.7)` → `.6` at 30% → `.34` at 55% → `.12` at 78% → transparent.
"At the top" comes from a scroll hook in an isolated JS world (the page cannot see it), sent only when it changes. The new tab field stays in the same window position in all three modes.

While the bar is shown, the page under it ignores clicks (so they reach the buttons).

### Layout from the left

1. **Back / Forward**: curved "<" and ">" (19 px icon in a 32 px box, 1.7 px stroke, round caps).
   SVG paths (viewBox 24): back `M15.5 5.5C13.2 8.4 10.6 10.2 7.5 12C10.6 13.8 13.2 15.6 15.5 18.5`,
   forward `M8.5 5.5C10.8 8.4 13.4 10.2 16.5 12C13.4 13.8 10.8 15.6 8.5 18.5`. Disabled: opacity 0.3.
2. **Reload**: circular arrow (17 px in a 30 px box).
3. **Tabs** (only while the bar is shown) – right next to reload.
4. **Plus** after the last tab.

In the middle: the **page address** (13 px; host in full color, path at 60% opacity, path decoded, e.g. `en.wikipedia.org/wiki/Café`).
On a new tab the middle is empty. When the tabs appear, the address fades out in 0.2 s (and comes back in 0.7 s) –
**unless the cursor is near it** (within 40 px): then it stays and works like an address bar that looks like plain text:
click places the caret where you click, drag selects, typing edits it; **Enter** opens it in this tab, **Esc** or a click
outside restores it. While editing, the text has one color (no dimmed path) and the bar stays shown.
The text does not move when you click it (the edit field sits exactly on top of the label, same font and position).
Tabs and buttons always lie above the address, so it never blocks clicks on them.

On the right: **settings** (two-sliders icon, 1.4 stroke) and the **window buttons** (each 28×28 px, packed, no gap):

| Style | Minimize | Maximize | Close |
|---|---|---|---|
| Round | arc down, green `#3DDC84` | arc up, yellow `#F5C542` | circle, red `#FF5F57` |
| Square | — green | □ yellow | ✕ red |

On a light background the colors are darker: `#16A34A`, `#C98A00`, `#E5483E`. In both styles the buttons have the same size and position.

### Tabs

- Height 26 px, width up to 190 px (they shrink with many tabs, min. 36 px). No background and no border.
- Content: 15 px favicon + 12 px title (500). Inactive tabs dimmed (68%), full on hover.
- The close cross appears on tab hover. Closing also with the middle mouse button and Ctrl+W.
- Very many tabs (less than ~110 px per tab): icons only, the cross replaces the icon on hover.
  When out of space, the tab strip scrolls horizontally with the mouse wheel; the plus is always visible;
  at least 120 px of free space stays on the right for grabbing the window.
- Appearing: each tab slides in slightly from the left (10 px) and fades in, 0.8 s, each next one delayed by 45 ms.

### Open tab line (the key element)

A thin line (1.2 px, ~40% of the icon color) starts **at the top of the left window edge**, goes down, runs
horizontally at 37 px, **wraps around the open tab** (goes up to 6 px around it), continues and
**goes back up at the right edge** – it becomes the window border. On tab switch the line slides smoothly (0.42 s).
It appears later and slower than the tabs: 0.55 s delay, drawn from the left over 2 s.

Geometry (px): tab top `t=6`, line level `b=37`, corner radius `r=8` (Round style) or `r=0` (Square).

### Bar colors when shown

- **Above the line**: the browser theme color (the same as the new tab background).
- **Inside of the open tab** (the area wrapped by the line): the most common color at the top of the page in a strip around this tab
  (sample of the top ~64 px of the page, ±60 px on the tab's sides). The tab looks like an extension of the page; its text is light or dark depending on that color.
- The page starts below the line.

In Hidden mode nothing is drawn while the bar is invisible. Icon/text color on the bar: light on dark, dark on light.

### Plus and input fields

- **Plus** (and Ctrl+T): does not create a tab right away. A "Type something or paste a link…" field appears in its place,
  looking like the new tab field (no background or border, thin 14 px/300 text). Tabs stay visible.
  The magnifier appears in the field only while typing. **Enter** opens a new tab, **Esc** or a click outside closes the field without a tab.
- **Ctrl+L**: selects the whole address on the bar (see above); on the new tab page it opens a search field in the middle of the bar. Enter opens in this tab.
- Detection: `http(s)://…`, `localhost[:port]`, valid IPv4 and domains with a letter TLD → page;
  file names (`node.js`, `index.html`) and the rest → search engine; other schemes (`file:`, `javascript:`) → nothing.

## New tab (start page)

- Background = theme color. Only one "Type something or paste a link…" field (26 px, weight 300), **exactly in the middle of the window**,
  in the same spot in all bar modes. No logo and no Lum wordmark.
- While typing: a magnifier (phrase) or an arrow (link) on the right + hint "Enter search" / "Enter open page".
- The field is always ready: focused when the tab opens, when coming back to the tab and to the window; typing or Ctrl+V anywhere goes into the field.
- A shortcut footer at the bottom (12 px): Ctrl+T new tab · Ctrl+L search · Ctrl+W close tab.
- Text colors derived from the background (`color-mix`): placeholder ~50%, icons ~68%, footer ~46% of the text color.

## Themes ("Theme" setting)

The bar above the line and the new tab background share one color:

| Theme | Color | Icons/text |
|---|---|---|
| Black (default) | `#000000` | light |
| Graphite | `#1C1D20` | light |
| Gray | `#3A3B40` | light |
| Light gray | `#DFE0E3` | dark |
| White | `#FAFAFA` | dark |
| Mint / Sky / Lavender | `#CFEBDD` / `#CFE3F3` / `#DCD3F2` | dark |
| Rose / Peach / Lemon | `#F3D3DE` / `#F6D9C7` / `#F3EDC4` | dark |
| Custom | any, from the color picker | by lightness (threshold 0.55) |

### Settings – the look will differ from the mockup

**The settings panel in the mockup is temporary.** In the real browser the settings will look different –
olehnykorovych will design them separately. Do not recreate the panel look from `ui-preview/`.

Only the **options** and their behavior are binding (all remembered):
- **Theme** – the colors from the table above + a custom color.
- **Style** – Round / Square.
- **Bar** – Hidden / Clear / Always visible.

The icon that opens settings (two sliders) stays on the bar, left of the window buttons.

## Buttons – feedback

- Hover: no borders or backgrounds; the icon brightens to 100% and glows slightly (`drop-shadow(0 0 3px)` in its color), 0.45 s transition.
- Click: press down to 80% (0.08 s), springy return, a short icon flash.
- Square style: no rounding in bar elements (buttons, tabs, line).

## Other

- **Scrollbar** on pages: thin (10 px), rounded thumb, semi-transparent gray, no arrows.
- **Page failed to open**: instead of a black page, the message "Couldn't open the page" + the address + a "Try again" button, in the theme color.
- **"New window" links** open a new tab, but only right after a user click (a page cannot open tabs on its own).
- **Shortcuts**: Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab, Ctrl+Shift+Tab, F5/Ctrl+R, Alt+←/→.
- **Search engine**: Google in the mockup (the designer's wish), but rule no. 1 in `CLAUDE.md` says "zero Google services".
  **To be agreed between the co-founders** before release.

## Chromium hints (to verify in `build/src`, not ready-made solutions)

- Own frame and bar: the browser frame view on Windows (custom frame / non-client view) with a caption area (`HTCAPTION`),
  so window snapping works; window buttons drawn by us.
- Hidden mode resembles the toolbar reveal in fullscreen mode (reveal at the top edge) – page in the full window, bar over it.
- Tabs and toolbar: a simplified tab strip + toolbar in a single 38 px row; the line around the active tab as custom painting.
- Active tab inside color: from the page color (e.g. `theme-color` or a sample of the last frame) – cheap, only on page change/scroll.
  **While loading and reloading the previous color stays**; the new one is sampled only when the page is ready
  (`load` event, fonts loaded, a frame painted) and once more a moment later – never from a blank, unloaded page.
- New tab: our own local page (WebUI) instead of the default one, with no network requests.
- Scrollbar: overlay style or our own `NativeTheme`.
- Theme colors via Chromium's theme mechanism (frame/toolbar colors), not via an extension.
