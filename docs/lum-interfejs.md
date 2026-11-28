# Interfejs Lum – specyfikacja dla Claude

> Dla Claude pracującego nad Lum (np. u Bartka). Opisuje, **jak ma wyglądać i działać przeglądarka**.
> Projekt interfejsu: **olehnykorovych** (w całości). Nazwa „Lum”: Savio. Zob. [`../AUTORZY.md`](../AUTORZY.md).
>
> **Źródło prawdy to działająca makieta [`../ui-preview/`](../ui-preview/)** (Electron): uruchom `ui-preview/Lum.cmd`
> i porównuj. Wartości poniżej pochodzą z jej kodu (`style.css`, `renderer.js`, `start.html`). Jeśli ten opis
> i makieta się różnią, rację ma makieta; popraw wtedy ten plik.
> Zadanie: odtworzyć ten interfejs w Chromium łatkami w `lum/patches/ui/` (zasady w `CLAUDE.md`).

## Zasady ogólne

- Minimalizm: na górze tylko pasek 38 px, bez paska zakładek w stylu Chrome, bez paska adresu jako pola, bez menu „trzy kropki”.
- Okno bez ramki systemowej (własny pasek tytułu), ale z zachowaniem systemu: przeciąganie za puste miejsce paska,
  przyklejanie do krawędzi i narożników (Aero Snap), Win+strzałki, dwuklik = maksymalizuj.
- Wszystko płynne: pojawianie się i znikanie to przejścia 0,2–2 s, nic nie „wskakuje”.
- Lekkość: animacje tylko CSS/kompozytor, żadnych timerów działających bez potrzeby.

## Pasek (38 px)

### Tryby (ustawienie „Pasek”, domyślnie Chowany)

| Tryb | Zachowanie |
|---|---|
| **Chowany** | Strona zajmuje całe okno. Pasek jest niewidoczny (opacity 0, nie łapie kliknięć). Gdy kursor wejdzie w obszar paska (górne 38 px okna, także kilka px nad oknem), pasek się pojawia; zostaje, dopóki kursor jest do 80 px od góry; dalej znika. |
| **Zawsze widoczny** | Pasek stale widoczny w kolorze motywu, strona zaczyna się **pod nim** (nie nachodzi na przyciski stron, np. YouTube). Karty i linia pojawiają się po najechaniu na pasek. |

Gdy pasek jest pokazany, strona pod nim nie przyjmuje kliknięć (żeby trafiały w przyciski).

### Układ od lewej

1. **Wstecz / Dalej**: zakrzywione „<” i „>” (ikona 19 px w polu 32 px, kreska 1,7 px, zaokrąglone końce).
   Ścieżki SVG (viewBox 24): wstecz `M15.5 5.5C13.2 8.4 10.6 10.2 7.5 12C10.6 13.8 13.2 15.6 15.5 18.5`,
   dalej `M8.5 5.5C10.8 8.4 13.4 10.2 16.5 12C13.4 13.8 10.8 15.6 8.5 18.5`. Nieaktywne: przezroczystość 0,3.
2. **Odśwież**: okrągła strzałka (17 px w polu 30 px).
3. **Karty** (tylko gdy pasek pokazany) – zaraz obok odświeżania.
4. **Plus** za ostatnią kartą.

Na środku: **adres strony** (13 px; host pełnym kolorem, ścieżka 60% krycia, ścieżka dekodowana, np. `pl.wikipedia.org/wiki/Świerk_pospolity`).
Na nowej karcie środek jest pusty. Gdy pokazują się karty, adres znika w 0,2 s (a wraca w 0,7 s).

Po prawej: **ustawienia** (ikona dwóch suwaków, kreska 1,4) i **przyciski okna** (każdy 28×28 px, ciasno, bez odstępu):

| Styl | Minimalizuj | Maksymalizuj | Zamknij |
|---|---|---|---|
| Zaokrąglony | łuk w dół, zielony `#3DDC84` | łuk w górę, żółty `#F5C542` | kółko, czerwony `#FF5F57` |
| Kanciasty | — zielony | □ żółty | ✕ czerwony |

Na jasnym tle kolory ciemniejsze: `#16A34A`, `#C98A00`, `#E5483E`. W obu stylach przyciski mają ten sam rozmiar i miejsce.

### Karty

- Wysokość 26 px, szerokość do 190 px (zwężają się przy wielu kartach, min. 36 px). Bez tła i bez obwódki.
- Treść: favikona 15 px + tytuł 12 px (500). Nieaktywne przygaszone (68%), po najechaniu pełne.
- Krzyżyk zamykania pojawia się po najechaniu na kartę. Zamykanie też środkowym przyciskiem myszy i Ctrl+W.
- Bardzo dużo kart (mniej niż ~110 px na kartę): same ikonki, krzyżyk w miejscu ikonki po najechaniu.
  Gdy brak miejsca, pasek kart przewija się w poziomie kółkiem myszy; plus zawsze widoczny;
  po prawej zostaje min. 120 px wolnego miejsca do chwytania okna.
- Pojawianie: każda karta z lekkim przesunięciem z lewej (10 px) i rozjaśnieniem, 0,8 s, kolejne z opóźnieniem 45 ms.

### Linia otwartej karty (najważniejszy element)

Cienka linia (1,2 px, ~40% koloru ikon) zaczyna się **u góry przy lewej krawędzi okna**, schodzi w dół, biegnie
poziomo na wysokości 37 px, **obejmuje otwartą kartę** (wchodzi w górę na 6 px wokół niej), biegnie dalej i
**przy prawej krawędzi wraca do góry** – przechodzi w granicę okna. Przy zmianie karty linia płynnie przesuwa się (0,42 s).
Pojawia się później i wolniej niż karty: opóźnienie 0,55 s, rysowanie od lewej przez 2 s.

Geometria (px): góra karty `t=6`, poziom linii `b=37`, zaokrąglenie `r=8` (styl Zaokrąglony) albo `r=0` (Kanciasty).

### Kolory paska po pokazaniu

- **Nad linią**: kolor motywu przeglądarki (ten sam co tło nowej karty).
- **Wnętrze otwartej karty** (obszar objęty linią): kolor, którego jest najwięcej na górze strony w pasie wokół tej karty
  (próbka górnych ~64 px strony, ±60 px po bokach karty). Karta wygląda jak przedłużenie strony; jej tekst jasny albo ciemny zależnie od tego koloru.
- Pod linią zaczyna się strona.

W trybie Chowany przy niewidocznym pasku nic nie jest rysowane. Kolor ikon/tekstu na pasku: jasny na ciemnym, ciemny na jasnym.

### Plus i pola wpisywania

- **Plus** (i Ctrl+T): nie tworzy od razu karty. W jego miejscu pojawia się pole „Napisz coś albo wklej link…”
  wyglądające jak pole nowej karty (bez tła i ramki, cienki tekst 14 px/300). Karty zostają widoczne.
  Lupa pojawia się w polu dopiero przy pisaniu. **Enter** otwiera nową kartę, **Esc** albo kliknięcie obok zamyka pole bez karty.
- **Ctrl+L**: pole na środku paska z adresem obecnej karty; Enter otwiera w tej karcie.
- Rozpoznawanie: `http(s)://…`, `localhost[:port]`, poprawny IPv4 i domeny z końcówką z liter → strona;
  nazwy plików (`node.js`, `index.html`) i reszta → wyszukiwarka; inne schematy (`file:`, `javascript:`) → nic.

## Nowa karta (strona startowa)

- Tło = kolor motywu. Tylko jedno pole „Napisz coś albo wklej link…” (26 px, waga 300), **dokładnie na środku okna**,
  w tym samym miejscu w obu trybach paska. Bez logo i bez napisu Lum.
- Przy pisaniu: po prawej lupa (fraza) albo strzałka (link) + podpowiedź „Enter szukaj” / „Enter otwórz stronę”.
- Pole jest zawsze gotowe: fokus po otwarciu karty, po powrocie na kartę i do okna; pisanie albo Ctrl+V w dowolnym miejscu trafia do pola.
- Na dole stopka ze skrótami (12 px): Ctrl+T nowa karta · Ctrl+L szukaj · Ctrl+W zamknij kartę.
- Kolory tekstu liczone z tła (`color-mix`): placeholder ~50%, ikony ~68%, stopka ~46% koloru tekstu.

## Motywy (ustawienie „Motyw”)

Pasek nad linią i tło nowej karty mają ten sam kolor:

| Motyw | Kolor | Ikony/tekst |
|---|---|---|
| Czarny (domyślny) | `#000000` | jasne |
| Grafit | `#1C1D20` | jasne |
| Szary | `#3A3B40` | jasne |
| Jasnoszary | `#DFE0E3` | ciemne |
| Biały | `#FAFAFA` | ciemne |
| Miętowy / Błękitny / Lawendowy | `#CFEBDD` / `#CFE3F3` / `#DCD3F2` | ciemne |
| Różowy / Brzoskwiniowy / Cytrynowy | `#F3D3DE` / `#F6D9C7` / `#F3EDC4` | ciemne |
| Własny | dowolny z wybieraka koloru | według jasności (próg 0,55) |

### Ustawienia – wygląd będzie inny niż w makiecie

**Panel ustawień z makiety jest tymczasowy.** W prawdziwej przeglądarce ustawienia będą wyglądać inaczej –
ich projekt przygotuje olehnykorovych osobno. Nie odtwarzaj wyglądu panelu z `ui-preview/`.

Wiążące są tylko **opcje** i ich działanie (wszystkie zapamiętywane):
- **Motyw** – lista kolorów z tabeli wyżej + własny kolor.
- **Styl** – Zaokrąglony / Kanciasty.
- **Pasek** – Chowany / Zawsze widoczny.

Ikona otwierająca ustawienia (dwa suwaki) zostaje na pasku, po lewej od przycisków okna.

## Przyciski – reakcja

- Najechanie: brak obwódek i teł; ikona rozjaśnia się do 100% i lekko świeci (`drop-shadow(0 0 3px)` w jej kolorze), przejście 0,45 s.
- Kliknięcie: wciśnięcie do 80% (0,08 s), sprężysty powrót, krótki błysk ikony.
- Styl Kanciasty: brak zaokrągleń w elementach paska (przyciski, karty, linia).

## Pozostałe

- **Pasek przewijania** na stronach: cienki (10 px), zaokrąglony uchwyt, półprzezroczysty szary, bez strzałek.
- **Strona się nie otworzyła**: zamiast czarnej strony komunikat „Nie udało się otworzyć strony” + adres + przycisk „Spróbuj ponownie”, w kolorze motywu.
- **Linki „w nowym oknie”** otwierają nową kartę, ale tylko tuż po kliknięciu użytkownika (strona nie może sama otwierać kart).
- **Skróty**: Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Tab, Ctrl+Shift+Tab, F5/Ctrl+R, Alt+←/→.
- **Wyszukiwarka**: w makiecie Google (życzenie autora projektu), ale zasada nr 1 w `CLAUDE.md` mówi „zero usług Google”.
  **Do uzgodnienia między współzałożycielami** przed wydaniem.

## Wskazówki do Chromium (do sprawdzenia w `build/src`, nie gotowe rozwiązania)

- Własna ramka i pasek: widok ramki przeglądarki na Windows (custom frame / non-client view) z obszarem chwytania (`HTCAPTION`),
  żeby działało przyklejanie okna; przyciski okna rysowane samodzielnie.
- Tryb Chowany przypomina odsłanianie paska w trybie pełnoekranowym (reveal przy górnej krawędzi) – strona w pełnym oknie, pasek nad nią.
- Karty i pasek narzędzi: uproszczony pasek kart + pasek narzędzi w jednym wierszu 38 px; linia wokół aktywnej karty jako własne rysowanie.
- Kolor wnętrza aktywnej karty: z koloru strony (np. `theme-color` albo próbka ostatniej klatki) – tanio, tylko przy zmianie strony/przewinięciu.
- Nowa karta: własna lokalna strona (WebUI) zamiast domyślnej, bez żadnych żądań sieciowych.
- Pasek przewijania: styl nakładkowy (overlay) albo własny `NativeTheme`.
- Kolory motywów przez mechanizm motywów Chromium (kolory ramki/paska), nie przez rozszerzenie.
