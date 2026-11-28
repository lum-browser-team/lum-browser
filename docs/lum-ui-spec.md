# Lum UI – spec for Claude

> For Claude working on Lum (e.g. on Bartek's machine). Describes **how the browser should look and behave**.
> UI design: **olehnykorovych** (entirely). The name "Lum": Savio. See [`../AUTHORS.md`](../AUTHORS.md).
>
> **The source of truth is the working mockup Lum Preview, [`../ui-preview/`](../ui-preview/)** (Electron): run `ui-preview/Lum.cmd`
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
| **Full** | Like Always visible (bar in the theme color, page below it), but **the tabs and the line are always visible**, not only on hover. The address in the middle fades out as usual (it comes back near the cursor); to copy a page's link, right-click its tab → *Copy link*. |

Shade gradient (top → bottom): `rgba(0,0,0,.7)` → `.6` at 30% → `.34` at 55% → `.12` at 78% → transparent.
"At the top" comes from a scroll hook in an isolated JS world (the page cannot see it), sent only when it changes. The new tab field stays in the same window position in all bar modes.

While the bar is shown, the page under it ignores clicks (so they reach the buttons).

### Layout from the left

**All bar buttons are equal 38 × 38 px squares** over the full bar height, touching each other (no gaps), so the whole area
around an icon is clickable; the bar has no side padding, so the first button (back) reaches the left window edge and the
last one (close) the right edge. Icons keep their size inside the squares.

1. **Back / Forward**: curved "<" and ">" (19 px icon, 1.7 px stroke, round caps).
   SVG paths (viewBox 24): back `M15.5 5.5C13.2 8.4 10.6 10.2 7.5 12C10.6 13.8 13.2 15.6 15.5 18.5`,
   forward `M8.5 5.5C10.8 8.4 13.4 10.2 16.5 12C13.4 13.8 10.8 15.6 8.5 18.5`. Disabled: opacity 0.3.
2. **Reload**: circular arrow (17 px icon).
3. **Tabs** (only while the bar is shown) – right next to reload.
4. **Plus** after the last tab.

In the middle: the **page address** (13 px; host in full color, path at 60% opacity, path decoded, e.g. `en.wikipedia.org/wiki/Café`).
On a new tab the middle is empty. When the tabs appear, the address fades out in 0.2 s (and comes back in 0.7 s) –
**unless the cursor is near it** (within 60 px): then it stays and works like an address bar that looks like plain text:
click places the caret where you click, drag selects, typing edits it; **Enter** opens it in this tab, **Esc** or a click
outside restores it. While editing, the text has one color (no dimmed path) and the bar stays shown.
The text does not move when you click it (the edit field sits exactly on top of the label, same font and position).
The edit field is 60 px longer than the text on both sides: a click past the end puts the caret at the end, before the start
at the start, so dragging from just past one end to just past the other selects the whole address.
Tabs and buttons always lie above the address, so it never blocks clicks on them.

On the right: **settings** (two-sliders icon, 1.4 stroke) and the **window buttons** (38 × 38 px squares like the rest):

| Style | Minimize | Maximize | Close |
|---|---|---|---|
| Round | arc down, green `#3DDC84` | arc up, yellow `#F5C542` | circle, red `#FF5F57` |
| Square | — green | □ yellow | ✕ red |

On a light background the colors are darker: `#16A34A`, `#C98A00`, `#E5483E`. In both styles the buttons have the same size and position.
**Window buttons setting: Colored / Plain.** Plain turns the colors off: the window buttons use the same color as the other icons
(and the same neutral hover glow).

### Tabs

- Height 26 px, width up to 190 px (they shrink with many tabs, min. 36 px). No background and no border.
- Content: 15 px favicon + 12 px title (500). Inactive tabs dimmed (68%), full on hover.
- The close cross appears on tab hover. Closing also with the middle mouse button and Ctrl+W.
- **Right click on a tab**: a small menu (same look as the settings panel) – *Copy link* (copies the tab's full URL, a short
  "Link copied" message appears under the bar; disabled on the new tab page), *Show QR code* and *Close tab*.
  Esc or a click outside closes it.
- **Show QR code**: a centered dialog over a dimmed, slightly blurred window – title "Scan to open on your phone", the QR code of the
  tab's link on a white rounded square (220 px), the link below it, buttons *Copy link* and *Done*. Esc, *Done* or a click outside closes it.
  Only for http(s) pages.
- **Drag a tab sideways to move it**: after 5 px of movement the tab follows the cursor (no transition), the others make room;
  it swaps places with a neighbor once it passes that neighbor's middle. The dragged tab becomes the open one and the line
  follows it. On release it settles into its slot (0.18 s). A press without moving is a normal click.
  While dragged, the tab is a **solid layer on top**: an opaque background in the tab color down to the line, its outline
  and a soft shadow – the tabs it passes over never show through it.
- Very many tabs (less than ~110 px per tab): icons only, the cross replaces the icon on hover.
  When out of space, the tab strip scrolls horizontally with the mouse wheel; the plus is always visible;
  at least 120 px of free space stays on the right for grabbing the window.
- Appearing: each tab slides in slightly from the left (10 px) and fades in, 0.8 s, each next one delayed by 45 ms.

### Open tab line (the key element)

A thin line (~40% of the icon color) starts **at the top of the left window edge**, goes down, runs
horizontally at 37 px, **wraps around the open tab** (goes up to 6 px around it), continues and
**goes back up at the right edge** – it becomes the window border. On tab switch the line slides smoothly (0.42 s).
It appears later and slower than the tabs: 0.55 s delay, drawn from the left over 2 s.
The parts that run **up the window edges** (from the corner curves to the top) are drawn separately and much fainter
(30 % of the line's opacity), so they read as the window's own border, not as a light stripe.
**Crisp on any screen scaling:** the line is a whole number of screen pixels thick (1.2 CSS px rounded to device pixels:
1 px at 100%, 2 px at 125–150%) and its straight parts lie on the device pixel grid, so it never smears across two pixels.
Its position follows the tab element exactly (a regression once moved it 10 px off the tab – keep a test for it).

Geometry (px): tab top `t=6`, line level `b=37`, corner radius `r=8` (Round style) or `r=0` (Square).
The open tab's color fills everything the line wraps, **including the outward curves at its bottom corners** (where the
line bends from the tab's side into the baseline), so the tab flows into the page without theme-colored notches. The same goes for **everything below the line** inside
the bar: the curved pockets at the window corners and the strip right under the line left and right of the tab have the
page color. The theme color is strictly above the line (it must not show as a light sliver under it).

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
| Mint / Sky | `#CFEBDD` / `#CFE3F3` | dark |
| Lavender / Rose | `#DCD3F2` / `#F3D3DE` | dark |
| Custom | any, from the color picker | by lightness (threshold 0.55) |

10 choices in two rows of 5: the five grays on top; four pastels + the custom color picker below.

### Settings – the look will differ from the mockup

**The settings panel in the mockup is temporary.** In the real browser the settings will look different –
olehnykorovych will design them separately. Do not recreate the panel look from `ui-preview/`.

The mockup's options are what exists today; the final settings may be different overall, and some of these may stay
or change – ask olehnykorovych before building the settings page. What the mockup offers (all remembered):
- **Theme** – the colors from the table above + a custom color.
- **Style** – Round / Square.
- **Window buttons** – Colored / Plain.
- **Bar** – Hidden / Clear / Always visible / Full.

Whatever the settings end up looking like, the **behavior** of these modes (described above) is the design to follow.

The icon that opens settings (two sliders) stays on the bar, left of the window buttons.

## Buttons – feedback

- Hover: no borders or backgrounds; the icon brightens to 100% and glows slightly (`drop-shadow(0 0 3px)` in its color), 0.45 s transition.
- Click: press down to 80% (0.08 s), springy return, a short icon flash.
- Square style: no rounding in bar elements (buttons, tabs, line).

## Other

- **Scrollbar** on pages: thin (10 px), rounded thumb, semi-transparent gray, no arrows.
- **Page failed to open**: instead of a black page, the message "Couldn't open the page" + the address + a "Try again" button, in the theme color.
- **"New window" links** open a new tab, but only right after a user click (a page cannot open tabs on its own).
- **Downloads** go straight to the system Downloads folder: no "Save as" dialog and nothing shown (no download bar or bubble).
  An existing name gets " (1)", " (2)"…
- **Built-in ad and tracker blocking** with **uBlock Origin's filter lists** (uBO filters, privacy, badware, quick fixes, unbreak)
  plus EasyList, EasyPrivacy and Peter Lowe's list – network blocking and cosmetic filtering (hidden ad boxes).
  In the mockup the engine is `@ghostery/adblocker-electron` (the real uBlock Origin extension cannot run fully in Electron).
  The compiled engine is cached in the profile and the lists are refreshed in the background every 7 days.
  **To agree:** refreshing the lists means requests to `ublockorigin.github.io`, `easylist.to` and `pgl.yoyo.org`, which touches
  rule no. 1 in `CLAUDE.md` (no network requests without consent) – e.g. ship the lists with each release, or ask once.
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
- Clear mode "docking": change the web contents' top inset (like toggling the toolbar in fullscreen) based on the page's
  scroll position at the top; animate it, and keep the hysteresis for barely scrollable pages.
- Editable address: the omnibox, styled as plain centered text (host bright, path dimmed) until it gets focus.
- Tab context menu: Chromium's tab context menu, reduced to *Copy link*, *Show QR code* and *Close tab* (plus our look).
- QR code: Chromium already has a QR code generator for the current page (the "Create QR code" bubble) – reuse it in our dialog.
- Tab dragging: Chromium's tab strip already supports drag to reorder; keep it in our simplified strip (no tearing a tab out
  into a new window unless we decide so).
- Downloads: prefs `download.prompt_for_download = false` and the default directory = the user's Downloads folder; hide the
  download bubble / bar (patch or flag).
- Ad blocking: preferably bundle **uBlock Origin** itself (check whether our Chromium base still runs MV2 extensions –
  ungoogled-chromium has flags for it); otherwise uBlock Origin Lite (MV3) or a built-in engine with the same lists.
  Pre-install it so it works on first start, with the lists shipped in the build.

## Changelog (newest first)

Kept so Claude on the other machine can see what changed since it last read this file.

- **2026-11-28**
  - Built-in ad and tracker blocking with uBlock Origin's filter lists (see Other).
  - Downloads go straight to the Downloads folder, no dialog, nothing shown.
  - Tabs can be dragged to reorder them; the dragged tab is a solid layer on top (nothing shows through it).
  - Tab menu: *Show QR code* (dialog with the QR of the tab's link, to open the page on a phone).
  - The line's parts along the window edges are faint (no light stripe at the window edges).
  - The address field is 60 px longer than the text on both sides (easy to select the whole address).
  - All bar buttons are equal 38 × 38 squares over the full bar height (bigger click areas, reaching the window edges).
  - New setting **Window buttons: Colored / Plain**.
  - Settings panel tidied (colors in even columns, equal section spacing).
  - The mockup is now called **Lum Preview** (window title, menu, `Lum Preview.exe`). The real browser stays **Lum**.
  - Build it with `npm run pack` in `ui-preview/`. Running from the source uses its own profile (`Lum Preview (dev)`).
  - Theme colors cut to 10 (two rows of 5): Peach and Lemon removed; a saved Peach/Lemon theme falls back to Black.
  - The line around the open tab follows the tab exactly again and is crisp on any screen scaling.
  - Everything below the line inside the bar has the page color (tab curves, window corner pockets, the strip under the line);
    the theme color is only above the line.
  - New bar mode **Full** (tabs and line always visible). Right click on a tab: *Copy link* / *Close tab*.
  - The address in the middle of the bar is editable when the cursor is near it (click, select, type, Enter, Esc; Ctrl+L selects all).
  - New bar mode **Clear** (transparent bar; page below the bar at the very top, under it with a dark shade when scrolled).
  - The settings panel layout is temporary; the bar options grew to four modes.
  - Everything in the mockup and the repo is in English (UI strings, comments, docs).
  - Tab color is sampled only after the page has really loaded (load + fonts + a painted frame), never while loading.

