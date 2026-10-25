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
| Verbrauchsschätzung | Optional, Gewicht per Kurzbefehl aus Apple Health | Getrennt vom Ziel |
| Backup | Teilen-Menü → iCloud Drive, Ersatz per Download | Kein Server nötig |
| Export | CSV (international) + JSON, frei einstellbar | Monatsauswertung mit Claude + universell |
| Bewusst nicht | Gamification, Yazio-/Mixli-Import, kJ, Excel/PDF, Mikronährstoffe, Wasser-Tracking, Schritte, Android-Tests | Minimalismus |

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

- Felder: Name, Marke, Barcode, Einheit (g oder ml), Nährwerte pro 100 g/ml, Portionsgrößen
- Herkunft: OFF, BLS oder eigenes Produkt
- **Verifizieren (optional):** eigene Werte als Korrekturschicht über dem Original, Status „geprüft“ mit Datum; Tabelle Original gegen Meine Werte mit markierten Abweichungen; pro Produkt umschaltbar, welche Werte genutzt werden (gilt für künftige Einträge); ein späteres OFF-Update ändert nur das Original
- Fehlende Werte werden als „unbekannt“ geführt, nie als 0; Summen zeigen dann „mind. …“
- Pflichtangaben beim Anlegen eigener Produkte und beim Prüfen: Name und alle Werte der EU-Nährwerttabelle (Energie, Fett, davon gesättigte Fettsäuren, Kohlenhydrate, davon Zucker, Eiweiß, Salz); Ballaststoffe optional
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
- Ballaststoffziel pro Profil
- Profilwechsel manuell: „Ab nächstem Montag“ (Standard) oder „Ab heute“ mit anteilig umgerechnetem Restbudget der Woche
- Jeder Tag behält das damals gültige Profil (Snapshot)

### Statistiken

- Zeitraum: Woche, 4 Wochen, 3 Monate (3 Monate als Wochen-Ø)
- Kacheln: Ø kcal/Tag, vollständige Tage, Bilanz zum Ziel
- kcal pro Tag als Balken gegen gestrichelte Ziellinie; unvollständige Tage grau; Tipp auf Balken zeigt den Wert
- Makros Ø pro Tag gegen Ziel
- Gewicht: Messpunkte + Trendlinie (nur bei aktiver Verbrauchsschätzung)

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

- 4 Schritte: Slots, erstes Profil, Optionen (Verbrauchsschätzung), Hinweis auf Backup
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
- Textsuche in Phase 4 (21.10.2026): `search.pl` antwortet meist mit 503; die App versucht es je Tipp bis zu dreimal (Pause 1 s, 2 s), danach Hinweis „antwortet gerade nicht“. Produktabfrage per Barcode ist nicht betroffen

### Bundeslebensmittelschlüssel (BLS 4.0)

- Kostenfrei nutzbar, ausdrücklich auch für App-Entwicklung ([BLS-FAQ](https://blsdb.de/faq)); Quellenhinweis: Max Rubner-Institut (2025), BLS 4.0
- Quelle: Excel-Hauptdatei `BLS_4_0_Daten_2025_DE.xlsx` in `data/bls/`, Werte pro 100 g essbaren Anteil; je Nährstoff drei Spalten (Gehalt, Herkunft, Referenz)
- Skript übernimmt nur: Code, Name, Energie kcal, Fett, gesättigte Fettsäuren, Kohlenhydrate, Zucker, Ballaststoffe, Eiweiß, Salz
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
- **Nährwert-Objekt** `Nutrients`: kcal, fat, satFat, carbs, sugar, fiber, protein, salt; jeder Wert Zahl oder `null` (= unbekannt, nie 0)
- Datum als lokales Kalenderdatum `YYYY-MM-DD` (Tag beginnt um Mitternacht)
- Abgeleitete Werte (Summen, Tagesziele, Trend, Schätzung) werden berechnet, nicht gespeichert
- BLS-Daten liegen statisch in der App und werden über ihren BLS-Code referenziert, nicht in die Datenbank kopiert

### Tabellen

| Tabelle | Wichtige Felder | Hinweis |
| --- | --- | --- |
| products | source (off / own / recipe), barcode?, name, brand?, unit (g / ml), per100: Nutrients, portions [{label, amount}], useOverride, archived, offFetchedAt? | OFF-Produkte werden hier lokal gespeichert |
| productOverrides | productRef (Produkt-ID oder BLS-Code), per100: Nutrients (nur geänderte Felder), verifiedAt?, note? | Korrekturschicht fürs Verifizieren; Original bleibt unverändert |
| blsPrefs | blsCode, portions, useOverride | Eigene Portionen und Umschalter Meine/Original für BLS-Lebensmittel |
| meals | name, items [{ref, amount, unit, portionLabel?}], archived | Mahlzeiten-Vorlagen |
| recipes | name, ingredients [{ref, amount}], finalWeightG, portions, archived | Berechnung pro 100 g aus Zutaten ÷ Endgewicht |
| slots | name, order, timeFrom?, timeTo?, archived | Frei festlegbare Mahlzeiten-Slots mit Uhrzeitfenster |
| entries | date, slotId, kind (food / quick), ref?, nameSnapshot, amount, unit, portionLabel?, nutrients (Snapshot, absolut), mealGroupId?, mealName? | Ein Eintrag pro Lebensmittel; Mahlzeiten über mealGroupId gruppiert |
| days | date, complete | Nur Tage mit Markierung |
| profiles | name, archived | Z. B. Aufbau, Diät |
| profileVersions | profileId, weeklyKcal, protein / fat / carbs (Wert + Modus: g, %, g/kg, rest), fiberG?, manualWeightKg? | Ändern erzeugt eine neue Version, alte bleibt für die Historie |
| profileAssignments | validFrom (Datum), profileVersionId, weekBudgetOverride? | Welche Version ab welchem Tag gilt; Override für anteiligen Wechsel „ab heute“ |
| weights | date, kg, source (health / manual), measuredAt | Ein Wert pro Tag (erste Messung), nur bei aktiver Schätzung |
| pendingScans | barcode, scannedAt, slotId?, date? | Offline gescannte Codes |
| settings | key, value | Schätzung an/aus, Darstellung, letzte Sicherung, App-UUID für OFF |

### Backup-Format

- JSON: `{ app: "kcalm", formatVersion: 1, exportedAt, tables: { … } }`
- Enthält alle Tabellen inkl. gelöschter Datensätze (wichtig für späteren Sync), ohne BLS-Stammdaten
- Import prüft mit Zod; bei älterer `formatVersion` Migration vor dem Import
- „Ersetzen“: alles neu; „Zusammenführen“: pro `id` gewinnt der neuere `updatedAt`

## 5. Design und UI

Verbindliche Vorgabe ist `design/DESIGN.md` zusammen mit `design/tokens.json` und den Prototypen in `design/prototypes/`. Kurzfassung:

- Stil „Mix 1“: Tagesleiste mit Datum und Kalender-Knopf, abgerundete Karten, großer Ring mit „kcal übrig“ und Makros daneben, aufklappbare Woche, einklappbare Slots, schwebende Pill-Navigation
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
- [x] Barcode-Scanner mit selbst gehostetem Decoder, Start per Tipp, Taschenlampe, manuelle Eingabe
- [x] OFF-Abfrage mit App-Kennung, Zod-Prüfung, lokales Speichern
- [x] OFF-Textsuche auf Knopfdruck
- [x] Offline-Scans merken und nachladen; „nicht gefunden“ → eigenes Produkt mit Barcode
- [x] Scanner-Test im Supermarkt

### Phase 5 – Mahlzeiten und Rezepte

- [x] Mahlzeiten anlegen, eintragen mit Haken, anpassbaren Mengen und Skalierung
- [x] Rezepte mit Endgewicht und Kochverlust, Rechenfunktion mit Tests, Eintragen per Portion

### Phase 6 – Verifizieren

- [x] Korrekturschicht für OFF- und BLS-Werte, Status „geprüft“, Tabelle mit Abweichungen, Umschalter Meine/Original
- [x] „Als geprüft markieren“ nur, wenn alle Pflichtangaben der Nährwerttabelle vorhanden sind (`REQUIRED_NUTRIENTS`)
- [x] OFF-Aktualisierung überschreibt Korrekturen nicht (Test)
- [x] Prüf-Dialog beim Scan und bei der Auswahl aus der Suche: ungeprüftes OFF-Produkt → einmalig Nährwerte vs. Etikett, „Stimmt so“ (geprüft) / Werte korrigieren (Korrekturschicht) / „Später prüfen“ (fragt beim nächsten Scan bzw. der nächsten Auswahl wieder), danach direkt zur Menge; eigene Produkte gelten automatisch als geprüft (Jan, 21.10.2026)

### Phase 7 – Wasser (entfällt)

Gestrichen (Jan, 22.10.2026): Wasser-Tracking macht die App unnötig kompliziert. Vorbereitete Felder und Oberflächen sind entfernt; die Nummern der folgenden Phasen bleiben.

- [x] Wasser-Vorbereitungen entfernt, Migration Datenbank-Version 4 und Backup-Format 4, deployt und von Jan auf dem iPhone getestet (22.10.2026)

### Phase 8 – Statistiken

- [x] Entscheidung Diagramm-Bibliothek vs. eigenes SVG → eigenes SVG/HTML (Jan, 22.10.2026)
- [x] Kacheln, kcal pro Tag, Makros; Zeitraumwahl; Tipp zeigt Wert

### Phase 9 – Verbrauchsschätzung

- [x] Schalter in Einstellungen, Gewichte einfügen (Zwischenablage) und manuell
- [x] Trendgewicht, Schätzung und Spanne als reine Funktionen mit Tests (Grenzfälle: Lücken, wenig Tage, unvollständige Tage, mehrere Messungen pro Tag)
- [x] Format der Zwischenablage, Parser mit Zod, Anleitung `docs/kurzbefehl-gewichte.md`
- [x] Screen mit Ergebnis / „Sammelt Daten“, Abstand zum Budget, Gewichtstrend in der Statistik
- [x] g/kg-Makros nutzen das Trendgewicht

### Phase 10 – Export

- [x] CSV (international) und JSON, Zeitraum, Ebene, Spalten wählbar, Live-Vorschau
- [x] Vorlage „Monatsauswertung Claude“

### Phase 11 – Feinschliff

- [x] App-Icon (bleibt), Splashscreen, Name im Manifest; Motion-Feinschliff entfällt (Jan, 25.10.2026)
- [x] Vorschauseite im Build ausblenden, „Über“ mit Quellenhinweisen OFF und BLS
- [x] Abgleich aller Screens mit Prototypen und Screenshots, Abweichungen behoben
- [x] Versionsnummern (Semantic Versioning), Changelog, Tags, Prüfung im Deploy
- [ ] Offline- und Backup-Test auf dem iPhone (Checkliste `docs/iphone-test.md`), alle Phasen abgehakt
- [x] Anleitung inkl. Kurzbefehl für Apple Health (`docs/kurzbefehl-gewichte.md` reicht, Jan 25.10.2026)

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
| Nährwert Alkohol | Entfällt: wird nicht getrackt, auch nicht aus BLS oder OFF übernommen (Backup-Format 2, Datenbank-Version 2) (Jan, 21.10.2026) |
| OFF-Produkte nur mit kJ | kcal = kJ ÷ 4,184 beim Laden; kJ wird nie angezeigt oder gespeichert (Jan, 21.10.2026) |
| OFF-Treffer ohne kcal | Wird nicht gespeichert; „Eigenes Produkt anlegen“ mit vorbefülltem Formular (Name, Marke, Barcode, bekannte Werte). Das OFF-Original wird nie überschrieben (Jan, 21.10.2026) |
| „Werte bearbeiten“ bei OFF-Produkten | Bis zur Korrekturschicht (Phase 6) ausgeblendet; Portionen bleiben änderbar (Jan, 21.10.2026) |
| Offline-Scan „Jetzt manuell eintragen“ | Öffnet den Schnelleintrag, der gemerkte Scan gilt als erledigt; OFF nicht erreichbar (Netz da) zeigt „Open Food Facts nicht erreichbar“ (Jan, 21.10.2026) |
| Gemerkte Scans nachladen | Still beim Start, bei Netz zurück und beim Zurückkehren in die App; Zeile „2 gemerkte Scans“ über den Slots, Liste im Sheet, Tipp → Menge im gemerkten Slot und Tag (bzw. Produktformular), Wischen verwirft. „Nicht gefunden“ merkt sich nur die Sitzung, kein neues Feld (Jan, 21.10.2026) |
| Treffer beim Scan | Direkt zum Mengen-Schritt, keine Trefferkarte mit „Weiter“ (Jan nach iPhone-Test, 21.10.2026) |
| Rezept: Nährwert bei einer Zutat unbekannt | Pro 100 g unbekannt (`null`); die Topf-Summe auf dem Rezept-Screen zeigt „mind. …“ (Jan, 21.10.2026) |
| Rezept: Zutaten in ml | Zählen beim Rohgewicht wie g (1 ml ≈ 1 g) (Jan, 21.10.2026) |
| Mahlzeit: −/+ bei Skalierung | Schritt auf der angezeigten Menge (unter 50 → 5, unter 200 → 10, sonst 50), rastet auf Vielfache ein, nicht unter 5 (Jan, 21.10.2026) |
| Umschalter Meine/Original bei BLS | Feld `useOverride` in `blsPrefs`, Backup-Format 3 und Datenbank-Version 3 (Bestand: `true`) (Jan, 21.10.2026) |
| OFF-Update bei vorhandener Korrektur | Felder, die OFF ändert, werden mit dem alten Wert in der Korrektur festgehalten: „Meine Werte“ bleiben gleich, die Änderung erscheint als Abweichung. Ohne Korrektur übernimmt das Produkt das neue Original. Liefert OFF keine kcal mehr, bleibt alles (Jan, 21.10.2026) |
| Prüfstatus | „Geprüft“ bezieht sich auf „Meine Werte“; „Original nutzen“ und „Werte bearbeiten“ behalten die Prüfung; „Prüfung entfernen“ lässt Korrekturen stehen; Korrektur ohne Felder und ohne Prüfung bekommt den Löschmarker (Jan, 21.10.2026) |
| Wasser-Tracking | Entfällt ganz, Phase 7 gestrichen (Jan, 22.10.2026). Entfernt: Nährwert `water` (auch aus dem BLS), `isDrink`/„Ist ein Getränk“, `countsAsWater`, `entries.waterMl` und Art `water`, `profileVersions.waterMl`, Einstellung `waterEnabled` (bekommt den Löschmarker). Backup-Format 4 und Datenbank-Version 4; ältere Backups werden beim Import umgewandelt |
| Diagramme | Eigenes SVG/HTML, keine Bibliothek: kleiner, Motion über Tokens inkl. `prefers-reduced-motion`, echte Tipp-Ziele und VoiceOver statt Canvas. Ganze Diagrammfläche antippbar (nächster Balken), Wischen wandert (Jan, 22.10.2026) |
| Statistik: welche Tage zählen | Ø kcal/Tag, Bilanz und Makro-Ø nur über vollständige Tage; unvollständige Tage im Diagramm grau, Tage ohne Einträge ohne Balken und nirgends mitgezählt (auch nicht bei „Vollständig x/y“) (Jan, 22.10.2026) |
| Statistik: Zeiträume | Immer ganze Wochen Mo–So: Woche = laufende Woche (künftige Tage leer), 4 Wochen bzw. 3 Monate = 4 bzw. 13 Wochen bis einschließlich der laufenden (Jan, 22.10.2026) |
| Statistik: Ziel bei Profilwechsel | Bilanz rechnet jeden Tag gegen sein damals gültiges Tagesziel; die gestrichelte Linie zeigt das aktuelle Ziel (Jan, 22.10.2026) |
| Statistik: vollständige Woche (3 Monate) | Balken = Ø der vollständigen Tage der Woche; blau ab 5 von 7 vollständigen Tagen, grau bei 1–4, kein Balken bei 0. Laufende Woche blau, solange alle bisherigen Tage mit Einträgen vollständig sind. Kachel „Vollständig“ zählt Tage (Jan, 22.10.2026) |
| Spalten „Monatsauswertung Claude“ | Ebene Tage, JSON: Datum, Vollständig, kcal, Eiweiß, Kohlenhydrate, Fett, Ballaststoffe, Budget, Gewicht |
| Export: Format | Gerundet wie die Anzeige (kcal 0, g 1, Salz 2, kg 1 Stelle); unbekannt = `null` bzw. leeres CSV-Feld. Summen (Slots, Tage, Wochen) = Summe der bekannten Werte, Schlüssel mit unbekannten Teilen in `partial` (CSV letzte Spalte, `;`-getrennt; JSON nur, wenn nicht leer). JSON-Kopf `app`, `exportVersion` (1), `exportedAt`, `from`, `to`, `level`, `rows` (Jan, 25.10.2026) |
| Export: Spalten je Ebene | Budget und Gewicht nur bei Tagen und Wochen; Slot bei Einträgen und Slots; Name und Menge (`amount`, `unit`) nur bei Einträgen; Gewicht nur bei aktiver Verbrauchsschätzung. Wochen: `week` (ISO, z. B. `2026-W36`), `from`, `to`, `days`, `complete_days`. Keine Trend-Spalte (Jan, 25.10.2026) |
| Export: Tage und Werte | Tage: jeder Tag des Zeitraums bis heute, ohne Einträge Nährwerte `null`; vollständig nur mit Einträgen. Budget pro Tag = festes Tagesziel der damals gültigen Version; pro Woche = Wochenbudget am letzten Tag mit Profil × Tage mit Profil ÷ 7. Gewicht = erste Wiegung des Tages bzw. Ø der Wiegungen der Woche (Jan, 25.10.2026) |
| Export: Zeiträume | Letzter Monat = voriger Kalendermonat; 4 Wochen = 28 Tage inkl. heute; Alles = erster Tag mit Einträgen oder Gewicht bis heute; Frei = zwei Datumsfelder, Ende höchstens heute. Screen startet jedes Mal mit der Vorlage (Jan, 25.10.2026) |
| Gewichtstrend | Glättungsfaktor 0,1; Lücken zwischen Wiegungen linear aufgefüllt; nach der letzten Wiegung bleibt der Trend stehen (Jan, 22.10.2026) |
| Verbrauchsschätzung: Zeitraum und Bedingungen | Letzte 28 Tage inkl. heute; Ergebnis ab 14 vollständigen Tagen, 7 Wiegetagen und einem Trend über mind. 14 Tage. Trendänderung von der ersten bis zur letzten Wiegung im Zeitraum ÷ Tage dazwischen (Jan, 22.10.2026) |
| Spanne | 1,96 × Standardfehler der Steigung einer Ausgleichsgeraden durch die Wiegungen × 7.700 (≈ 95 %); bei ±0,4 kg Streuung nach 14 Tagen ca. ±290, nach 21 Tagen ca. ±160 kcal (Jan, 22.10.2026) |
| Sammelt Daten: Legende | „vollständig“ statt „vollständig + gewogen“; ein Tag zählt ohne Wiegung (Jan, 22.10.2026) |
| g/kg-Makros vergangener Tage | Trendgewicht an diesem Tag; ändert sich, wenn später ältere Gewichte nachgetragen werden (berechneter Wert) (Jan, 22.10.2026) |
| Format Kurzbefehl | Kopfzeile `kcalm-gewichte 1`, je Zeile `Zeitpunkt ISO 8601;Gewicht;Einheit` (Komma oder Punkt, kg oder lb). Tag = Kalendertag laut Zeitzone im Text. Streng: eine kaputte Zeile → nichts übernommen, Fehler nennt die Zeile. 20–300 kg. Zusammenführen: früheste Messung pro Tag gewinnt, auch gegen gespeicherte; gelöschter Tag kommt mit derselben Messung nicht zurück |
| Versionsnummern | Semantic Versioning `MAJOR.MINOR.PATCH` aus `package.json`, angezeigt unter Einstellungen › Über. Jeder Push auf `main` = eine Version mit Tag `vX.Y.Z`, Abschnitt in `CHANGELOG.md` und GitHub Release; der Deploy bricht ohne passenden Tag ab. Vor 1.0.0 `0.<Phase>.<n>`, frühere Phasen nachträglich als `v0.0.0`–`v0.10.0` getaggt (Commit „Phase N abgeschlossen/deployt“). 1.0.0 nach bestandenem iPhone-Test (Jan, 25.10.2026) |
| Tage vor dem ersten Profil | Kein Ziel: Ring leer, „kcal gegessen“; bleibt so, kein Rückgriff aufs erste Profil (Jan nach iPhone-Test, 25.10.2026) |
| Willkommensbildschirm | Schritt 0 der Ersteinrichtung (kein Prototyp): Icon mit sich zeichnendem Ring, „Neu einrichten“ oder „Aus Backup laden“ (direkt ins Tagebuch); Import aus Schritt 4 entfernt (Jan, 25.10.2026) |
| Splashscreen | Startbilder aus den Tokens per `npm run splash` (eigenes Skript, keine Abhängigkeit), nur für das iPhone 16e (1170 × 2532), hell und dunkel; ob iOS die Dunkel-Variante nutzt, zeigt der iPhone-Test (25.10.2026) |

Offen nur noch:

- [x] BLS-Excel `BLS_4_0_Daten_2025_DE.xlsx` von blsdb.de herunterladen und nach `data/bls/` legen (Jan, vor Phase 1)

## 8. Zwischenstand

Hier trägt Claude Code beim Pausieren mitten in einer Phase ein, was erledigt ist und was als Nächstes kommt.

**25.10.2026 · Phase 11 (Feinschliff) bis auf den iPhone-Test erledigt** – 11a Abweichungen vom Prototyp, 11b Startbilder und Manifest-`id`, 11c Darstellung/Über und Vorschau nur im Entwicklungsmodus, Versionierung (Tags `v0.0.0`–`v0.10.0`, `CHANGELOG.md`, Prüfung im Workflow, Regeln in `CLAUDE.md`). Version 0.11.0 deployt und von Jan auf dem iPhone getestet (Checkliste bestanden). Danach als 0.11.1: Häkchen „vollständig“ beim schnellen Blättern behoben, Badge „geprüft“ im Mengen-Schritt, Willkommensbildschirm mit „Aus Backup laden“. Nächster Schritt: Jan testet 0.11.1, danach Version 1.0.0 und Phase 11 abschließen.

- Abgleich im Headless-Chrome bei 390 px (alle Prototypen gegen die App mit Beispieldaten). Behoben: Wochen-/Tagesbudget ohne Tausenderpunkt und „kcal“ zu weit weg (`formatInputNumber`, Feldbreite folgt dem Inhalt), „74kg“, Punkt im leeren Ring, Kalender-Legende zweizeilig, Darstellung/Über fehlten.
- Bleibt bewusst: „Lebensmittel suchen“ (Suche umfasst BLS), kein „…“-Menü im Produktdetail, leerer Slot zeigt „0 kcal“ wie in `Kern.dc.html` (`Leer.dc.html` ohne).
- Nicht optisch geprüft: Kamera im Scanner, Wischen zum Löschen, Toast, Sheets „Nicht gefunden“/„Offline“ (alles in früheren Phasen auf dem iPhone getestet).

**25.10.2026 · Phase 10 (Export) abgeschlossen** – deployt und von Jan auf dem iPhone getestet (Teilen, CSV, Datumsfelder, Hell/Dunkel). 10a Rechenlogik `src/logic/export.ts`, 10b `src/db/export.ts`, 10c Screen `src/screens/einstellungen/ExportScreen.tsx` (Einstellungen › Daten › Export). 893 Tests grün, Build und Lint sauber. Im Headless-Chrome bei 390 px geprüft (Hell/Dunkel, alle Ebenen, CSV/JSON, Frei). Nächster Schritt: Phase 11 (Feinschliff).

- Abweichungen vom Prototyp: Vorlagen-Karte immer `card`-Fläche (helles Blau `#F5F7FF` ist kein Token), aktiv nur mit `accent`-Rahmen; Untertitel „kcal, Makros, Ballaststoffe, Budget, Gewicht“ statt „alle Nährwerte + Gewicht“; Spalten-Chips aus mit Rahmen `line`; keine Wasser-Spalte; Ebene/Format mit dem vorhandenen `Segmented` (Höhe 36 statt 34); Vorschau in `ui-monospace` (SF Mono auf dem iPhone), weil Geist Mono nicht gebündelt ist.
- Vorschau: CSV 3 Zeilen, JSON 1 Zeile, danach „…“. Knopf gesperrt ohne Zeilen, ohne Spalten oder ohne gültigen Zeitraum.

**25.10.2026 · Phase 9 (Verbrauchsschätzung) abgeschlossen** – 9a–9e erledigt (je ein Commit), deployt und von Jan auf dem iPhone getestet (Kurzbefehl, Einfügen, Hell/Dunkel). 849 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 10 (Export).

- 9e: g/kg-Makros nutzen bei aktiver Schätzung das Trendgewicht des jeweiligen Tages (Tagebuch, Statistik), sonst bzw. vor der ersten Wiegung das manuelle Gewicht. Profilformular: Vorschau mit heutigem Trendgewicht, Hinweis „g/kg nutzt dein Trendgewicht (74,6 kg). Das Feld gilt nur ohne Trend.“, Körpergewicht dann nicht Pflicht. Gewichtskarte in der Statistik (`src/logic/weightChart.ts`, `src/screens/statistik/WeightCard.tsx`): Punkte und Trend in der Tagesspalte wie die Balken, Trend nur bis zur letzten Wiegung, Achse auf 0,5 kg, mind. 1 kg; Text „+0,3 kg in 4 Wochen“ bzw. „in 39 Tagen“, wenn der Trend den Zeitraum nicht ganz abdeckt; Link „Verbrauch … ± … kcal“ bzw. „Sammelt Daten“ zum Schätz-Screen.
- Abweichungen vom Prototyp (Gewichtskarte): Radius 18 (`card`) statt 20, Achsenzahlen 11 statt 10 px (`tiny`), „Keine Wiegungen in diesem Zeitraum“ ohne Daten.

- 9a `src/logic/estimate.ts` (Trend, Schätzung, Spanne), 9b `src/logic/weightImport.ts` + `docs/kurzbefehl-gewichte.md`, 9c `src/db/weights.ts` + Schalter „Funktionen“ in den Einstellungen (`ToggleRow` jetzt in `components/ui`), 9d `src/logic/estimateView.ts`, `src/db/estimate.ts`, Screen `src/screens/einstellungen/EstimateScreen.tsx` mit Sheets in `schaetzung/` (Einfügen-Ersatz, Manuell mit „Letzte Gewichte“, Anleitung).
- Mit Jan abgestimmt: Raster „Sammelt Daten“ ab dem ersten Tag mit Einträgen, danach helle Felder für fehlende Tage (heute unmarkiert zählt noch nicht als grau); „Letzte Gewichte“ (14 Tage) im Manuell-Sheet, Tipp = bearbeiten, Wischen = löschen.
- Eigene Entscheidungen im Screen: Spanne auf 10 kcal gerundet; Leiste mit 400 kcal Luft, Enden auf volle 100; manuelles Gewicht gilt als Messung um Mitternacht (Import überschreibt es nicht) und ersetzt den Wert des Tages; Zwischenablage nicht lesbar oder Text falsch → Sheet mit Textfeld und Fehlermeldung.
- Abweichungen vom Prototyp: ohne Demo-Umschalter oben; „Letztes Gewicht“ statt „Letzter Import“ (zeigt auch manuelle Werte); Rasterfelder Radius 4 (`barTop`) statt 6, Legende ebenso; Hero-Karte Radius 22 (`calendar`); Hinweis aufs Gewicht unter dem Raster, solange Wiegungen fehlen.
- Geprüft im Browser (Chrome, eigene Test-Datenbank): beide Zustände, Manuell-Sheet, Einfügen-Ersatz mit Fehler und Erfolg, Anleitung. Bildschirmfotos klappten nicht (Chrome-Erweiterung hing), Hell/Dunkel daher nicht optisch geprüft.

**22.10.2026 · Phase 8 (Statistik) abgeschlossen** – deployt und von Jan auf dem iPhone getestet. Nächster Schritt: Phase 9 (Verbrauchsschätzung). 8a Rechenlogik (`src/logic/stats.ts`, `isoWeek` in `dates.ts`, `loadStats` in `src/db/stats.ts`), 8b Screen (`src/screens/Statistik.tsx`, `src/screens/statistik/`). 736 Tests grün, Build und Lint sauber. Im Browser bei 390 px geprüft (Hell/Dunkel, alle drei Zeiträume, Tippen, Wischen).

- Abweichungen vom Prototyp: keine Wasser-Karte (Phase 7 gestrichen), Gewichts-Karte erst in Phase 9; bei 3 Monaten nur jede zweite KW beschriftet; Achse/Ziel 11 statt 10 px, Kachelwert `unit` 20 px/600, Radien `card` 18, Ziellinie `muted` mit halber Deckkraft; leerer Zeitraum zeigt „Keine Einträge in diesem Zeitraum“.
- Laufende Woche (3 Monate): heute zählt erst, wenn markiert.
- Zeitraum bleibt beim Tab-Wechsel erhalten, nach Neustart „Woche“.
- Nach Jans iPhone-Test (`0254ed5`): Achsenbeschriftung in allen Zeiträumen mittig unter ihrem Balken; Zielzahl „2.800“ in eigenem Streifen rechts neben den Balken, damit kein Balken sie überdeckt.

**22.10.2026 · Phase 7 (Wasser) gestrichen und abgeschlossen** – auf Jans Wunsch; alle Vorbereitungen fürs Wasser entfernt, deployt und von Jan auf dem iPhone getestet (Daten nach dem Umbau vollständig, Backup-Import aus der alten Version klappt). 686 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 8 (Statistiken).

- Datenmodell ohne Nährwert `water`, `isDrink`, `countsAsWater`, `waterMl`, Eintragsart `water`; Backup-Format 4 und Datenbank-Version 4 mit Migration und Tests; `public/bls.json` ohne Wasser-Spalte neu erzeugt.
- Oberfläche: Ersteinrichtung Schritt 3 nur noch „Verbrauchsschätzung“; Produktformular ohne „Ist ein Getränk“ und „Weitere Nährwerte (Wasser)“; BLS- und Produktdetail ohne Getränk-Zeile; Wasser-Beispiele aus der Vorschauseite entfernt; Fortschrittsleiste ohne Wasser-Variante (Höhe 4, Farbe accent).
- OFF-Abfrage ohne `categories_tags` (wurde nur für „Getränk“ gebraucht).
- Nach Jans Test: „Als geprüft markieren“ / „Prüfung entfernen“ im Produkt- und BLS-Detail stehen jetzt mittig (globales `text-align: left` für Knöpfe).

**21.10.2026 · Phase 6 abgeschlossen** – alle Punkte erledigt (Teilschritte 6a–6d, je ein Commit), deployt und von Jan auf dem iPhone getestet. 683 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 7 (Wasser).

- Erledigt: `src/logic/verify.ts` (Zusammenführen, Vergleich, `canVerify`, `rebaseOnOffUpdate`), `src/db/verify.ts` (Korrektur, Prüfen, Umschalter), `refreshOffProduct` in `src/db/off.ts`; Produkt- und BLS-Detail mit Tabelle Original · Meine; Korrekturformular („Werte bearbeiten“ bei OFF und BLS); Prüf-Dialog im Hinzufügen-Sheet.
- Eigene Produkte gelten als geprüft: Häkchen in Liste und Suche, Filter „Geprüft“ zeigt sie mit. In der Liste zeigt kcal /100 die genutzten Werte (Korrektur bzw. Original).
- Eigenes Design (kein Prototyp): Korrekturformular (startet mit „Meine Werte“, zeigt „Original …“ unter abweichenden Feldern) und Prüf-Dialog (Kopf wie der Mengen-Schritt, Tabelle, „Stimmt so“ / „Werte korrigieren“ / „Später prüfen“). Nach „Werte korrigieren“ im Prüf-Dialog gilt das Produkt als geprüft, wenn alle Pflichtangaben da sind. Fehlen Pflichtangaben, ist „Stimmt so“ bzw. „Als geprüft markieren“ gesperrt, mit dem Hinweis „Zum Prüfen fehlt noch: …“.
- Abweichungen vom Prototyp: Umschalter Meine/Original erst sichtbar, wenn etwas korrigiert ist; nicht genutzte Spalte in `muted` statt im helleren Grau des Prototyps (kein Token); Zellen-Radius 9 statt 8 px (`segmentItem`); Menge in der Meta-Zeile fehlt weiterhin (wird nicht gespeichert).

**21.10.2026 · Phase 5 abgeschlossen** – alle Punkte erledigt (Teilschritte 5a–5d, je ein Commit), deployt und von Jan auf dem iPhone getestet. 628 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 6 (Verifizieren).

- Erledigt: Rechenlogik `meal.ts` (Skalierung, −/+ mit Einrasten, Ziffernblock, Einträge mit Gruppe, Prüfung) und `recipe.ts` (Rohgewicht, pro 100 g, Kochverlust, Endgewicht ±50, Prüfung), `groupList.ts`, `groupSlotEntries` in `diary.ts`; `db/meals.ts`, `db/recipes.ts`, `addEntries`; Lebensmittel-Liste mit Reitern Mahlzeiten/Rezepte; Rezept-Screen, Mahlzeit-Formular, Auswahl-Sheet für Zutaten/Bestandteile; im Hinzufügen-Sheet Knöpfe Mahlzeiten/Rezepte, Mahlzeit-Schritt, Mahlzeiten und Rezepte in der Suche; Gruppen im Tagebuch.
- Mit Jan abgestimmt (kein Prototyp): Mahlzeit-Formular wie der Rezept-Screen ohne Endgewicht; Rezepte dürfen in Mahlzeiten, nicht in Rezepte; Gruppe im Tagebuch mit schlichter Kopfzeile (nicht antippbar), Bestandteile eingerückt und einzeln bearbeitbar; Endgewicht beginnt leer, −/+ startet vom Rohgewicht.
- Abweichungen vom Prototyp: Schriftgrößen ohne Token auf den nächsten Token (Endgewicht 34 statt 36 px, kcal/100 g 20 statt 22, Name 17 statt 18); Portionen im Rezept als eigene Karte mit kcal je Portion; −/+ in der Mahlzeit 44 statt 40 px (Touch-Ziel); „Vorlage bearbeiten“ unter der Liste statt oben rechts; Ziffernblock der Mahlzeit ersetzt unten den Knopf, solange eine Menge eingetippt wird; Hinweis „Zum Sichern fehlt noch: …“.
- Nebenbei behoben: Mehrere Einträge auf einmal (Mahlzeit, Tag kopieren) bekamen denselben Zeitstempel, die Reihenfolge im Tagebuch war dann zufällig; jetzt je 1 ms Abstand.

**21.10.2026 · Phase 4 abgeschlossen** – alle Punkte erledigt (Teilschritte 4a–4e plus Nachbesserungen nach Jans iPhone-Test), deployt; Scanner, Taschenlampe und Supermarkt-Test von Jan auf dem iPhone bestätigt. 527 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 5 (Mahlzeiten und Rezepte), danach Phase 6 mit dem Prüf-Dialog.

- Vorab: Nährwert Alkohol entfernt (Backup-Format 2, Datenbank-Version 2 mit Upgrade).
- Erledigt: `src/logic/barcode.ts` (Prüfziffer, Einheitsform), `src/logic/off.ts` (Adressen, Zod, Umwandlung, kJ → kcal), `src/db/off.ts` (lokal zuerst, Zeitlimit, Textsuche mit Wiederholung), `src/scanner/detector.ts` (barcode-detector, WASM aus dem eigenen Build, Test auf Version/SHA-256), Scanner-Screen, Ablauf nach dem Scan, `pendingScans` mit Nachladen im Hintergrund, OFF-Textsuche.
- Nach Jans iPhone-Test: Kamera erst sichtbar, wenn das erste Bild läuft (kein Sprung aus kleinem Fenster); Treffer direkt zur Menge; Kamera aus beim Eintippen. Vibration bewusst nicht (iOS unterstützt sie in Web-Apps nicht).
- Tokens ergänzt (mit Jans OK): `color.scanner`, `shadow.laser`, `radius.scanFrame`, `motion.scanLaser`.
- Kamera-Erlaubnis: iOS fragt einmal pro App-Start; im Code nicht änderbar. Jan kann sie in Safari pro Website erlauben (aA → Website-Einstellungen → Kamera).

**21.10.2026 · Phase 3 abgeschlossen** – alle Punkte erledigt (Teilschritte 3a–3g, je ein Commit), deployt und von Jan auf dem iPhone getestet. 439 Tests grün, Build und Lint sauber. Nächster Schritt: Phase 4 (Open Food Facts und Barcode), vorher Kurztest OFF aus dem Browser (CORS).

- Nach Jans iPhone-Test ergänzt (`77d08d6`): Tagesbudget im Profil direkt eintippbar (× 7 aufs Wochenbudget), Modus-Chip rechnet den Wert um (Gramm bleiben gleich, gerundet), alle drei Makros in % müssen genau 100 % ergeben (Summe live sichtbar), vollständige Tage sichtbar (Häkchen-Badge in der Tagesleiste, Übersichts- und Schalter-Karte blau getönt, Punkte in der Woche).

- Erledigt: Rechenlogik `dates.ts`, `goals.ts`, `profiles.ts`, `diary.ts`, `addFood.ts`, `quickEntry.ts`, `copyDay.ts`, `slots.ts`, `profileForm.ts`; Ersteinrichtung (4 Schritte, speichert am Ende in einer Transaktion), Slot-Editor, Tagesansicht, Hinzufügen-Sheet, Bearbeiten/Verschieben/Löschen, Schnelleintrag, Profile und Ziele, Tag kopieren / „Wie gestern“ / vollständig.
- Mit Jan abgestimmt: Künftige Tage zeigen das heutige Ziel (vorgeplante Einträge zählen nicht), in künftigen Wochen Budget ÷ 7; dynamisches Ziel darf negativ werden („kcal drüber“); Rest negativ → 0 g + Hinweis; g/kg ohne Gewicht → unbekannt; Override „ab heute“ gilt nur in seiner Woche; Bearbeiten des aktiven Profils gilt ab heute (anteilig); erstes Profil mitten in der Woche bekommt den anteiligen Wochenrest, Tage davor zählen nicht (`countFrom`); festes Tagesziel immer aus dem Wochenbudget der Version.
- Abweichungen vom Prototyp (mit Jan abgestimmt): Monatspfeile im Kalender, Kalenderfelder 44 px, Tageszeile zum Verschieben im Bearbeiten-Sheet, „Zurück“ beim Bearbeiten schließt, Schnelleintrag zeigt „–“ statt „0“, „Sichern“ in Profile und Ziele, Profilformular mit Name und Vorlagen-Umschalter, Schalter „Tag vollständig getrackt“ unter den Slots, Kopier-Sheet eigenes Design. Wasser-Kachel und Wasser-Ziel folgen in Phase 7, Scan/OFF in Phase 4, Mahlzeiten/Rezepte in Phase 5.

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
