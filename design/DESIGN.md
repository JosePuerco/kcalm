# Kcalm – Design-Vorgabe

Verbindlich für die Umsetzung. Werte stehen in `tokens.json`, die präzise Vorlage für jeden Screen ist der Prototyp in `prototypes/` (Abstände, Texte, Zustände, Animationen). Screenshots in `screenshots/` zeigen den Gesamteindruck.

## 1. Charakter

- Ruhig, präzise, kompakt. Ein Werkzeug, kein Spiel: keine Streaks, Abzeichen, Maskottchen, Konfetti, Motivationssprüche.
- Inspiration Revolut: klare Karten auf grauem Grund, eine kräftige Akzentfarbe, große Zahlen.
- Zahlen sind die Hauptdarsteller: groß, tabellarische Ziffern, deutsches Format (1.273 · 2,5 l · 0,13 g).
- Farbe sparsam: Blau nur für Fortschritt, Hauptaktionen und Markierungen. Alles andere Graustufen.

## 2. Grundlagen

### Farben und Modi

- Nur Tokens aus `tokens.json` verwenden, keine frei erfundenen Farben.
- Hell und Dunkel; Standard folgt `prefers-color-scheme`, in den Einstellungen umschaltbar (System / Hell / Dunkel).
- Akzent-Flächen (#3D5AFE) tragen immer weiße Schrift. Akzent als Text oder Icon auf Weiß/Grau: `accentText`.
- `over` (orange) nur für den Ring bei Überschreitung. `warnText` nur für Hinweise. `danger` nur für Löschen.

### Schrift

- Geist (400/500/600), lokal gebündelt, `font-feature-settings: 'tnum' 1` global.
- Typo-Skala laut `tokens.json` → `type`. Keine weiteren Größen erfinden.

### Layout

- Gerät: iPhone, Breite 390 als Referenz, fluid bis 430.
- Seitenrand 16, Kartenabstand 10, Karten-Innenabstand 16.
- Touch-Ziele min. 44 × 44, Listenzeilen min. 48 hoch.
- Safe Areas oben und unten berücksichtigen.

### App-Hülle und Scrollen (Pflicht, Lehre aus Mixli und Prototyp)

- `html`, `body` nicht scrollbar, `overscroll-behavior: none`, Höhe `100dvh`, kein Zoomen (`maximum-scale=1`, `user-scalable=no`, plus `touch-action: manipulation`).
- Pro Screen genau ein Scrollbereich: `flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain`.
- **Kinder des Scrollbereichs dürfen nicht schrumpfen** (`flex-shrink: 0`). Sonst werden Karten beim Aufklappen zusammengedrückt statt zu scrollen. Dieser Fehler trat im Prototyp auf.
- Unten 120 px Innenabstand, damit die schwebende Navigation nichts verdeckt.

### Icons

- Linien-Icons, 1,8–2 px Strich, runde Enden, 18–22 px. Keine Emojis. Icon-only-Knöpfe haben `aria-label`.

## 3. Komponenten

| Komponente | Vorgabe | Prototyp |
| --- | --- | --- |
| Karte | `card`, Radius 18 (Übersicht 24), kein Schatten | alle |
| Schwebende Navigation | Pill, links/rechts 20, unten 26, Höhe 62, Radius 31, Schatten `0 6px 24px rgba(0,0,0,.14)`; 5 Ziele: Tagebuch, Statistik, Hinzufügen (blaue Pill 64 × 46), Lebensmittel, Einstellungen; aktiv = `text`, inaktiv = `muted` | Kern |
| Tagesleiste | Datum „Do 15.10. · Heute“ (Tipp öffnet Monat), Pfeile, Kalender-Icon | Kern |
| Monatskalender | Klappt als Karte oben im Inhalt auf; heute blau gefüllt, Punkt unter vollständigen Tagen, Zukunft `muted` | Kern |
| Übersichtskarte | Ring 142 px / Strich 12 links mit Zahl „kcal übrig“, rechts 4 Makro-Balken (5 px, `text` auf `track`); darunter aufklappbare Zeile „Woche 10.302 / 19.600 kcal“ mit 7 Tagesbalken und gestricheltem Tagesziel | Kern |
| Wasser-Kachel | Tropfen-Icon, Leiste 4 px, „1,25 / 2,5 l“, „+“ für erste Schnellgröße | Kern |
| Slot-Karte | Chevron, Name, ggf. „2 Einträge“ (eingeklappt) bzw. „leer“, kcal rechts, „+“; aufgeklappt Einträge mit Trennlinien | Kern |
| Eintragszeile | Name + Menge (`muted`), kcal rechts; Tipp = bearbeiten; nach links wischen zeigt „Löschen“ (88 px, `danger`), Schwelle 44 px | Kern |
| Bottom-Sheet | Höhe bis 772 px, Radius oben 28, Griff 40 × 5, Scrim; Titel links, „Fertig“ rechts | Kern |
| Slot-Chips | Horizontal, aktiv Akzent-Fläche, sonst `card` | Kern |
| Suchfeld | Höhe 46, Radius 14, Lupe, daneben Scan-Knopf 46 × 46 | Kern |
| Ziffernblock | 3 × 4, Tasten 52–54 hoch, Radius 14, Ziffern 22 px; „,“ und „⌫“ | Kern, Schnell |
| Portions-Chips | Über dem Ziffernblock, Rahmen `line` | Kern |
| Hauptknopf | Höhe 54, Radius 16, Akzent-Fläche, 17 px/600 | alle |
| Segment-Umschalter | Spur `segmentTrack`, aktives Segment weiß mit leichtem Schatten | Lebensmittel, Statistik |
| Schalter | 52 × 32, an = Akzent, Knopf federt | Einstellungen |
| Toast | Unten, `text` als Fläche, Häkchen, 2,2 s | Kern |
| Geprüft-Markierung | Häkchen 12 px + „geprüft“ in `accentText`, Badge auf `accentSoft` | Lebensmittel, Produkt |

## 4. Motion

Alle Werte in `tokens.json` → `motion`. Umsetzung mit Motion (motion/react).

- Sheet fährt mit leichtem Federeffekt hoch, schließt schnell und ohne Feder.
- Schritte im Sheet (Suche → Menge) gleiten 18 px seitlich ein.
- Nach dem Hinzufügen: Ring, Zahl „kcal übrig“, Makro-Balken und Wochensumme zählen in 650 ms hoch; der neue Eintrag blinkt kurz in Akzent-Ton.
- Aufklappen (Slot, Woche, Kalender): Chevron dreht, Inhalt gleitet 8 px von oben ein.
- Press-Effekt auf allen Knöpfen: scale(.95).
- `prefers-reduced-motion: reduce`: alle Animationen aus, Werte und Zustände sofort.

## 5. Screens

Jeder Screen entspricht einem Prototyp. Beispieldaten im Prototyp sind nur Beispiele.

### Tagebuch – `Kern.dc.html`

- Aufbau von oben: Tagesleiste · (Monatskalender, aufgeklappt) · Übersichtskarte · Wasser-Kachel · Slot-Karten · schwebende Navigation.
- Ring zeigt Anteil gegessen am dynamischen Tagesziel; Zahl in der Mitte = übrig; bei Überschreitung orange und „kcal drüber“.
- Hinzufügen-Sheet: Slot-Chips · Suche + Scan · Schnelleintrag / Mahlzeiten / Rezepte · Liste „Zuletzt gegessen“ bzw. „Treffer lokal“ (Name, Quelle, geprüft-Häkchen, kcal/100) · „In Open Food Facts suchen“.
- Mengen-Schritt: Zurück, Produktname + Quelle + kcal/100 · große Menge mit Einheit und kcal · 4 Makro-Kacheln · Portions-Chips · Ziffernblock · „Zu Abend hinzufügen“ (beim Bearbeiten „Speichern“ + „Löschen“).
- Nach dem Hinzufügen bleibt das Sheet offen, Toast „Skyr natur · 158 kcal zu Snacks“.

### Leerer Tag – `Leer.dc.html`

- Ring leer, Zahl = dynamisches Tagesziel. Karte „Noch nichts eingetragen“ mit „Gestern: 2.850 kcal in 11 Einträgen“ und den Knöpfen „Wie gestern“ / „Tag kopieren…“. Alle Slots „leer“.

### Ersteinrichtung – `Start.dc.html` (Schritt 2 von 4)

- Fortschritt als 4 Striche. Schritte: 1 Slots, 2 Profil, 3 Optionen (Wasser, Schätzung), 4 Backup-Hinweis.
- Profil: Name, Wochenbudget mit „= 2.800 / Tag“, Makros mit Modus-Chip je Zeile (g/kg, %, Rest, g) und Ergebnis „≈ 133 g“, Körpergewicht-Hinweis.

### Scanner – `Scanner.dc.html`, `NichtGefunden.dc.html`

- Vollbild-Kamera, abgedunkelt außerhalb des Rahmens (290 × 170, Ecken weiß, Laser-Linie in Hellblau). Oben Schließen und Taschenlampe, unten „Code eintippen“.
- Treffer: Karte unten mit Name, Quelle, kcal/100, EAN und „Weiter“ → Mengen-Schritt. **Abweichung (Jan, 21.10.2026):** keine Trefferkarte, ein erkannter Code führt direkt zum Mengen-Schritt; während der Abfrage bei OFF eine Ladekarte „Suche EAN …“.
- „Code eintippen“ (kein Prototyp, Ergänzung 21.10.2026): Eingabekarte oben unter dem Kopf, damit die iPhone-Tastatur sie nicht verdeckt; Ziffernblock, Prüfziffer wird geprüft. Solange sie offen ist, ist die Kamera aus (dunkler Scanner-Hintergrund).
- Nicht gefunden: Sheet mit EAN und „Eigenes Produkt anlegen“ / „Lokal suchen“ / „Nochmal scannen“.
- Offline: Sheet „Kein Internet – Barcode gemerkt“, „Gemerkt für Abend · heute“, Anzahl offener Scans, „Jetzt manuell eintragen“ / „Später“.

### Schnelleintrag – `Schnell.dc.html`

- Slot-Chips, Name optional, große kcal-Zahl, 3 Makro-Felder; aktives Feld blau umrandet, Eingabe über den Ziffernblock. Darunter „Makros ergeben 832 kcal · passt“ (bei > 10 % Abweichung in `warnText`) und „Weitere Nährwerte“.

### Mahlzeit eintragen – `Mahlzeit.dc.html`

- Name, Summe kcal + „3 von 4 Bestandteilen“, 4 Makro-Kacheln, Skalierung ×0,5 / ×1 / ×1,5 / ×2, Liste mit Haken, Name, kcal, −/Menge/+. Abgewählte Zeilen 40 % Deckkraft. Knopf „3 Einträge zu Frühstück hinzufügen“.

### Lebensmittel – `Lebensmittel.dc.html`

- Titel + „Neu“, Suche, Reiter Produkte / Mahlzeiten / Rezepte, bei Produkten Filter-Chips Alle / Geprüft / Eigene / BLS. Zeilen: Name, Marke · Quelle, geprüft, kcal /100. Fußnote je Reiter, „Archiviert (3)“.

### Produktdetail – `Produkt.dc.html`

- Name, Marke · Menge · EAN, Badges Quelle und Prüfstatus.
- Karte Nährwerte: Umschalter „Meine Werte nutzen“ / „Original nutzen“; Tabelle Nährwert · Original · Meine; Abweichungen auf `accentSoft` markiert; nicht genutzte Spalte `muted`; „–“ = unbekannt.
- „Werte bearbeiten“ / „Als geprüft markieren“ bzw. „Prüfung entfernen“. Portionen, Getränk, „Zuletzt aus OFF geladen“, „Original jetzt aktualisieren“, „Archivieren“ in `warnText`.

### Rezept anlegen – `Rezept.dc.html`

- Abbrechen / Neues Rezept / Sichern. Name, Zutaten roh mit Summe, Endgewicht mit −/+ (50 g Schritte, Tipp öffnet Ziffernblock), Kochverlust, Karte „Pro 100 g fertig“ mit Makros und Portion „1 Teller 450 g = 608 kcal“.

### Statistik – `Statistik.dc.html`

- Segment Woche / 4 Wochen / 3 Monate. 3 Kacheln (Ø kcal/Tag, Vollständig, Bilanz).
- kcal pro Tag: Balken 4 px oben gerundet, vollständige Tage `accent`, unvollständige `neutralBar`, gestrichelte Linie Tagesziel mit Beschriftung, Legende; Tipp auf Balken hebt ihn hervor und zeigt den Wert oben rechts.
- Makros Ø gegen Ziel als 8 px Balken. Gewicht: Messpunkte `neutralBar` + Trendlinie `accent` 2 px, Link zur Schätzung. Wasser Ø.
- Eine Datenreihe pro Diagramm, keine zweite Achse, Werte nicht an jeden Balken schreiben.

### Einstellungen – `Einstellungen.dc.html`

- Gruppen: Ziele (Profile und Ziele, Mahlzeiten-Slots), Funktionen (Schalter Wasser, Verbrauchsschätzung mit „Details“), Daten (Backup mit Status und „Jetzt sichern“, Import, Export), Darstellung (System / Hell / Dunkel), Über (Version, Quellen OFF ODbL und BLS).
- Backup älter als 14 Tage: Statuszeile in `warnText`.

### Profile und Ziele – `Profil.dc.html`

- Profil-Chips (aktives mit Punkt) + „Neu“. Wochenbudget, Makros wie Ersteinrichtung, Wasser-Ziel, Körpergewicht für g/kg.
- Aktives Profil: Hinweis „Aktiv seit … Änderungen gelten ab heute“. Inaktives: Auswahl „Ab nächstem Montag“ (Standard) / „Ab heute“ + Knopf „Diät aktivieren“.

### Verbrauchsschätzung – `Schaetzung.dc.html`

- Ergebnis: „2.585 ± 150 kcal/Tag“, Skala mit Spanne und gestricheltem Budget, Vergleichstext „+215 kcal/Tag ≈ +0,2 kg pro Woche“, Satz „ändert dein Ziel nicht“, Datenbasis-Tabelle.
- Sammelt Daten: „Erste Schätzung in 5 vollständigen Tagen“, 14er-Raster.
- Gewicht: letzter Import, „Gewichte einfügen“ / „Manuell eintragen“, Hinweis auf Kurzbefehl. Nach Einfügen Toast „60 Werte gelesen · 1 neu · 0 doppelt“.

### Export – `Export.dc.html`

- Vorlagen-Karte „Monatsauswertung Claude“ (blau umrandet, wenn die Einstellungen genau der Vorlage entsprechen). Zeitraum-Chips, Ebene, Format, Spalten-Chips (nur passende Spalten je Ebene), Vorschau in Geist Mono, Knopf „30 Tage als JSON teilen“.
- CSV: Kopfzeile englische Schlüssel (`date,kcal,protein_g,…`), Komma als Trenner, Punkt als Dezimalzeichen, UTF-8.

## 6. Sprache und Formate

- Oberfläche Deutsch, Du-Form, kurz und sachlich.
- Zahlen mit deutschem Format; Eingabe mit Dezimalkomma. Exportdateien international.
- Einheiten: kcal, g, ml, l, kg. Kein kJ.
