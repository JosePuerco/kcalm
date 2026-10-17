# Kcalm – Regeln für Claude Code

Kcalm ist eine minimalistische Kalorien-Tracking-PWA fürs iPhone. Alle Daten bleiben auf dem Gerät. Jan entwickelt auf Windows 11 (PowerShell) und lernt mit dem Projekt.

## Lies zuerst

1. `PLAN.md` – maßgeblicher Plan: Funktionen, Berechnungen, Datenmodell, Phasen
2. `design/DESIGN.md` – verbindliche Design-Vorgabe
3. `design/tokens.json` – alle Farben, Schriftgrößen, Radien, Abstände, Motion-Werte
4. `design/prototypes/` – Quellcode der Prototyp-Screens (siehe README dort)
5. `design/screenshots/` – Gesamteindruck

## Feste Regeln

### Produkt
- Oberfläche auf Deutsch, Du-Form. Zahlen im deutschen Format (1.273 · 2,5), Eingabe mit Dezimalkomma. Nur kcal, kein kJ.
- Keine Gamification: keine Streaks, Abzeichen, Maskottchen, Motivationstexte.
- Kein Server, kein Login, kein Tracking, keine Analytics. Einziger Netzzugriff: Open Food Facts (Lesen, mit `app_name`, `app_version`, `app_uuid`).
- Offline-first: alles außer der OFF-Abfrage funktioniert im Flugmodus, auch der Barcode-Scanner (Decoder-WASM selbst hosten und cachen) und die BLS-Suche.

### Daten und Rechnen
- Rechenlogik als reine Funktionen in eigenem Modul (`src/logic/`), getrennt von der Oberfläche, mit Vitest-Tests inkl. Grenzfällen. Intern exakt rechnen, nur die Anzeige runden.
- Unbekannte Nährwerte sind `null`, niemals 0. Summen mit unbekannten Werten zeigen „mind. …“.
- Snapshot-Prinzip: Jeder Tagebucheintrag speichert seine absoluten Nährwerte, jeder Tag sein damals gültiges Profil. Spätere Änderungen an Produkten, Korrekturen, Rezepten oder Profilen ändern alte Tage nie.
- Abgeleitete Werte (Summen, Ziele, Trend, Schätzung) werden berechnet, nicht gespeichert.
- Sync-fähiges Modell: jede Tabelle hat `id` (UUID), `createdAt`, `updatedAt`, `deletedAt`. Löschen = Löschmarker setzen.
- Verifizieren = Korrekturschicht (`productOverrides`). Das OFF-Original wird nie überschrieben.
- Backup-JSON mit `formatVersion`; Import mit Zod prüfen; bei Formatänderung eine Migration schreiben.
- Wochen beginnen am Montag, Tage um Mitternacht (lokale Zeit).
- CSV-Export international: Komma als Trenner, Punkt als Dezimalzeichen, UTF-8.

### Design
- Nur Tokens aus `design/tokens.json` verwenden, keine eigenen Farben oder Größen erfinden.
- Hell und Dunkel über Tokens; Standard folgt dem System, in den Einstellungen umschaltbar.
- Touch-Ziele min. 44 px. Eingabefelder mindestens 16 px Schrift (sonst zoomt iOS beim Fokus).
- `prefers-reduced-motion`: alle Animationen aus, Zustände sofort.
- App-Hülle: `html`/`body` nicht scrollbar, `overscroll-behavior: none`, `100dvh`, Safe Areas, kein Zoomen. Pro Screen genau ein Scrollbereich mit `min-height: 0`, dessen Kinder `flex-shrink: 0` haben.
- Prototypen sind Vorlage, nicht Code zum Kopieren: Layout, Texte, Abstände und Verhalten übernehmen, sauber in React-Komponenten neu bauen.

### Plattform
- GitHub Pages unter Unterpfad `/kcalm/`: Vite `base`, Manifest `scope` und `start_url` passend.
- Teilen (Backup, Export) über die Web-Share-Schnittstelle, immer mit Ersatz per Download, falls Teilen fehlschlägt (Lehre aus Mixli).
- Kamera nur nach Tipp starten (iOS).
- Schrift Geist lokal bündeln (@fontsource), nichts zur Laufzeit von Google Fonts laden.

## Arbeitsweise

- Jan lernt mit dem Projekt: erkläre kurz, was du tust und warum, Fachbegriffe beim ersten Mal in einem Satz.
- Arbeite phasenweise nach `PLAN.md`. Nur die aktuelle Phase, nichts vorziehen.
- Vor größeren Änderungen (neue Struktur, Schema, Bibliothek, mehrere Dateien) zuerst den Plan zeigen und auf OK warten.
- Bei Unklarheit nachfragen statt raten. Entscheidungen, die vom Plan abweichen, nie still treffen.
- Rechenlogik: erst Funktionen mit Tests zeigen, dann Oberfläche.
- Nach jedem Schritt Tests laufen lassen, dann einen Commit mit klarer Nachricht vorschlagen.
- Nicht mitten in einer Phase auf `main` pushen (jeder Push deployt). Lokale Commits reichen.
- Erledigte Punkte in `PLAN.md` abhaken. Beim Pausieren den Zwischenstand in Abschnitt 8 von `PLAN.md` eintragen und lokal committen.
- Befehle für Windows PowerShell angeben. Pfade mit Leerzeichen in Anführungszeichen.
- Keine neuen Abhängigkeiten ohne kurze Begründung.
