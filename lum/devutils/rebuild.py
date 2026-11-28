#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lum: quick rebuild after changes in lum/ - without unpacking and patching Chromium again.

On the existing build/src (after a full `python3 build.py --tarball`):
  1. applies NEW patches from lum/patches/series (skips the ones already applied),
  2. copies icons from lum/branding/overlay (only changed ones),
  3. replaces the Chromium -> Lum strings (lum/branding/rebrand_strings.py),
  4. compiles only what changed (ninja).

Usage (from the repo folder, administrator NOT needed):
  python3 lum\\devutils\\rebuild.py             # just the browser (out\\Default\\chrome.exe)
  python3 lum\\devutils\\rebuild.py --package   # + installer and zip in build\\ (package.py)

Not enough (a full build per README is needed) when:
  - the diff of an already applied patch changed (the script detects it) - make the
    change a NEW patch instead,
  - lum/flags.gn changed (the script warns),
  - Chromium / ungoogled-chromium is updated.
"""

import argparse
import filecmp
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
_SRC = _ROOT / 'build' / 'src'
_PATCH = _SRC / 'third_party' / 'git' / 'usr' / 'bin' / 'patch.exe'
_LUM_PATCHES = _ROOT / 'lum' / 'patches'
_OVERLAY = _ROOT / 'lum' / 'branding' / 'overlay'
_LOG = _ROOT / 'build-log.txt'
# Which Lum patches are applied to build/src (written by build.py and this script)
_STATE = _SRC / '.lum-applied'


def _patch(patch_file, *extra):
    cmd = [str(_PATCH), '-p1', '-f', '-s', '--no-backup-if-mismatch', '-d', str(_SRC),
           '-i', str(patch_file), *extra]
    return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def _series():
    lines = (_LUM_PATCHES / 'series').read_text(encoding='utf-8').splitlines()
    return [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]


def _digest(name):
    # Only the diff itself (from the first "--- a/"), not the description on top - fixing
    # the description does not force a full build
    text = (_LUM_PATCHES / name).read_bytes().replace(b'\r\n', b'\n')
    start = text.find(b'\n--- a/')
    return hashlib.sha256(text[start + 1:] if start >= 0 else text).hexdigest()


def _read_state():
    if _STATE.is_file():
        state = {}
        for line in _STATE.read_text(encoding='utf-8').splitlines():
            if line:
                digest, name = line.split(' ', 1)
                state[name] = digest
        return state
    # A tree from before the state file existed: check each patch on its own (reverse dry run)
    print('  (no .lum-applied - checking the patches one by one)')
    return {name: _digest(name) for name in _series() if _patch(_LUM_PATCHES / name, '-R', '--dry-run')}


def _write_state(state):
    _STATE.write_text(''.join(f'{digest} {name}\n' for name, digest in state.items()), encoding='utf-8')


def record_applied():
    """Called by build.py after the whole series was applied."""
    _write_state({name: _digest(name) for name in _series()})


def _apply_new_patches():
    state = _read_state()
    for name in _series():
        if name in state:
            if state[name] != _digest(name):
                sys.exit(f'ERROR: patch {name} changed after it was applied to build/src.\n'
                         'Make the change a NEW patch, or do a full build (README).')
            print(f'  applied:   {name}')
            continue
        if not _patch(_LUM_PATCHES / name, '--dry-run'):
            sys.exit(f'ERROR: patch {name} does not fit build/src.\n'
                     'It may touch a file after the domain substitution (ungoogled) - then a full build (README).')
        if not _patch(_LUM_PATCHES / name):
            sys.exit(f'ERROR: failed to apply {name}')
        state[name] = _digest(name)
        _write_state(state)
        print(f'  APPLIED:   {name}')
    _write_state(state)


def _apply_overlay():
    if not _OVERLAY.is_dir():
        return
    for src in sorted(p for p in _OVERLAY.rglob('*') if p.is_file()):
        dst = _SRC / src.relative_to(_OVERLAY)
        if dst.is_file() and not filecmp.cmp(src, dst, shallow=False):
            shutil.copyfile(src, dst)
            print(f'  icon:      {src.relative_to(_OVERLAY).as_posix()}')


def _check_flags():
    args_gn = (_SRC / 'out' / 'Default' / 'args.gn').read_text(encoding='utf-8', errors='replace')
    lines = (_ROOT / 'lum' / 'flags.gn').read_text(encoding='utf-8').splitlines()
    missing = [f.strip() for f in lines if f.strip() and not f.strip().startswith('#') and f.strip() not in args_gn]
    if missing:
        print('WARNING: flags from lum/flags.gn missing in args.gn (they take effect only after a full '
              'build): ' + ', '.join(missing))


def _run_logged(cmd, cwd, env):
    """Runs cmd, shows its output and writes it to build-log.txt (live view: build-status.ps1)."""
    with open(_LOG, 'w', encoding='utf-8') as log:
        proc = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, encoding='utf-8', errors='replace')
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            log.write(line)
            log.flush()
        return proc.wait()


def main():
    parser = argparse.ArgumentParser(description='Lum: quick rebuild after changes in lum/')
    parser.add_argument('--package', action='store_true', help='also build the installer and the zip')
    parser.add_argument('--record-applied', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.record_applied:
        record_applied()
        return

    if not (_SRC / 'out' / 'Default' / 'args.gn').is_file():
        sys.exit('No build/src/out/Default - do a full build first: python3 build.py --tarball')

    print('==> Lum patches')
    _apply_new_patches()
    print('==> Icons')
    _apply_overlay()
    print('==> Strings')
    subprocess.run([sys.executable, str(_ROOT / 'lum' / 'branding' / 'rebrand_strings.py'), str(_SRC)],
                   check=True)
    _check_flags()

    print('==> Compiling (changed files only)')
    targets = ['chrome', 'mini_installer'] if args.package else ['chrome']
    # like build.py: no depot_tools, the toolchain from the installed Visual Studio
    env = dict(os.environ, DEPOT_TOOLS_WIN_TOOLCHAIN='0')
    cmd = [str(_SRC / 'third_party' / 'ninja' / 'ninja.exe'), '-C', 'out\\Default', *targets]
    if _run_logged(cmd, _SRC, env) != 0:
        sys.exit('Build ERROR - details above and in build-log.txt')

    if args.package:
        print('==> Installer and zip')
        subprocess.run([sys.executable, str(_ROOT / 'package.py')], cwd=_ROOT, check=True,
                       env=dict(os.environ, PYTHONUTF8='1'))
    print('\nDone: build\\src\\out\\Default\\chrome.exe' + (' + installer and zip in build\\' if args.package else ''))


if __name__ == '__main__':
    main()
