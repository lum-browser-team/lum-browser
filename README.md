# Lum Browser

Prywatna, lekka przeglądarka na Windows z minimalistycznym, własnym interfejsem.
Zbudowana na [ungoogled-chromium](https://github.com/ungoogled-software/ungoogled-chromium)
(Chromium bez usług Google) - tak jak inne przeglądarki tego typu, różnimy się interfejsem,
prywatnością i optymalizacjami, a nie samym silnikiem.

> Status: start projektu. Na razie kompiluje się czyste ungoogled-chromium + pusta warstwa Lum.

## Założenia

- **Prywatność:** zero telemetrii, zero usług Google, żadnych połączeń do zewnętrznych serwerów bez zgody użytkownika.
- **Lekkość:** ma działać dobrze na słabych komputerach - usypianie kart, wbudowane blokowanie reklam, nic zbędnego w tle.
- **Wygląd:** minimalistyczny, w pełni własny interfejs.

## Jak zbudowane jest repo

| Folder / plik | Co to | Kto zmienia |
|---|---|---|
| `lum/` | **Nasze zmiany:** łatki, flagi, branding | **my** |
| `lum/patches/series` | lista naszych łatek w kolejności nakładania | my |
| `lum/flags.gn` | nasze flagi kompilacji | my |
| `ungoogled-chromium/` | submoduł - łatki usuwające Google z Chromium | nie ruszamy (aktualizujemy) |
| `patches/`, `flags.windows.gn`, `downloads.ini`, `.github/` | warstwa Windows z ungoogled-chromium-windows | nie ruszamy (aktualizujemy) |
| `build.py`, `package.py` | skrypty kompilacji (`build.py` ma dopisane nakładanie `lum/`) | rzadko |
| `build/` | kod Chromium i wyniki kompilacji - dziesiątki GB, **nigdy nie trafia do repo** | - |

Kolejność przy kompilacji: kod Chromium → łatki ungoogled-chromium → łatki Windows → **łatki Lum**.

## Kompilacja (Windows 10/11 x64)

### Wymagania

- **Dysk:** szacunkowo 60-80 GB wolnego miejsca (NTFS, najlepiej SSD) w trybie `--tarball`, plus ok. 15 GB na Visual Studio i SDK. Dokładną liczbę zapiszemy tu po pierwszej kompilacji.
- **RAM:** 16 GB minimum, 32 GB zalecane.

### Instalacja narzędzi - jednym skryptem

W PowerShell **jako administrator**, w folderze repo:

```
powershell -ExecutionPolicy Bypass -File lum\devutils\setup-windows.ps1
```

Skrypt instaluje wszystko z listy poniżej (Python 3.12, 7-Zip, Visual Studio Community 2026 z C++ i MFC/ATL,
Windows SDK 10.0.28000 z debuggerami), ustawia `python3.exe`, pakiety pip i długie ścieżki, a na końcu sprawdza,
czy wszystko jest. Ręcznie zostaje tylko wyłączenie aliasów Pythona (skrypt otworzy właściwe ustawienia) i restart.

### Wymagania - szczegóły (gdyby skrypt nie zadziałał)

- **Visual Studio 2026** (Community wystarczy): „Desktop development with C++” + „MFC/ATL support”, oraz
  **Windows SDK 10.0.28000** z „Debugging Tools for Windows” - wg sekcji „Visual Studio” w
  [oficjalnej instrukcji Chromium](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/windows_build_instructions.md#visual-studio).
- **Python 3.11+** z python.org:
  - zaznacz „Add python.exe to PATH”,
  - na końcu instalatora kliknij przycisk zdejmujący limit `MAX_PATH`,
  - wyłącz aliasy `python.exe` / `python3.exe` w *Ustawienia → Aplikacje → Zaawansowane ustawienia aplikacji → Aliasy wykonywania aplikacji*,
  - upewnij się, że w folderze Pythona jest `python3.exe` (kopia lub link do `python.exe`),
  - `pip install httplib2==0.22.0 clang==21.1.7`
- **7-Zip**
- **Git** (opcja „Git from the command line and also from 3rd-party software”)
- **NIE instaluj** `depot_tools` od Google.

### Pierwsze pobranie repo

```
git clone --recurse-submodules https://github.com/lum-browser-team/lum-browser.git
cd lum-browser
```

Jeśli repo jest już pobrane bez submodułu: `git submodule update --init`.

### Budowanie

W **Developer Command Prompt for VS** uruchomionym **jako administrator**, w folderze repo:

```
python3 build.py --tarball
python3 package.py
```

- `--tarball` pobiera kod Chromium jako paczkę bez historii Gita - dużo mniej miejsca na dysku.
- Instalator i archiwum zip pojawią się w `build/`.
- Pierwsza kompilacja trwa kilka godzin.
- Podgląd postępu na żywo (etapy, procent, szacowany koniec): uruchom kompilację z zapisem do logu (PowerShell **jako administrator**,
  inaczej rozpakowanie kodu wywali się na dowiązaniach symbolicznych)
  (`python3 build.py --tarball *>&1 | Tee-Object -FilePath build-log.txt` w PowerShell), a w drugim oknie
  `powershell -ExecutionPolicy Bypass -File lum\devutils\build-status.ps1`.

### Szybka przebudowa po zmianach

Po pierwszej pełnej kompilacji kolejne zmiany w `lum/` (nowe łatki, ikony, napisy) buduje się w minutach,
a nie godzinach - kompilują się tylko zmienione pliki. W folderze repo (administrator niepotrzebny):

```
python3 lum\devutils\rebuild.py             # przeglądarka: build\src\out\Default\chrome.exe
python3 lum\devutils\rebuild.py --package   # + instalator i zip w build\
```

Nie wystarczy (trzeba pełnej kompilacji), gdy zmieniła się łatka już nałożona na `build/src` (skrypt to wykryje -
zmianę lepiej zrobić jako nową łatkę), zmieniły się flagi w `lum/flags.gn` albo aktualizujemy Chromium.

**Jeśli kompilacja się wywali:**
- przy pobieraniu kodu → usuń `build\download_cache` i uruchom ponownie,
- później → usuń wszystko w `build` **oprócz** `build\download_cache` i uruchom ponownie.

## Jak pracujemy razem

1. `git pull` na `main` przed rozpoczęciem pracy.
2. Nowa gałąź na każdą funkcję: `git checkout -b ui/pionowe-karty`.
3. Zmiany robimy jako łatki w `lum/patches/` (szczegóły w [CLAUDE.md](CLAUDE.md)).
4. Commit, `git push`, pull request na GitHubie, drugi z nas przegląda i klika Merge.

## Aktualizacja do nowej wersji Chromium

Robimy z gałęzi, tak jak każdą inną zmianę:

```
git fetch upstream
git merge upstream/master
git submodule update --init
```

Potem kompilacja i poprawa łatek Lum, które przestały pasować. Szczegóły w [CLAUDE.md](CLAUDE.md).
Oryginalna dokumentacja warstwy Windows: [docs/ungoogled-chromium-windows.md](docs/ungoogled-chromium-windows.md).

## Licencja

Kod ungoogled-chromium i ungoogled-chromium-windows: BSD-3-Clause ([LICENSE](LICENSE)).
Chromium: licencje w kodzie źródłowym Chromium. Licencja własnych zmian Lum - do ustalenia.
