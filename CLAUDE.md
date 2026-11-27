# Lum Browser - zasady dla Claude

Odpowiadaj po polsku. Projekt robią dwie osoby, każda pracuje z Claude na swoim komputerze,
synchronizacja przez GitHub (`lum-browser-team/lum-browser`).

## Czym jest projekt

Prywatna, lekka przeglądarka na Windows: fork **ungoogled-chromium-windows** z własną warstwą
zmian w `lum/`. Cele, ważniejsze od wszystkiego innego:
1. **Prywatność** - zero telemetrii, zero usług Google/Microsoft, żadnych żądań sieciowych bez zgody użytkownika.
2. **Lekkość** - ma działać na słabych komputerach (Win 10, 4 GB RAM). Każda funkcja musi być tania w RAM/CPU;
   nic nie działa w tle bez potrzeby.
3. **Minimalistyczny, własny interfejs.**

Nie kopiujemy kodu, nazw, grafik ani wyglądu innych przeglądarek (np. Helium) - Lum ma własną tożsamość.
Łatki z ungoogled-chromium/Bromite/Debian itp. są OK, jeśli licencja pozwala i zaznaczamy źródło.

## Struktura

- `lum/patches/` + `lum/patches/series` - **wszystkie nasze zmiany w kodzie Chromium**, jako pliki `.patch`.
  Nakładane na końcu (po ungoogled-chromium i patches/ Windows) przez `build.py` (bloki oznaczone `# LUM:`).
- `lum/flags.gn` - nasze flagi GN, dopisywane na końcu `args.gn`. gn działa z `--fail-on-unused-args`.
- `lum/branding/` - źródła logo/ikon.
- `ungoogled-chromium/` (submoduł), `patches/`, `flags.windows.gn`, `downloads.ini`, `pruning.list`,
  `domain_substitution.list`, `package.py`, `.github/`, `devutils/` - **warstwa upstream. Nie edytuj**,
  chyba że to aktualizacja bazy albo użytkownik wprost o to prosi. Zmiany upstream = konflikty przy każdej aktualizacji.
- `build/` - kod Chromium (`build/src`) i wyniki. Ignorowany przez Git. **Zmiany w `build/src` giną** przy
  czystej kompilacji - każdą zmianę w Chromium trzeba zapisać jako łatkę w `lum/patches/`.
- `docs/ungoogled-chromium-windows.md` - oryginalna dokumentacja upstream (zależności, aktualizacje rust itd.).

## Łatki

- Ścieżki w łatkach względem korzenia Chromium (`build/src`), format `-p1` (`a/...` / `b/...`).
- Foldery wg obszaru: `branding/`, `privacy/`, `perf/`, `ui/`, `features/`.
- Nazwy kebab-case, opisowe: `disable-...`, `add-flag-...`, `ui-...`.
- Nowa łatka = nowy plik + linia w `lum/patches/series` w odpowiednim miejscu. Jedna łatka = jedna sprawa.
- Na górze łatki krótki opis (co i po co) przed pierwszym `---`/`diff`.
- Po zmianie łatki sprawdź, czy dalej nakłada się na czyste źródło (po łatkach upstream).
- Preferuj przełączniki (`chrome://flags` / ustawienia) zamiast twardego usuwania kodu, gdy to nie szkodzi prywatności.

## Git

- Nigdy nie commituj `build/`.
- **Nigdy nie wypychaj tagów** (`git push --tags`) - workflowy w `.github/` uruchamiają wielogodzinne buildy na każdy tag.
  Remote `upstream` ma `tagOpt --no-tags`.
- Każda funkcja na osobnej gałęzi (`ui/...`, `privacy/...`, `perf/...`), potem PR do `main`.
- Commity po polsku, tytuł `obszar: co zmieniono` (np. `ui: pionowe karty`), max ~65 znaków.

## Aktualizacja bazy (nowe Chromium)

1. Gałąź `update/chromium-<wersja>`.
2. `git fetch upstream` → `git merge upstream/master` (albo commit konkretnego wydania) → `git submodule update --init`.
3. Wersja Chromium: `ungoogled-chromium/chromium_version.txt`.
4. Kompilacja; łatki Lum, które się nie nałożyły, poprawić pod nowy kod.

## Kompilacja

Developer Command Prompt for VS (jako administrator): `python3 build.py --tarball`, potem `python3 package.py`.
Wymagania i naprawa nieudanych buildów - w README.md.
