#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lum: szybka przebudowa po zmianach w lum/ - bez rozpakowywania i latania Chromium od nowa.

Na istniejacym build/src (po pelnym `python3 build.py --tarball`):
  1. naklada NOWE latki z lum/patches/series (juz nalozone pomija),
  2. kopiuje ikony z lum/branding/overlay (tylko zmienione),
  3. podmienia napisy Chromium -> Lum (lum/branding/rebrand_strings.py),
  4. kompiluje tylko to, co sie zmienilo (ninja).

Uzycie (z folderu repo, NIE musi byc administrator):
  python3 lum\\devutils\\rebuild.py             # sama przegladarka (out\\Default\\chrome.exe)
  python3 lum\\devutils\\rebuild.py --package   # + instalator i zip w build\\ (package.py)

Kiedy NIE wystarczy (trzeba pelnej kompilacji wg README):
  - zmieniono latke, ktora byla juz nalozona (skrypt to wykryje i powie) - zamiast tego
    zrob zmiane jako NOWA latke,
  - zmieniono lum/flags.gn (skrypt ostrzeze),
  - aktualizacja Chromium / ungoogled-chromium.
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
# Ktore latki Lum sa nalozone na build/src (zapisuje build.py i ten skrypt)
_STATE = _SRC / '.lum-applied'


def _patch(patch_file, *extra):
    cmd = [str(_PATCH), '-p1', '-f', '-s', '--no-backup-if-mismatch', '-d', str(_SRC),
           '-i', str(patch_file), *extra]
    return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def _series():
    lines = (_LUM_PATCHES / 'series').read_text(encoding='utf-8').splitlines()
    return [line.strip() for line in lines if line.strip() and not line.strip().startswith('#')]


def _digest(name):
    return hashlib.sha256((_LUM_PATCHES / name).read_bytes()).hexdigest()


def _read_state():
    if _STATE.is_file():
        state = {}
        for line in _STATE.read_text(encoding='utf-8').splitlines():
            if line:
                digest, name = line.split(' ', 1)
                state[name] = digest
        return state
    # Drzewo sprzed zapisywania stanu: sprawdz kazda latke osobno (odwrotny dry-run)
    print('  (brak .lum-applied - sprawdzam latki po kolei)')
    return {name: _digest(name) for name in _series() if _patch(_LUM_PATCHES / name, '-R', '--dry-run')}


def _write_state(state):
    _STATE.write_text(''.join(f'{digest} {name}\n' for name, digest in state.items()), encoding='utf-8')


def record_applied():
    """Wolane przez build.py po pelnym nalozeniu latek."""
    _write_state({name: _digest(name) for name in _series()})


def _apply_new_patches():
    state = _read_state()
    for name in _series():
        if name in state:
            if state[name] != _digest(name):
                sys.exit(f'BLAD: latka {name} zmienila sie po nalozeniu na build/src.\n'
                         'Zrob zmiane jako NOWA latke albo pelna kompilacje (README).')
            print(f'  juz nalozona:  {name}')
            continue
        if not _patch(_LUM_PATCHES / name, '--dry-run'):
            sys.exit(f'BLAD: latka {name} nie pasuje do build/src.\n'
                     'Moze dotyka pliku po podmianie domen (ungoogled) - wtedy pelna kompilacja (README).')
        if not _patch(_LUM_PATCHES / name):
            sys.exit(f'BLAD: nie udalo sie nalozyc {name}')
        state[name] = _digest(name)
        _write_state(state)
        print(f'  NALOZONA:      {name}')
    _write_state(state)


def _apply_overlay():
    if not _OVERLAY.is_dir():
        return
    for src in sorted(p for p in _OVERLAY.rglob('*') if p.is_file()):
        dst = _SRC / src.relative_to(_OVERLAY)
        if dst.is_file() and not filecmp.cmp(src, dst, shallow=False):
            shutil.copyfile(src, dst)
            print(f'  ikona:         {src.relative_to(_OVERLAY).as_posix()}')


def _check_flags():
    args_gn = (_SRC / 'out' / 'Default' / 'args.gn').read_text(encoding='utf-8', errors='replace')
    lines = (_ROOT / 'lum' / 'flags.gn').read_text(encoding='utf-8').splitlines()
    missing = [f.strip() for f in lines if f.strip() and not f.strip().startswith('#') and f.strip() not in args_gn]
    if missing:
        print('UWAGA: flagi z lum/flags.gn, ktorych nie ma w args.gn (wejda dopiero po pelnej '
              'kompilacji): ' + ', '.join(missing))


def _run_logged(cmd, cwd, env):
    """Uruchamia cmd, pokazuje wyjscie i zapisuje je do build-log.txt (podglad: build-status.ps1)."""
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
    parser = argparse.ArgumentParser(description='Lum: szybka przebudowa po zmianach w lum/')
    parser.add_argument('--package', action='store_true', help='zbuduj tez instalator i zip')
    parser.add_argument('--record-applied', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.record_applied:
        record_applied()
        return

    if not (_SRC / 'out' / 'Default' / 'args.gn').is_file():
        sys.exit('Brak build/src/out/Default - najpierw pelna kompilacja: python3 build.py --tarball')

    print('==> Latki Lum')
    _apply_new_patches()
    print('==> Ikony')
    _apply_overlay()
    print('==> Napisy')
    subprocess.run([sys.executable, str(_ROOT / 'lum' / 'branding' / 'rebrand_strings.py'), str(_SRC)],
                   check=True)
    _check_flags()

    print('==> Kompilacja (tylko zmienione pliki)')
    targets = ['chrome', 'mini_installer'] if args.package else ['chrome']
    # tak jak build.py: bez depot_tools, toolchain z zainstalowanego Visual Studio
    env = dict(os.environ, DEPOT_TOOLS_WIN_TOOLCHAIN='0')
    cmd = [str(_SRC / 'third_party' / 'ninja' / 'ninja.exe'), '-C', 'out\\Default', *targets]
    if _run_logged(cmd, _SRC, env) != 0:
        sys.exit('BLAD kompilacji - szczegoly wyzej i w build-log.txt')

    if args.package:
        print('==> Instalator i zip')
        subprocess.run([sys.executable, str(_ROOT / 'package.py')], cwd=_ROOT, check=True,
                       env=dict(os.environ, PYTHONUTF8='1'))
    print('\nGotowe: build\\src\\out\\Default\\chrome.exe' + (' + instalator i zip w build\\' if args.package else ''))


if __name__ == '__main__':
    main()
