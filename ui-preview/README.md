# Lum – makieta przeglądarki

**Projekt interfejsu: w całości olehnykorovych.** Nazwa „Lum”: Savio. Szczegóły w [`../AUTORZY.md`](../AUTORZY.md).

Działająca makieta (mini przeglądarka na Electronie): pokazuje, jak ma wyglądać i działać Lum,
na prawdziwych stronach. To **wzór dla prawdziwej przeglądarki** (fork Chromium w tym repo),
a nie docelowa przeglądarka. Opis wyglądu i zachowania do przeniesienia do Chromium:
[`../docs/lum-interfejs.md`](../docs/lum-interfejs.md).

## Uruchomienie

Dwuklik na `Lum.cmd` (za pierwszym razem zainstaluje zależności, ok. 100 MB) albo:

    cd ui-preview
    npm install
    npm start

## Co jest w makiecie

- Pasek 38 px, dwa tryby: **Chowany** (znika, wraca po najechaniu kursorem na jego obszar u góry okna)
  i **Zawsze widoczny** (strona zaczyna się pod paskiem).
- Po najechaniu: karty obok odświeżania; linia z lewej krawędzi okna (od góry) obejmuje otwartą kartę
  i przy prawej krawędzi wraca do góry. Nad linią kolor motywu, wnętrze otwartej karty w kolorze strony.
- Plus: w jego miejscu pole „Napisz coś albo wklej link…”, nowa karta po Enterze.
- Nowa karta: pole wyszukiwania na środku okna, zawsze gotowe do pisania i wklejania.
- Przyciski: wstecz, dalej (zakrzywione strzałki), odśwież, ustawienia, przyciski okna
  (łuki w stylu zaokrąglonym, — □ ✕ w stylu kanciastym, te same kolory).
- Ustawienia: 5 szarości, 6 pasteli, własny kolor; styl Zaokrąglony/Kanciasty; tryb paska.
- Zamykanie karty: krzyżyk po najechaniu, środkowy przycisk myszy, Ctrl+W. Dużo kart: zwężanie,
  same ikonki, przewijanie kółkiem.
- Cienki, zaokrąglony pasek przewijania na stronach.
- Skróty: Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab, Ctrl+Shift+Tab, F5, Alt+←/→, F12 (narzędzia).

Wyszukiwarka w makiecie: Google (`SEARCH` w `renderer.js` i `start.js`).
Strony nie dostają dostępu do kamery, mikrofonu, lokalizacji ani powiadomień.

## Pliki

- `main.js` – okno, skróty, odczyt kursora przy górnej krawędzi, próbkowanie koloru strony.
- `renderer.js`, `index.html`, `style.css` – pasek, karty, ustawienia.
- `start.html`, `start.js` – strona nowej karty.
- `tests/` – skrypty testów (Playwright + Electron).

## Sprawdzanie bez klikania

`LUM_SNAPSHOT=plik.png` zapisuje zrzut okna po kilku sekundach i zamyka aplikację.
`LUM_OPEN=adres1,adres2` otwiera karty, `LUM_SNAPSHOT_HOVER=1` pokazuje pasek jak po najechaniu,
`LUM_EVAL="kod"` wykonuje kod w interfejsie (np. `setTheme('mint')`).

## Gotowa aplikacja (Lum.exe)

    npx electron-packager . Lum --platform=win32 --arch=x64 --out=dist --overwrite --prune=true --icon=../lum/branding/overlay/chrome/app/theme/chromium/win/chromium.ico --ignore="^/tests" --ignore="^/dist" --ignore="^/Lum\.cmd"

Wynik: `dist/Lum-win32-x64/Lum.exe` (potrzebny cały folder, ok. 360 MB, bo zawiera Electron/Chromium).
