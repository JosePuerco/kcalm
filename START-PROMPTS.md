# Kcalm – Start-Prompts je Phase

Ablauf pro Phase: vorige Phase in PLAN.md abgehakt → committen → pushen → `git status` sauber → in Claude Code `/clear` → Prompt der nächsten Phase einfügen.

---

## Phase 0 – Fundament

```
Lies CLAUDE.md, PLAN.md und alles in design/. Wir machen nur Phase 0 aus PLAN.md.

1. Schlag mir die Ordnerstruktur und die Übernahme von design/tokens.json in Tailwind vor (inkl. Hell/Dunkel). Warte auf mein OK.
2. Setze das Projekt auf: Vite, React, TypeScript, Tailwind, Motion, Dexie, Zod, Vitest. PWA unter /kcalm/ installierbar und offline, Schrift Geist lokal gebündelt.
3. Baue die feste App-Hülle (kein Gummiband-Scrollen, kein Zoomen, Safe Areas, ein Scrollbereich pro Screen nach DESIGN.md) und die schwebende Navigation mit leeren Screens exakt nach design/DESIGN.md und design/prototypes/Kern.dc.html.
4. Baue die Bausteine aus Phase 0 mit einer Vorschauseite.
5. Richte GitHub Pages per GitHub Actions ein und erkläre mir, was ich in den Repo-Einstellungen aktivieren muss, bevor wir pushen.

Erkläre bei jedem Schritt kurz, was du tust und warum. Ich arbeite unter Windows 11 in PowerShell.
```

## Phase 1 – Produkte und BLS

```
Phase 0 ist fertig. Starte Phase 1 aus PLAN.md.
Die BLS-Excel liegt in data/bls/.
1. Zeig mir zuerst das Dexie-Schema für alle Tabellen aus PLAN.md Abschnitt 4 und die TypeScript-Typen (inkl. Nutrients mit null = unbekannt). Warte auf mein OK.
2. Dann das BLS-Skript (Excel → kompakte JSON) mit Tests für fehlende Werte. Zeig mir vorher, welche Spalten du übernimmst.
3. Dann die Rechenfunktion Nährwert pro Menge mit Tests.
4. Dann die Oberfläche: Lebensmittel-Liste und Produkt anlegen/bearbeiten nach design/prototypes/Lebensmittel.dc.html.
```

## Phase 2 – Backup

```
Phase 1 ist fertig. Starte Phase 2 aus PLAN.md.
Zeig mir zuerst das Backup-Format (JSON-Struktur mit formatVersion) und das Zod-Schema für den Import, dann warte auf mein OK.
Teilen über Web Share mit Ersatz per Download. Die Backup-Zeile in den Einstellungen nach design/prototypes/Einstellungen.dc.html.
Am Ende erkläre mir den Backup-Test Schritt für Schritt (Daten anlegen → exportieren → App löschen → neu installieren → importieren).
```

## Phase 3 – Tagebuch und Ziele

```
Phase 2 ist fertig. Starte Phase 3 aus PLAN.md. Das ist die größte Phase.
1. Zeig mir zuerst die Rechenfunktionen mit Tests: festes und dynamisches Tagesziel, Wochenstand, Makros in g / % / g/kg / Rest, Profilwechsel „ab nächstem Montag“ und „ab heute“ (Beispiele aus PLAN.md als Testfälle). Warte auf mein OK.
2. Dann einen Plan für die Oberfläche in Teilschritten: Ersteinrichtung, Tagesansicht, Hinzufügen-Sheet, Bearbeiten/Löschen, Schnelleintrag, Profile.
Halte dich exakt an design/prototypes/Kern.dc.html (Tagesansicht, Sheet, Motion), Leer.dc.html, Start.dc.html, Schnell.dc.html und Profil.dc.html.
Nach jedem Teilschritt Tests, dann Commit vorschlagen.
```

## Phase 4 – Open Food Facts und Barcode

```
Phase 3 ist fertig. Starte Phase 4 aus PLAN.md.
1. Mach zuerst den Kurztest: Ist die OFF-API aus dem Browser erreichbar (CORS)? Zeig mir das Ergebnis und das Antwortformat für einen Barcode.
2. Dann den Plan für Scanner (barcode-detector mit selbst gehostetem WASM, im Offline-Cache) und OFF-Abfrage mit Zod-Schema. Warte auf mein OK.
Screens nach design/prototypes/Scanner.dc.html und NichtGefunden.dc.html.
```

## Phase 5 – Mahlzeiten und Rezepte

```
Phase 4 ist fertig. Starte Phase 5 aus PLAN.md.
Zeig mir zuerst die Rechenfunktionen für Mahlzeit-Skalierung und Rezept pro 100 g (inkl. Kochverlust) mit Tests, dann warte auf mein OK.
Screens nach design/prototypes/Mahlzeit.dc.html und Rezept.dc.html.
```

## Phase 6 – Verifizieren

```
Phase 5 ist fertig. Starte Phase 6 aus PLAN.md.
Zeig mir zuerst, wie die Korrekturschicht (productOverrides) mit dem Original zusammengeführt wird, inkl. Test „OFF-Update überschreibt Korrektur nicht“. Warte auf mein OK.
Screen nach design/prototypes/Produkt.dc.html.
```

## Phase 7 – Wasser

Entfällt (Jan, 22.10.2026): kein Wasser-Tracking. Weiter mit Phase 8.

## Phase 8 – Statistiken

```
Phase 6 ist fertig, Phase 7 entfällt. Starte Phase 8 aus PLAN.md.
Schlag mir zuerst vor: Diagramm-Bibliothek oder eigenes SVG, mit Begründung (Bundle-Größe, Offline, Motion, Bedienung per Tipp). Warte auf mein OK.
Screen nach design/prototypes/Statistik.dc.html.
```

## Phase 9 – Verbrauchsschätzung

```
Phase 8 ist fertig. Starte Phase 9 aus PLAN.md.
1. Zeig mir zuerst die Funktionen für Trendgewicht, Schätzung und Spanne mit Tests (Lücken, unter 14 Tagen, unvollständige Tage, mehrere Messungen pro Tag). Warte auf mein OK.
2. Dann das Format, das der iOS-Kurzbefehl in die Zwischenablage kopiert, und den Parser mit Zod. Schreib mir eine Anleitung für den Kurzbefehl.
Screen nach design/prototypes/Schaetzung.dc.html.
```

## Phase 10 – Export

```
Phase 9 ist fertig. Starte Phase 10 aus PLAN.md.
Zeig mir zuerst ein Beispiel für CSV und JSON je Ebene und die Spalten der Vorlage „Monatsauswertung Claude“. Warte auf mein OK.
Screen nach design/prototypes/Export.dc.html.
```

## Phase 11 – Feinschliff

```
Phase 10 ist fertig. Starte Phase 11 aus PLAN.md.
Gleiche alle Screens mit design/prototypes/ und design/screenshots/ ab und liste mir Abweichungen auf, bevor du etwas änderst.
Dann App-Icon, Splashscreen, Manifest-Name, Vorschauseite im Build ausblenden, „Über“ mit Quellenhinweisen.
Zum Schluss eine Checkliste für den Offline- und Backup-Test auf dem iPhone.
```

---

## Hilfreiche Prompts zwischendurch

- **Pausieren:** „Trag den Zwischenstand in Abschnitt 8 von PLAN.md ein und committe lokal.“
- **Abgleich:** „Vergleiche den Screen X mit design/prototypes/X.dc.html und design/screenshots/. Liste Abweichungen, ändere noch nichts.“
- **Plan prüfen lassen:** Den Plan von Claude Code hier im Chat einfügen und mit PLAN.md abgleichen lassen.
