# Kcalm – Projektplan

Stand: 17.10.2026 · Jan · maßgeblicher Plan für Claude Code. Erledigte Punkte hier abhaken.

## 1. Überblick

Kcalm ist eine minimalistische Offline-PWA fürs iPhone, mit der Jan Kalorien und Nährwerte gegen ein Wochenbudget aus wählbaren Profilen trackt, ohne Gamification, Streaks oder Maskottchen.

- **Name:** Kcalm (kcal + calm)
- **Adresse:** josepuerco.github.io/kcalm/
- **Nutzung:** erst, wenn alle Phasen fertig sind
- **Priorität:** höchste unter den offenen Projekten

| Bereich | Entscheidung | Begründung |
| --- | --- | --- |
| Plattform | PWA, nur iPhone als Testgerät | Kostenlos, kein Mac nötig, bewährt bei Mixli |
| Daten | Lokal auf dem Gerät (IndexedDB), sync-fähiges Datenmodell | Offline, kein Login; Pi-Sync später nachrüstbar |
| Hosting | GitHub Pages, öffentliches Repo `kcalm` | Kostenlos, Deploy per Push |
| Nutzer | Nur Jan, keine Accounts | Persönliche App |
| Produktdaten | Open Food Facts per Barcode, BLS 4.0 offline eingebaut, eigene Produkte | Markenprodukte + Grundlebensmittel |
| Bilder | Keine (weder OFF noch eigene) | Ruhe und Minimalismus |
| Ziele | kcal als Wochenbudget (Woche ab Montag), Makros pro Tag | Passt zum Ernährungsplan inkl. Essen außer Haus |
| Nährwerte | kcal, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz | EU-Pflichtangaben + Ballaststoffe; nur kcal, kein kJ |
| Essbarer Anteil | Kein Feature, Jan wiegt netto | Einfachheit |
| Wasser | Optional, im selben Tagebuch, nur Getränke | Trinkempfehlungen beziehen sich auf Getränke |
| Verbrauchsschätzung | Optional, Gewicht per Kurzbefehl aus Apple Health | Getrennt vom Ziel |
| Backup | Teilen-Menü → iCloud Drive, Ersatz per Download | Kein Server nötig |
| Export | CSV (international) + JSON, frei einstellbar | Monatsauswertung mit Claude + universell |
| Bewusst nicht | Gamification, Yazio-/Mixli-Import, kJ, Excel/PDF, Mikronährstoffe, Schritte, Android-Tests | Minimalismus |

## 2. Funktionsumfang

Der wichtigste Ablauf ist: beim Essen App öffnen, Slot wählen, Produkt scannen oder suchen, Menge eingeben, fertig. Alles andere ordnet sich dem unter.

### Tagebuch

- Tagesansicht mit frei festlegbaren Slots (Name, Reihenfolge, Anzahl, Uhrzeitfenster), Standard: Frühstück, Mittag, Snacks, Abend
- Slots einklappbar; eingeklappt zeigen sie Anzahl Einträge und kcal
- Tag beginnt um Mitternacht; Wechsel zu anderen Tagen per Pfeilen oder Monatskalender (klappt als Karte auf, Punkt = vollständig getrackt)
- Kopf der Tagesansicht: Ring mit „kcal übrig“ (dynamisches Tagesziel), Makros und Ballaststoffe gegen Tagesziel, aufklappbarer Wochenstand mit 7 Tagesbalken
- Ring wird orange und zeigt „kcal drüber“ bei Überschreitung
- Tag als „vollständig getrackt“ markieren (Grundlage für Verbrauchsschätzung und Monatsauswertung)
- Tag oder Slot kopieren, „wie gestern“, zuletzt gegessene Produkte als Vorschläge
- Einträge bearbeiten (Tipp), verschieben (anderer Slot/Tag), löschen (nach links wischen oder im Sheet)

### Hinzufügen

- „+“ in der Navigation öffnet das Hinzufügen-Sheet mit dem Slot, der zur Uhrzeit passt (oben umschaltbar); „+“ am Slot öffnet mit diesem Slot
- Nach dem Hinzufügen bleibt das Sheet offen (Bestätigung unten), „Fertig“ schließt
- **Suche:** zuerst lokal (eigene Produkte, zuletzt gegessen, Mahlzeiten, Rezepte, BLS), sofort und offline; Open-Food-Facts-Suche nur auf Knopfdruck
- **Barcode:** Scan per Tipp; Treffer aus lokalem Speicher, sonst Abfrage bei OFF; einmal geladene Produkte bleiben lokal
- **Offline-Scan:** Code wird gemerkt, Produkt später nachladen oder manuell anlegen
- **Nicht gefunden:** eigenes Produkt mit diesem Barcode anlegen
- **Schnelleintrag:** Name optional, kcal + Makros direkt, ohne Produkt (z. B. Essen außer Haus); Hinweis, wenn die Makros mehr als 10 % von den kcal abweichen (sperrt nichts)
- **Menge:** eigener Ziffernblock im Sheet (keine iPhone-Tastatur) mit Dezimalkomma, Portions-Chips darüber, kcal und Makros live

### Produkte

- Felder: Name, Marke, Barcode, Einheit (g oder ml), Nährwerte pro 100 g/ml, Portionsgrößen, „ist Getränk“, „zählt zum Wasser“
- Herkunft: OFF, BLS oder eigenes Produkt
- **Verifizieren (optional):** eigene Werte als Korrekturschicht über dem Original, Status „geprüft“ mit Datum; Tabelle Original gegen Meine Werte mit markierten Abweichungen; pro Produkt umschaltbar, welche Werte genutzt werden (gilt für künftige Einträge); ein späteres OFF-Update ändert nur das Original
- Fehlende Werte werden als „unbekannt“ geführt, nie als 0; Summen zeigen dann „mind. …“
- Pflichtangaben beim Anlegen eigener Produkte und beim Prüfen: Name und alle Werte der EU-Nährwerttabelle (Energie, Fett, davon gesättigte Fettsäuren, Kohlenhydrate, davon Zucker, Eiweiß, Salz); Ballaststoffe und Wasser optional
- Archivieren statt löschen, wenn das Produkt im Tagebuch verwendet wurde
- Lebensmittel-Liste mit Reitern Produkte / Mahlzeiten / Rezepte und Filtern Alle / Geprüft / Eigene / BLS; BLS-Lebensmittel erscheinen dort erst mit eigener Portion oder Prüfung
- Quellenhinweis auf OFF (ODbL) und BLS im Bereich „Über“

### Mahlzeiten

- Gruppe von Produkten mit Standardmengen (z. B. 60 g Haferflocken + 250 ml Milch + 1 Banane)
- Beim Eintragen: Bestandteile per Haken an/aus, Mengen mit −/+ oder Ziffernblock, Gesamtskalierung ×0,5 / ×1 / ×1,5 / ×2; Änderungen gelten nur für diesen Eintrag
- Im Tagebuch als Gruppe sichtbar, Bestandteile einzeln bearbeitbar

### Rezepte

- Zutaten mit Rohmengen + Endgewicht nach dem Kochen
- Ergebnis wird wie ein eigenes Produkt pro 100 g behandelt; Eintrag durch Abwiegen der Portion
- Kochverlust in % angezeigt; über 40 % Warnung, Endgewicht über roh → Hinweis
- Optional Portionen (z. B. „1 Teller = 450 g“); Änderungen am Rezept gelten nur für künftige Einträge

### Ziele und Profile

- Profile (z. B. Aufbau, Diät, Erhalt) mit Wochenbudget kcal und Makros pro Tag
- Makros je Makro wahlweise in g, in % des festen Tagesziels, in g/kg Körpergewicht (Eiweiß/Fett) oder als „Rest“ (übrige Kalorien, meist Kohlenhydrate)
- Körpergewicht für g/kg: Trendgewicht der Verbrauchsschätzung; ist sie aus, manuelles Feld im Profil
- Ballaststoffziel und Wasserziel pro Profil
- Profilwechsel manuell: „Ab nächstem Montag“ (Standard) oder „Ab heute“ mit anteilig umgerechnetem Restbudget der Woche
- Jeder Tag behält das damals gültige Profil (Snapshot)

### Wasser (optional, in Einstellungen abschaltbar)

- Kachel in der Tagesansicht mit Fortschrittsleiste gegen Tagesziel in ml und „+“ für die erste Schnellgröße
- Schnellgrößen konfigurierbar (z. B. 250 ml, 500 ml) + exakte Eingabe im Hinzufügen-Ablauf
- Getränke zählen mit ihrem Wassergehalt; Kaffee und Tee zählen mit; alkoholische Getränke standardmäßig nicht; Wasser aus Essen zählt nicht; pro Produkt umstellbar

### Statistiken

- Zeitraum: Woche, 4 Wochen, 3 Monate (3 Monate als Wochen-Ø)
- Kacheln: Ø kcal/Tag, vollständige Tage, Bilanz zum Ziel
- kcal pro Tag als Balken gegen gestrichelte Ziellinie; unvollständige Tage grau; Tipp auf Balken zeigt den Wert
- Makros Ø pro Tag gegen Ziel
- Gewicht: Messpunkte + Trendlinie (nur bei aktiver Verbrauchsschätzung)
- Wasser Ø pro Tag (nur bei aktivem Wasser)

### Verbrauchsschätzung (optional)

- Gewichte per iOS-Kurzbefehl aus Apple Health in die Zwischenablage → in der App „Gewichte einfügen“; Ersatz: manuelle Eingabe
- Mehrere Wiegungen an einem Tag: die erste des Tages zählt
- Ergebnis frühestens nach 14 vollständigen Tagen, nur aus vollständig getrackten Tagen, mit Spanne; davor Zustand „Sammelt Daten“ mit Fortschritt
- Bleibt getrennt vom Ziel; die App zeigt den Abstand zum Budget und die rechnerische Gewichtsänderung pro Woche

### Export

- Formate: CSV (international: Komma als Trenner, Punkt als Dezimalzeichen) und JSON
- Einstellbar: Zeitraum (Letzter Monat, 4 Wochen, Alles, frei), Ebene (Einträge / Slots / Tage / Wochen), Spalten
- Vorlage „Monatsauswertung Claude“: letzter Monat, Ebene Tage, JSON, Spalten Datum, Vollständig, kcal, Eiweiß, Kohlenhydrate, Fett, Ballaststoffe, Budget, Gewicht
- Live-Vorschau; Ausgabe über das Teilen-Menü, Ersatz per Download

### Backup

- Vollständiges JSON-Backup über das Teilen-Menü („In Dateien sichern“ → iCloud Drive), Ersatz per Download
- Import mit Prüfung, Wahl „ersetzen“ oder „zusammenführen“
- Erinnerung in den Einstellungen, wenn das letzte Backup älter als 14 Tage ist

### Ersteinrichtung

- 4 Schritte: Slots, erstes Profil, Optionen (Wasser, Verbrauchsschätzung), Hinweis auf Backup
- App startet ohne Beispieldaten

### Berechnungen

Intern wird exakt gerechnet, nur die Anzeige wird gerundet (kcal ganzzahlig, Makros eine Nachkommastelle, Salz zwei).

| Berechnung | Formel | Beispiel |
| --- | --- | --- |
| Nährwert eines Eintrags | Wert pro 100 × Menge ÷ 100 | Haferflocken 372 kcal/100 g, 60 g → 223,2 kcal (Anzeige 223) |
| Festes Tagesziel | Wochenbudget ÷ 7 | 19.600 kcal ÷ 7 = 2.800 kcal |
| Dynamisches Tagesziel | (Wochenbudget − Verbrauch der Vortage dieser Woche) ÷ verbleibende Tage inkl. heute; vorgeplante künftige Einträge zählen nicht | Mo–Mi 8.900 kcal → Do: (19.600 − 8.900) ÷ 4 = 2.675 kcal |
| Makro in % | Festes Tagesziel × Anteil ÷ kcal pro g (Eiweiß/KH 4, Fett 9) | 2.800 × 25 % ÷ 9 = 77,8 g Fett |
| Makro in g/kg | Faktor × Körpergewicht (Trend oder manuell) | 1,8 g/kg × 74,0 kg = 133,2 g Eiweiß |
| Makro „Rest“ | (Festes Tagesziel − kcal der anderen Makros) ÷ 4 | (2.800 − 133 × 4 − 78 × 9) ÷ 4 ≈ 392 g KH |
| Profilwechsel „ab heute“ | Neues Wochenbudget × verbleibende Tage ÷ 7 + bisheriger Verbrauch dieser Woche = Wochenbudget dieser Woche | Wechsel Do auf 15.400: 15.400 × 4 ÷ 7 + 8.900 = 17.700 |
| Wasser aus Getränk | BLS-Wassergehalt, sonst 100 − (Fett + KH + Eiweiß + Ballaststoffe + Salz); 1 ml ≈ 1 g | Cola: 100 − 10,6 = 89,4 % → 500 ml ergibt 447 ml |
| Rezept pro 100 g | Summe der Zutaten-Nährwerte ÷ Endgewicht × 100 | Chili 1.890 kcal, Endgewicht 1.400 g → 135 kcal/100 g; 450 g → 608 kcal |
| Makro-Plausibilität | Eiweiß × 4 + KH × 4 + Fett × 9 gegen kcal; > 10 % Abweichung → Hinweis | 38/80/40 g → 832 kcal gegen 850 kcal: passt |
| Gewichtstrend | Exponentiell geglätteter Mittelwert der Tageswerte (Faktor in Phase 9 mit Tests festlegen, Startwert 0,1–0,15) | Schwankungen von ±1 kg glätten |
| Verbrauchsschätzung | Ø Zufuhr der vollständigen Tage − (Trendänderung kg × 7.700) ÷ Tage | 28 Tage, Ø 2.750 kcal, Trend +0,6 kg → 2.750 − 165 = 2.585 kcal (± Spanne) |
| Spanne | Aus Streuung der Gewichte und Anzahl der Tage; wird mit mehr Daten kleiner | Nach 14 Tagen breit, nach 28 Tagen ca. ±150 kcal |

## 3. Tech-Stack und Datenquellen

Der Stack entspricht Mixli, ergänzt um Scanner, Diagramme und ein Build-Skript für den BLS.

| Bereich | Wahl | Wofür |
| --- | --- | --- |
| Grundgerüst | React + TypeScript + Vite | App-Struktur, Typsicherheit |
| Styling | Tailwind CSS mit Design-Tokens | Einheitliches Design aus `design/tokens.json` |
| Animation | Motion (motion/react) | Übergänge, Sheets, animierte Zahlen |
| Lokale Datenbank | Dexie.js (IndexedDB) | Alle Daten auf dem Gerät |
| PWA/Offline | vite-plugin-pwa (Workbox) | Installierbar, offline, Updates |
| Validierung | Zod | Eingaben, OFF-Antworten, Backup-Import, Gewichte einfügen |
| Tests | Vitest | Rechenlogik, Parser, Backup |
| Barcode | barcode-detector (ZXing als WebAssembly), Decoder-Datei selbst gehostet | Scannen auf iOS, auch offline |
| Diagramme | Schlanke Bibliothek oder eigenes SVG (Entscheidung in Phase 8 mit Begründung) | Statistiken |
| BLS-Aufbereitung | Node-Skript: BLS-Excel → kompakte JSON-Datei | Offline-Suche über Grundlebensmittel |
| Schrift | Geist, lokal gebündelt (@fontsource) | Offline |

### Open Food Facts

- Lesezugriff ohne Account; App-Kennung über die Parameter `app_name`, `app_version`, `app_uuid` (User-Agent ist im Browser nicht setzbar)
- Nur benötigte Felder abfragen (Name, Marke, Menge, Nährwerte pro 100 g/ml, Kategorien)
- Geladene Produkte lokal speichern; keine erneute Abfrage, solange nicht manuell aktualisiert
- Lizenz ODbL: Quellenhinweis in der App; Produktdaten werden nicht veröffentlicht
- Kurztest (21.10.2026): Produktabfrage `/api/v2/product/{code}.json` mit CORS (`*`), unbekannter Code = HTTP 404 mit `status: 0`; Textsuche `/cgi/search.pl` mit CORS, aber oft 503; `search.openfoodfacts.org` ohne CORS (im Browser gesperrt). Limits: 100 Produktabfragen und 10 Suchen pro Minute

### Bundeslebensmittelschlüssel (BLS 4.0)

- Kostenfrei nutzbar, ausdrücklich auch für App-Entwicklung ([BLS-FAQ](https://blsdb.de/faq)); Quellenhinweis: Max Rubner-Institut (2025), BLS 4.0
- Quelle: Excel-Hauptdatei `BLS_4_0_Daten_2025_DE.xlsx` in `data/bls/`, Werte pro 100 g essbaren Anteil; je Nährstoff drei Spalten (Gehalt, Herkunft, Referenz)
- Skript übernimmt nur: Code, Name, Energie kcal, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz, Wasser
- Fehlende Werte bleiben leer (nicht 0)
- Ergebnis-JSON liegt im Repo und im Offline-Cache

### Barcode-Scanner

- Kamerastart nur per Tipp (iOS-Vorgabe)
- Decoder-Datei (ca. 1 MB) im Build mitliefern und in den Offline-Cache aufnehmen
- Formate: EAN-13, EAN-8, UPC-A, UPC-E
- Taschenlampe falls verfügbar, manuelle Code-Eingabe als Ersatz

### Gewicht aus Apple Health

- iOS-Kurzbefehl liest Gewichtsproben (z. B. letzte 60 Tage) und kopiert sie als Text
- App liest die Zwischenablage nach Tipp auf „Gewichte einfügen“; Ersatz: Textfeld zum Einfügen
- Format wird mit Zod geprüft; doppelte Tage werden zusammengeführt (erste Messung zählt)

### Entwicklung und Hosting

- Entwicklung lokal auf dem Windows-Laptop mit Claude Code, Projektordner `C:\Users\Jan\Documents\Claude Projekte\kcalm`
- GitHub Pages per GitHub Actions bei Push auf `main`
- Unterpfad: Vite `base: '/kcalm/'`, Manifest `scope` und `start_url` = `/kcalm/`
- Test auf dem iPhone 16e: installieren, Flugmodus-Test, Scanner-Test im Supermarkt
- Feste App-Hülle gegen Gummiband-Scrollen und Zoomen (Lehre aus Mixli)

## 4. Datenmodell

Alle Tabellen sind sync-fähig angelegt, und jeder Tagebucheintrag speichert seine eigenen Nährwerte, damit alte Tage nie nachträglich kippen.

### Gemeinsame Regeln

- Jeder Datensatz hat: `id` (UUID), `createdAt`, `updatedAt`, `deletedAt` (Löschmarker statt echtem Löschen)
- **Nährwert-Objekt** `Nutrients`: kcal, fat, satFat, carbs, sugar, fiber, protein, salt, water; jeder Wert Zahl oder `null` (= unbekannt, nie 0)
- Datum als lokales Kalenderdatum `YYYY-MM-DD` (Tag beginnt um Mitternacht)
- Abgeleitete Werte (Summen, Tagesziele, Trend, Schätzung) werden berechnet, nicht gespeichert
- BLS-Daten liegen statisch in der App und werden über ihren BLS-Code referenziert, nicht in die Datenbank kopiert

### Tabellen

| Tabelle | Wichtige Felder | Hinweis |
| --- | --- | --- |
| products | source (off / own / recipe), barcode?, name, brand?, unit (g / ml), per100: Nutrients, portions [{label, amount}], isDrink, countsAsWater, useOverride, archived, offFetchedAt? | OFF-Produkte werden hier lokal gespeichert |
| productOverrides | productRef (Produkt-ID oder BLS-Code), per100: Nutrients (nur geänderte Felder), verifiedAt?, note? | Korrekturschicht fürs Verifizieren; Original bleibt unverändert |
| blsPrefs | blsCode, portions, isDrink?, countsAsWater? | Eigene Portionen und Wasser-Einstellung für BLS-Lebensmittel |
| meals | name, items [{ref, amount, unit, portionLabel?}], archived | Mahlzeiten-Vorlagen |
| recipes | name, ingredients [{ref, amount}], finalWeightG, portions, archived | Berechnung pro 100 g aus Zutaten ÷ Endgewicht |
| slots | name, order, timeFrom?, timeTo?, archived | Frei festlegbare Mahlzeiten-Slots mit Uhrzeitfenster |
| entries | date, slotId, kind (food / quick / water), ref?, nameSnapshot, amount, unit, portionLabel?, nutrients (Snapshot, absolut), waterMl, mealGroupId?, mealName? | Ein Eintrag pro Lebensmittel; Mahlzeiten über mealGroupId gruppiert |
| days | date, complete | Nur Tage mit Markierung |
| profiles | name, archived | Z. B. Aufbau, Diät |
| profileVersions | profileId, weeklyKcal, protein / fat / carbs (Wert + Modus: g, %, g/kg, rest), fiberG?, waterMl?, manualWeightKg? | Ändern erzeugt eine neue Version, alte bleibt für die Historie |
| profileAssignments | validFrom (Datum), profileVersionId, weekBudgetOverride? | Welche Version ab welchem Tag gilt; Override für anteiligen Wechsel „ab heute“ |
| weights | date, kg, source (health / manual), measuredAt | Ein Wert pro Tag (erste Messung), nur bei aktiver Schätzung |
| pendingScans | barcode, scannedAt, slotId?, date? | Offline gescannte Codes |
| settings | key, value | Wasser an/aus, Schätzung an/aus, Schnellgrößen, Darstellung, letzte Sicherung, App-UUID für OFF |

### Backup-Format

- JSON: `{ app: "kcalm", formatVersion: 1, exportedAt, tables: { … } }`
- Enthält alle Tabellen inkl. gelöschter Datensätze (wichtig für späteren Sync), ohne BLS-Stammdaten
- Import prüft mit Zod; bei älterer `formatVersion` Migration vor dem Import
- „Ersetzen“: alles neu; „Zusammenführen“: pro `id` gewinnt der neuere `updatedAt`

## 5. Design und UI

Verbindliche Vorgabe ist `design/DESIGN.md` zusammen mit `design/tokens.json` und den Prototypen in `design/prototypes/`. Kurzfassung:

- Stil „Mix 1“: Tagesleiste mit Datum und Kalender-Knopf, abgerundete Karten, großer Ring mit „kcal übrig“ und Makros daneben, aufklappbare Woche, Wasser-Kachel, einklappbare Slots, schwebende Pill-Navigation
- Schrift Geist, Akzent Blau #3D5AFE
- Heller und dunkler Modus, Standard folgt der iPhone-Einstellung, manuell umschaltbar
- Touch-Ziele mindestens 44 px, Bottom-Sheets statt Popups, Linien-Icons, keine Emojis, keine Gamification
- „Bewegung reduzieren“ respektieren: Animationen aus, Zustandswechsel sofort

## 6. Phasenplan

Zwölf Phasen in der Reihenfolge Fundament → Daten → Sicherung → Kernnutzen → Extras → Feinschliff; genutzt wird die App erst nach Phase 11.

### Phase 0 – Fundament

- [x] Projekt aufsetzen (Vite, React, TypeScript, Tailwind mit Tokens, Motion, Dexie, Zod, Vitest)
- [x] PWA unter `/kcalm/` installierbar und offline, Schrift lokal gebündelt
- [x] Feste App-Hülle: kein Gummiband-Scrollen, kein Zoomen, Safe Areas, Scrollbereich nach DESIGN.md
- [x] Hell/Dunkel über Tokens, Standard System
- [x] Schwebende Navigation mit leeren Screens nach DESIGN.md
- [x] Bausteine mit Vorschauseite: Karte, Buttons, Chips, Segment-Umschalter, Schalter, Bottom-Sheet, Ziffernblock, Fortschrittsleiste, Ring, Toast
- [x] GitHub Pages per Actions, Installations- und Offline-Test auf dem iPhone

### Phase 1 – Produkte und BLS

- [x] Datenmodell (alle Tabellen, sync-fähige Felder) mit Tests
- [x] BLS-Skript: Excel → JSON, mit Tests für fehlende Werte
- [x] Eigene Produkte anlegen, bearbeiten, archivieren; Portionsgrößen
- [x] Lebensmittel-Liste mit Reitern, Filtern und Suche
- [x] Lokale Suche über eigene Produkte und BLS
- [x] Rechenfunktion Nährwert pro Menge inkl. „unbekannt“ mit Tests

### Phase 2 – Backup

- [x] Export als JSON mit `formatVersion` über Teilen-Menü, Ersatz per Download
- [x] Import mit Zod-Prüfung, „ersetzen“ und „zusammenführen“
- [x] Erinnerung nach 14 Tagen, `navigator.storage.persist()`
- [x] Test: Daten anlegen → exportieren → App löschen → neu installieren → importieren

### Phase 3 – Tagebuch und Ziele (Kern)

- [x] Ersteinrichtung (4 Schritte)
- [x] Slots frei festlegbar mit Uhrzeitfenster
- [x] Tagesansicht nach Prototyp `Kern.dc.html`, Tageswechsel, Monatskalender, einklappbare Slots
- [x] Hinzufügen-Sheet mit Suche, Mengen-Schritt, Ziffernblock, Portions-Chips; im Sheet bleiben
- [x] Einträge bearbeiten, verschieben, löschen (Wischen + Sheet)
- [x] Schnelleintrag (kcal + Makros) mit Plausibilitätshinweis
- [x] Profile mit Versionen, Zuweisung ab Datum, Wechsel „ab nächstem Montag“ / „ab heute“
- [x] Rechenlogik festes und dynamisches Tagesziel, Wochenstand, Makros in g / % / g/kg / Rest, Profilwechsel mit Tests
- [x] Tag kopieren, „wie gestern“, zuletzt gegessen, Tag als vollständig markieren, leerer Tag

### Phase 4 – Open Food Facts und Barcode

- [x] Kurztest: OFF aus dem Browser erreichbar (CORS), Antwortformat
- [ ] Barcode-Scanner mit selbst gehostetem Decoder, Start per Tipp, Taschenlampe, manuelle Eingabe
- [x] OFF-Abfrage mit App-Kennung, Zod-Prüfung, lokales Speichern
- [ ] OFF-Textsuche auf Knopfdruck
- [x] Offline-Scans merken und nachladen; „nicht gefunden“ → eigenes Produkt mit Barcode
- [ ] Scanner-Test im Supermarkt

### Phase 5 – Mahlzeiten und Rezepte

- [ ] Mahlzeiten anlegen, eintragen mit Haken, anpassbaren Mengen und Skalierung
- [ ] Rezepte mit Endgewicht und Kochverlust, Rechenfunktion mit Tests, Eintragen per Portion

### Phase 6 – Verifizieren

- [ ] Korrekturschicht für OFF- und BLS-Werte, Status „geprüft“, Tabelle mit Abweichungen, Umschalter Meine/Original
- [ ] „Als geprüft markieren“ nur, wenn alle Pflichtangaben der Nährwerttabelle vorhanden sind (`REQUIRED_NUTRIENTS`)
- [ ] OFF-Aktualisierung überschreibt Korrekturen nicht (Test)

### Phase 7 – Wasser

- [ ] Schalter in Einstellungen, Tagesziel im Profil
- [ ] Wasser-Kachel, Schnellgrößen + exakte Eingabe im Hinzufügen-Ablauf
- [ ] Wassergehalt-Berechnung und Getränke-Regeln mit Tests

### Phase 8 – Statistiken

- [ ] Entscheidung Diagramm-Bibliothek vs. eigenes SVG
- [ ] Kacheln, kcal pro Tag, Makros, Wasser; Zeitraumwahl; Tipp zeigt Wert

### Phase 9 – Verbrauchsschätzung

- [ ] Schalter in Einstellungen, Gewichte einfügen (Zwischenablage) und manuell
- [ ] Trendgewicht, Schätzung und Spanne als reine Funktionen mit Tests (Grenzfälle: Lücken, wenig Tage, unvollständige Tage, mehrere Messungen pro Tag)
- [ ] Screen mit Ergebnis / „Sammelt Daten“, Abstand zum Budget, Gewichtstrend in der Statistik
- [ ] g/kg-Makros nutzen das Trendgewicht

### Phase 10 – Export

- [ ] CSV (international) und JSON, Zeitraum, Ebene, Spalten wählbar, Live-Vorschau
- [ ] Vorlage „Monatsauswertung Claude“

### Phase 11 – Feinschliff

- [ ] Motion-Feinschliff, App-Icon, Splashscreen, Name im Manifest
- [ ] Vorschauseite im Build ausblenden, „Über“ mit Quellenhinweisen OFF und BLS
- [ ] Offline- und Backup-Test, alle Phasen abgehakt
- [ ] Anleitung inkl. Kurzbefehl für Apple Health

## 7. Entscheidungen zu früher offenen Fragen

| Frage | Entscheidung |
| --- | --- |
| Profilwechsel mitten in der Woche | Beide Optionen: „Ab nächstem Montag“ (Standard) oder „Ab heute“ mit anteilig umgerechnetem Restbudget |
| Vorgeplante Einträge im dynamischen Tagesziel | Zählen nicht; das dynamische Ziel rechnet nur mit Vortagen und heute |
| Basis für Makros in % | Festes Tagesziel (Wochenbudget ÷ 7) |
| Mehrere Wiegungen an einem Tag | Erste Messung des Tages zählt |
| Energiedichte Verbrauchsschätzung | Fest 7.700 kcal/kg |
| Pflichtfelder eigener Produkte | Name + alle Werte der EU-Nährwerttabelle (LMIV Art. 30); gilt auch beim Prüfen (Jan, 17.10.2026) |
| BLS-Kürzel „TR“, „<LOD“, „<LOQ“ | Als 0 übernehmen; nur „-“ (fehlender Wert) wird `null` |
| Nährwert Alkohol | Entfällt: wird nicht getrackt, auch nicht aus BLS oder OFF übernommen (Backup-Format 2, Datenbank-Version 2). Ob ein Getränk alkoholisch ist (Phase 7, Wasser), kommt aus der OFF-Kategorie bzw. der BLS-Code-Gruppe (Jan, 21.10.2026) |
| OFF-Produkte nur mit kJ | kcal = kJ ÷ 4,184 beim Laden; kJ wird nie angezeigt oder gespeichert (Jan, 21.10.2026) |
| OFF-Treffer ohne kcal | Wird nicht gespeichert; „Eigenes Produkt anlegen“ mit vorbefülltem Formular (Name, Marke, Barcode, bekannte Werte). Das OFF-Original wird nie überschrieben (Jan, 21.10.2026) |
| „Werte bearbeiten“ bei OFF-Produkten | Bis zur Korrekturschicht (Phase 6) ausgeblendet; Portionen bleiben änderbar (Jan, 21.10.2026) |
| Offline-Scan „Jetzt manuell eintragen“ | Öffnet den Schnelleintrag, der gemerkte Scan gilt als erledigt; OFF nicht erreichbar (Netz da) zeigt „Open Food Facts nicht erreichbar“ (Jan, 21.10.2026) |
| Gemerkte Scans nachladen | Still beim Start, bei Netz zurück und beim Zurückkehren in die App; Zeile „2 gemerkte Scans“ über den Slots, Liste im Sheet, Tipp → Menge im gemerkten Slot und Tag (bzw. Produktformular), Wischen verwirft. „Nicht gefunden“ merkt sich nur die Sitzung, kein neues Feld (Jan, 21.10.2026) |
| Spalten „Monatsauswertung Claude“ | Ebene Tage, JSON: Datum, Vollständig, kcal, Eiweiß, Kohlenhydrate, Fett, Ballaststoffe, Budget, Gewicht |

Offen nur noch:

- [x] BLS-Excel `BLS_4_0_Daten_2025_DE.xlsx` von blsdb.de herunterladen und nach `data/bls/` legen (Jan, vor Phase 1)

## 8. Zwischenstand

Hier trägt Claude Code beim Pausieren mitten in einer Phase ein, was erledigt ist und was als Nächstes kommt.

**21.10.2026 · Phase 3 abgeschlossen** – alle Punkte erledigt (Teilschritte 3a–3g, je ein Commit), deployt und von Jan auf dem iPhone getestet. 439 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 4 (Open Food Facts und Barcode), vorher Kurztest OFF aus dem Browser (CORS).

- Nach Jans iPhone-Test ergänzt (`77d08d6`): Tagesbudget im Profil direkt eintippbar (× 7 aufs Wochenbudget), Modus-Chip rechnet den Wert um (Gramm bleiben gleich, gerundet), alle drei Makros in % müssen genau 100 % ergeben (Summe live sichtbar), vollständige Tage sichtbar (Häkchen-Badge in der Tagesleiste, Übersichts- und Schalter-Karte blau getönt, Punkte in der Woche).

- Erledigt: Rechenlogik `dates.ts`, `goals.ts`, `profiles.ts`, `diary.ts`, `addFood.ts`, `quickEntry.ts`, `copyDay.ts`, `slots.ts`, `profileForm.ts`; Ersteinrichtung (4 Schritte, speichert am Ende in einer Transaktion), Slot-Editor, Tagesansicht, Hinzufügen-Sheet, Bearbeiten/Verschieben/Löschen, Schnelleintrag, Profile und Ziele, Tag kopieren / „Wie gestern“ / vollständig.
- Mit Jan abgestimmt: Künftige Tage zeigen das heutige Ziel (vorgeplante Einträge zählen nicht), in künftigen Wochen Budget ÷ 7; dynamisches Ziel darf negativ werden („kcal drüber“); Rest negativ → 0 g + Hinweis; g/kg ohne Gewicht → unbekannt; Override „ab heute“ gilt nur in seiner Woche; Bearbeiten des aktiven Profils gilt ab heute (anteilig); erstes Profil mitten in der Woche bekommt den anteiligen Wochenrest, Tage davor zählen nicht (`countFrom`); festes Tagesziel immer aus dem Wochenbudget der Version.
- Abweichungen vom Prototyp (mit Jan abgestimmt): Monatspfeile im Kalender, Kalenderfelder 44 px, Tageszeile zum Verschieben im Bearbeiten-Sheet, „Zurück“ beim Bearbeiten schließt, Schnelleintrag zeigt „–“ statt „0“, „Sichern“ in Profile und Ziele, Profilformular mit Name und Vorlagen-Umschalter, Schalter „Tag vollständig getrackt“ unter den Slots, Kopier-Sheet eigenes Design. Wasser-Kachel und Wasser-Ziel folgen in Phase 7, Scan/OFF in Phase 4, Mahlzeiten/Rezepte in Phase 5.
- Einträge speichern bis Phase 7 `waterMl: 0`.

**21.10.2026 · Phase 2 abgeschlossen** – alle Punkte erledigt, deployt, Backup-Test (anlegen → sichern → App löschen → neu installieren → importieren) von Jan auf dem iPhone bestanden. Nächster Schritt: Phase 3 (Tagebuch und Ziele).

- Erledigt: `src/logic/backup.ts` (Format, Zod-Schema, Migrationsgerüst, Zusammenführen, Erinnerungstext), `src/db/backup.ts` (Ersetzen/Zusammenführen in einer Transaktion), `src/app/share.ts` (Teilen, Ersatz Download), Gruppe „Daten“ in den Einstellungen mit Import-Sheet, `navigator.storage.persist()` beim Start. 231 Tests grün, Build und Lint sauber.
- Mit Jan abgestimmt: Zusammenführen vergleicht bei eindeutigen Schlüsseln (days.date, settings.key, productOverrides.productRef, blsPrefs.blsCode) über den Schlüssel; Abbrechen im Teilen-Menü zählt nicht als Backup; Import-Sheet ist eigenes Design (kein Prototyp); `lastBackupAt` in settings, nach Import der spätere aus eigenem Wert und `exportedAt`.
- Prüfung: Struktur und Typen streng, Inhalte großzügig (z. B. keine Mindestwerte), damit eigene Daten immer importierbar bleiben.

**17.10.2026 · Phase 1 abgeschlossen** – alle Punkte erledigt, deployt und von Jan auf dem iPhone getestet. Nächster Schritt: Phase 2 (Backup).

- Erledigt: Datenmodell (`src/db/`), BLS-Skript (`npm run bls` → `public/bls.json`), Nährwert pro Menge, Suche, Lebensmittel-Liste, Produkt anlegen/bearbeiten/archivieren/löschen, Produkt- und BLS-Detail mit Portionen, Theme-Wahl gespeichert. 183 Tests grün.
- Abweichungen (mit Jan abgestimmt): Formular als eigener Screen (kein Prototyp), Zahlen über iPhone-Zifferntastatur, BLS-Treffer als eigener Abschnitt in der Listen-Suche, Pflichtangaben nach LMIV.
- iPhone-Test durch Jan erledigt: Formular, Portionen-Sheet, BLS-Suche offline.

**17.10.2026 · Phase 0 abgeschlossen** – nächster Schritt: Phase 1 (Produkte und BLS). Vorher BLS-Excel nach `data/bls/` legen.

- iOS 26 legt bei installierten Web-Apps einen Unschärfe-Streifen (~40 pt) unter die Statusleiste. Kopf in `display-mode: standalone` daher bei Safe Area + 44 px (Abweichung vom Prototyp, `src/styles/index.css`). Auf dem iPhone 16e geprüft. Symptom vorher: Screen-Titel lag verschwommen im Streifen (Debug-Screenshot `shadow_issue.jpeg`, nach der Lösung gelöscht); behoben in `82dba0d`.

Verlauf:

- Erledigt: Projekt-Setup, Tokens → Tailwind (Generator `scripts/build-tokens.ts`), PWA, App-Hülle, Navigation, leere Screens, Bausteine + Vorschau (Einstellungen → „Bausteine (Vorschau)“), Workflow `.github/workflows/deploy.yml`. 33 Tests grün, Build und Lint sauber.
- `tokens.json` ergänzt (mit Jans OK): `type.label` 14, `type.unit` 20, Radien `calendar`/`button`/`tile`/`smallButton`, Farben `switchOff`, `segmentActive`, Abschnitt `shadow`.
- Theme-Wahl wird noch nicht gespeichert (kommt mit der `settings`-Tabelle in Phase 1).
- Sichtprüfung im Browser, GitHub Pages, Installations- und Offline-Test auf dem iPhone 16e durch Jan erledigt.
