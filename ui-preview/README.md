# Lum Preview – browser mockup

**UI design: entirely by olehnykorovych.** The name "Lum": Savio. Details in [`../AUTHORS.md`](../AUTHORS.md).

**Lum Preview** is a working mockup (a mini browser on Electron) that shows how Lum should look and behave
on real websites. It is the **reference for the real browser** (the Chromium fork in this repo),
not the target browser itself. The look and behavior to port to Chromium are described in
[`../docs/lum-ui-spec.md`](../docs/lum-ui-spec.md).

## Running

Double-click `Lum.cmd` (the first run installs dependencies, about 100 MB) or:

    cd ui-preview
    npm install
    npm start

## What the mockup has

- A 38 px bar with four modes: **Hidden** (disappears, comes back when the cursor reaches its area at the top
  of the window), **Clear** (never hides and stays transparent; at the very top the page starts below the bar,
  scrolled down it runs under the bar with a dark shade behind it) **Always visible** (the page starts below the bar) and **Full** (like Always visible, with the tabs always shown).
- On hover: tabs next to reload; a line from the left window edge (from the top) wraps around the open tab
  and goes back up at the right edge. Theme color above the line, the open tab's inside in the page color.
- Plus: a "Type something or paste a link…" field appears in its place, a new tab opens on Enter.
- New tab: a search field in the middle of the window, always ready for typing and pasting.
- Buttons: back, forward (curved arrows), reload, settings, window buttons
  (arcs in the round style, — □ ✕ in the square style, same colors).
- Settings: 5 grays, 4 pastels, custom color (two rows of 5); Round/Square style; bar mode.
  The settings panel look is temporary – the real browser will have a different one (separate design).
- Right click on a tab: Copy link, Close tab.
- Closing a tab: the cross on hover, middle mouse button, Ctrl+W. Many tabs: tabs shrink,
  icons only, scrolling with the wheel.
- A thin, rounded scrollbar on pages.
- The address in the middle of the bar: move the cursor near it to click, select or edit it (Enter opens, Esc cancels).
- Shortcuts: Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab, Ctrl+Shift+Tab, F5, Alt+←/→, F12 (dev tools).

Search engine in the mockup: Google (`SEARCH` in `renderer.js` and `start.js`).
Pages get no access to the camera, microphone, location or notifications.

## Files

- `main.js` – window, shortcuts, reading the cursor near the top edge, sampling the page color.
- `renderer.js`, `index.html`, `style.css` – bar, tabs, settings.
- `start.html`, `start.js` – new tab page.
- `tests/` – test scripts (Playwright + Electron).

## Checking without clicking

`LUM_SNAPSHOT=file.png` saves a window screenshot after a few seconds and quits the app.
`LUM_OPEN=url1,url2` opens tabs, `LUM_SNAPSHOT_HOVER=1` shows the bar as if hovered,
`LUM_EVAL="code"` runs code in the UI (e.g. `setTheme('mint')`).

## Packaged app (Lum Preview.exe)

    npm run pack

Output: `dist/Lum Preview-win32-x64/Lum Preview.exe` (the whole folder is needed, about 360 MB, since it contains Electron/Chromium).
`npm run pack -- <folder>` writes it to another folder.
