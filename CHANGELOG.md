# Änderungen

Alle Versionen von Kcalm. Nummern nach [Semantic Versioning](https://semver.org/lang/de/) `MAJOR.MINOR.PATCH`:

- **PATCH** (1.0.0 → 1.0.1): Fehlerbehebung, Feinschliff, Texte
- **MINOR** (1.0.1 → 1.1.0): neue Funktion oder Erweiterung, auch mit neuer Backup-Formatversion und automatischer Migration
- **MAJOR** (1.4.2 → 2.0.0): Umbruch – alte Daten oder Backups werden nicht mehr automatisch übernommen, oder die Bedienung ändert sich grundlegend

Jeder Push auf `main` ist genau eine Version mit Git-Tag `vX.Y.Z` und GitHub Release. Vor 1.0.0 (App noch nicht in Nutzung) steht die mittlere Zahl für die Phase aus `PLAN.md`.

## 1.3.0 – 28.10.2026

- Neu: Einstellungen › Hilfe › „Kamera dauerhaft erlauben“ – Anleitung, damit iOS nicht bei jedem Start nach der Kamera fragt (in Safari erlauben, dann erst zum Home-Bildschirm hinzufügen)

## 1.2.1 – 27.10.2026

Keine Änderung an der App: Projektnotizen in `PLAN.md` (iPhone-Test von 1.2.0, offener Punkt zum Tastatur-Fehler).

## 1.2.0 – 27.10.2026

Rückmeldungen zum iPhone-Test von 1.1.0.

- Einheit g/ml gilt jetzt auch für alte Einträge und Mahlzeiten; es ändert sich nur die Bezeichnung, nie Menge oder kcal
- Einheit g/ml direkt im Prüf-Dialog umstellbar
- Mahlzeit: Faktor-Chips setzen die Mengen immer auf Vorlage × Faktor; nach einer Handänderung ist kein Chip aktiv
- Behoben: Nach dem Schließen der Tastatur blieb das Sheet auf dem iPhone manchmal hochgeschoben, unten leer

## 1.1.0 – 27.10.2026

Wünsche nach 1.0 (Phase 12).

- Mengen-Schritt startet bei neuen Einträgen leer statt mit 100 bzw. der ersten Portion
- Mehrere Portionen: Tipp auf einen Portions-Chip schaltet auf Anzahl („4 × Reiswaffel = 27,2 g“), Chip „g“ zurück; Bearbeiten öffnet wieder mit der Anzahl
- Aufgeklappte Slots zeigen ihre Makros („E 32 g · K 80 g · F 20 g · B 5 g“)
- Tag kopieren: Auswahl „Einfügen in“ (gleicher Slot oder ein bestimmter); neuer Knopf „Kopieren“ im Hinzufügen-Sheet, z. B. Abendessen von gestern ins heutige Mittag
- Einheit g/ml bei Open-Food-Facts- und BLS-Lebensmitteln umstellbar (z. B. Milch in ml); alte Einträge bleiben unverändert
- Backup-Format 5 und Datenbank-Version 5; ältere Backups werden beim Import umgewandelt

## 1.0.0 – 25.10.2026

Erste Version für die Nutzung: alle Phasen aus `PLAN.md` abgeschlossen, Offline- und Backup-Test auf dem iPhone bestanden. Funktionen wie 0.11.1.

## 0.11.1 – 25.10.2026

Nachbesserungen nach dem iPhone-Test.

- Ersteinrichtung beginnt mit einem Willkommensbildschirm: „Neu einrichten“ oder „Aus Backup laden“ (direkt ins Tagebuch, ohne Slots und Profil anzulegen)
- Mengen-Schritt markiert geprüfte Produkte mit „✓ geprüft“, z. B. direkt nach dem Scan
- Behoben: Beim schnellen Blättern durch die Tage wanderte das Häkchen „vollständig“ kurz nach rechts

## 0.11.0 – 25.10.2026

Phase 11 (Feinschliff), Stand für den Offline- und Backup-Test auf dem iPhone.

- Einstellungen: Gruppen „Darstellung“ (System / Hell / Dunkel) und „Über“ mit Version und Quellen (Open Food Facts, ODbL; Max Rubner-Institut, BLS 4.0)
- Startbild beim Öffnen der installierten App, hell und dunkel
- Bausteine-Vorschau nur noch im Entwicklungsmodus
- Wochen- und Tagesbudget mit Tausenderpunkt, „kcal“ direkt an der Zahl
- „74 kg“ mit Abstand, leerer Ring ohne Punkt, Kalender-Legende einzeilig
- Versionsnummer, Changelog und Prüfung im Deploy

## 0.10.0 – 25.10.2026

Phase 10: Export als CSV (international) und JSON, Zeitraum, Ebene und Spalten wählbar, Live-Vorschau, Vorlage „Monatsauswertung Claude“.

## 0.9.0 – 25.10.2026

Phase 9: Verbrauchsschätzung aus Gewichtstrend und vollständigen Tagen, Gewichte per Kurzbefehl aus Apple Health oder manuell, Gewichtskarte in der Statistik, g/kg-Makros mit Trendgewicht.

## 0.8.0 – 22.10.2026

Phase 8: Statistik mit Woche / 4 Wochen / 3 Monate, kcal pro Tag, Makros gegen Ziel.

## 0.7.0 – 22.10.2026

Phase 7 gestrichen: Wasser-Tracking komplett entfernt (Backup-Format 4, Datenbank-Version 4).

## 0.6.0 – 21.10.2026

Phase 6: Verifizieren mit Korrekturschicht, Original gegen „Meine Werte“, Prüf-Dialog.

## 0.5.0 – 21.10.2026

Phase 5: Mahlzeiten und Rezepte.

## 0.4.0 – 21.10.2026

Phase 4: Open Food Facts und Barcode-Scanner (offline mit selbst gehostetem Decoder), gemerkte Scans.

## 0.3.0 – 21.10.2026

Phase 3: Tagebuch, Ersteinrichtung, Profile und Ziele, Schnelleintrag, Tag kopieren.

## 0.2.0 – 21.10.2026

Phase 2: Backup sichern und importieren.

## 0.1.0 – 17.10.2026

Phase 1: Produkte, BLS 4.0 offline, Lebensmittel-Liste.

## 0.0.0 – 17.10.2026

Phase 0: Fundament – PWA unter `/kcalm/`, App-Hülle, Navigation, Bausteine, Deploy.
