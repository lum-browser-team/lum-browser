# Lum Browser

A private, lightweight browser for Windows with a minimalist UI of its own.
Built on [ungoogled-chromium](https://github.com/ungoogled-software/ungoogled-chromium)
(Chromium without Google services) - like other browsers of this kind, we differ in the UI,
privacy and optimizations, not in the engine itself.

> Status: project start. For now it builds plain ungoogled-chromium + an empty Lum layer.

## Principles

- **Privacy:** zero telemetry, zero Google services, no connections to external servers without the user's consent.
- **Lightness:** must run well on weak computers - tab sleeping, built-in ad blocking, nothing unnecessary in the background.
- **Look:** a minimalist, fully custom UI.

## How the repo is organized

| Folder / file | What it is | Who changes it |
|---|---|---|
| `lum/` | **Our changes:** patches, flags, branding | **us** |
| `lum/patches/series` | list of our patches in apply order | us |
| `lum/flags.gn` | our build flags | us |
| `ungoogled-chromium/` | submodule - patches that remove Google from Chromium | we don't touch it (we update it) |
| `patches/`, `flags.windows.gn`, `downloads.ini`, `.github/` | Windows layer from ungoogled-chromium-windows | we don't touch it (we update it) |
| `build.py`, `package.py` | build scripts (`build.py` has the `lum/` steps added) | rarely |
| `build/` | Chromium code and build outputs - tens of GB, **never goes into the repo** | - |

Build order: Chromium code → ungoogled-chromium patches → Windows patches → **Lum patches**.

## Building (Windows 10/11 x64)

### Requirements

- **Disk:** an estimated 60-80 GB of free space (NTFS, preferably SSD) in `--tarball` mode, plus about 15 GB for Visual Studio and the SDK. We will put the exact number here after the first build.
- **RAM:** 16 GB minimum, 32 GB recommended.

### Installing the tools - one script

In PowerShell **as administrator**, in the repo folder:

```
powershell -ExecutionPolicy Bypass -File lum\devutils\setup-windows.ps1
```

The script installs everything from the list below (Python 3.12, 7-Zip, Visual Studio Community 2026 with C++ and MFC/ATL,
Windows SDK 10.0.28000 with debuggers), sets up `python3.exe`, pip packages and long paths, and at the end checks
that everything is there. Only turning off the Python aliases (the script opens the right settings page) and a restart stay manual.

### Requirements - details (in case the script does not work)

- **Visual Studio 2026** (Community is enough): "Desktop development with C++" + "MFC/ATL support", and
  **Windows SDK 10.0.28000** with "Debugging Tools for Windows" - per the "Visual Studio" section of the
  [official Chromium instructions](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/windows_build_instructions.md#visual-studio).
- **Python 3.11+** from python.org:
  - check "Add python.exe to PATH",
  - at the end of the installer click the button that removes the `MAX_PATH` limit,
  - turn off the `python.exe` / `python3.exe` aliases in *Settings → Apps → Advanced app settings → App execution aliases*,
  - make sure there is a `python3.exe` in the Python folder (a copy of or link to `python.exe`),
  - `pip install httplib2==0.22.0 clang==21.1.7`
- **7-Zip**
- **Git** (the "Git from the command line and also from 3rd-party software" option)
- **DO NOT install** Google's `depot_tools`.

### First clone

```
git clone --recurse-submodules https://github.com/lum-browser-team/lum-browser.git
cd lum-browser
```

If the repo is already cloned without the submodule: `git submodule update --init`.

### Building

In a **Developer Command Prompt for VS** started **as administrator**, in the repo folder:

```
python3 build.py --tarball
python3 package.py
```

- `--tarball` downloads the Chromium code as an archive without Git history - much less disk space.
- The installer and a zip archive appear in `build/`.
- The first build takes several hours.

**If the build fails:**
- while downloading the code → delete `build\download_cache` and run again,
- later → delete everything in `build` **except** `build\download_cache` and run again.

## How we work together

1. `git pull` on `main` before starting work.
2. A new branch for every feature: `git checkout -b ui/vertical-tabs`.
3. Changes are made as patches in `lum/patches/` (details in [CLAUDE.md](CLAUDE.md)).
4. Commit, `git push`, a pull request on GitHub, the other one of us reviews and clicks Merge.

## Updating to a new Chromium version

Done on a branch, like any other change:

```
git fetch upstream
git merge upstream/master
git submodule update --init
```

Then build and fix the Lum patches that no longer fit. Details in [CLAUDE.md](CLAUDE.md).
Original documentation of the Windows layer: [docs/ungoogled-chromium-windows.md](docs/ungoogled-chromium-windows.md).

## License

ungoogled-chromium and ungoogled-chromium-windows code: BSD-3-Clause ([LICENSE](LICENSE)).
Chromium: licenses in the Chromium source code. License of Lum's own changes - to be decided.
