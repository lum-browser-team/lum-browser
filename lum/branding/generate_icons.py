#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generates the Lum icons (PNG + ICO) from the SVG files in lum/branding/logo/
into lum/branding/overlay/, which build.py copies over build/src.

Renders with a headless browser (Edge or Chrome), with no extra
Python libraries. Run it after every logo change:

    python3 lum/branding/generate_icons.py
"""

import base64
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_LOGO = _HERE / 'logo'
_OVERLAY = _HERE / 'overlay'

# Small sizes: flat version without shadows (legible). Larger: the full round badge.
_SMALL_SVG = _LOGO / 'lum-favicon.svg'
_LARGE_SVG = _LOGO / 'lum-mark-round.svg'

# Path in build/src -> size in px
_PNGS = {
    'chrome/app/theme/chromium/product_logo_16.png': 16,
    'chrome/app/theme/chromium/product_logo_24.png': 24,
    'chrome/app/theme/chromium/product_logo_32.png': 32,
    'chrome/app/theme/chromium/product_logo_48.png': 48,
    'chrome/app/theme/chromium/product_logo_64.png': 64,
    'chrome/app/theme/chromium/product_logo_128.png': 128,
    'chrome/app/theme/chromium/product_logo_256.png': 256,
    'chrome/app/theme/default_100_percent/chromium/product_logo_16.png': 16,
    'chrome/app/theme/default_100_percent/chromium/product_logo_32.png': 32,
    'chrome/app/theme/default_200_percent/chromium/product_logo_16.png': 32,
    'chrome/app/theme/default_200_percent/chromium/product_logo_32.png': 64,
    'chrome/app/theme/chromium/win/tiles/SmallLogo.png': 70,
    'chrome/app/theme/chromium/win/tiles/Logo.png': 150,
}
_ICO = 'chrome/app/theme/chromium/win/chromium.ico'
_ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)


def _find_browser():
    candidates = [
        os.path.expandvars(r'%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%ProgramFiles%\Microsoft\Edge\Application\msedge.exe'),
        os.path.expandvars(r'%ProgramFiles%\Google\Chrome\Application\chrome.exe'),
        shutil.which('msedge') or '',
        shutil.which('chrome') or '',
        shutil.which('chromium') or '',
    ]
    for path in candidates:
        if path and Path(path).is_file():
            return path
    sys.exit('Neither Edge nor Chrome found for rendering the SVG.')


def _render(browser, svg, size, tmp):
    """Renders the SVG to a size x size PNG with a transparent background, returns the PNG bytes."""
    data = base64.b64encode(svg.read_bytes()).decode('ascii')
    html = tmp / 'icon.html'
    html.write_text(
        '<!doctype html><html><body style="margin:0;background:transparent">'
        f'<img src="data:image/svg+xml;base64,{data}" width="{size}" height="{size}" '
        'style="display:block"></body></html>',
        encoding='utf-8')
    out = tmp / f'icon-{size}.png'
    if out.exists():
        out.unlink()
    subprocess.run([
        browser, '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--force-device-scale-factor=1', '--default-background-color=00000000',
        f'--window-size={size},{size}', f'--screenshot={out}', html.as_uri()
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    png = out.read_bytes()
    width, height = struct.unpack('>II', png[16:24])
    if (width, height) != (size, size):
        sys.exit(f'Wrong render size: {width}x{height}, expected {size}x{size}')
    return png


def _build_ico(images):
    """Builds an ICO file from ready PNGs (Vista+ format, supported by rc.exe and Windows)."""
    header = struct.pack('<HHH', 0, 1, len(images))
    entries = b''
    payload = b''
    offset = 6 + 16 * len(images)
    for size, png in images:
        dim = 0 if size >= 256 else size
        entries += struct.pack('<BBBBHHII', dim, dim, 0, 0, 1, 32, len(png), offset + len(payload))
        payload += png
    return header + entries + payload


def main():
    browser = _find_browser()
    cache = {}
    with tempfile.TemporaryDirectory() as tmp_name:
        tmp = Path(tmp_name)

        def png_for(size):
            if size not in cache:
                svg = _SMALL_SVG if size <= 32 else _LARGE_SVG
                cache[size] = _render(browser, svg, size, tmp)
            return cache[size]

        for rel, size in _PNGS.items():
            dst = _OVERLAY / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(png_for(size))
            print(f'{rel} ({size}px)')

        ico = _OVERLAY / _ICO
        ico.parent.mkdir(parents=True, exist_ok=True)
        ico.write_bytes(_build_ico([(s, png_for(s)) for s in _ICO_SIZES]))
        print(f'{_ICO} ({", ".join(map(str, _ICO_SIZES))}px)')


if __name__ == '__main__':
    main()
