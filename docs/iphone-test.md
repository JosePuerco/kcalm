# iPhone-Test: Offline und Backup

Abschlusstest vor Version 1.0.0 auf dem iPhone 16e. Reihenfolge einhalten: Teil D löscht die App und braucht das Backup aus Teil C.

## A. Update und Start

- [ ] Kcalm öffnen, ganz schließen (App-Umschalter, nach oben wischen) und neu öffnen, damit die neue Version aktiv wird
- [ ] Einstellungen › Über zeigt die erwartete Version (z. B. „Version 0.11.0“)
- [ ] Beim Öffnen erscheint kurz das Startbild (blaues Icon in der Mitte) statt eines weißen Schirms
- [ ] iPhone auf Dunkel stellen, App ganz schließen, öffnen: Startbild dunkel? (Falls hell: notieren, iOS beachtet das evtl. nicht)
- [ ] Einstellungen › Darstellung: System / Hell / Dunkel schalten sofort um; nach Neustart bleibt die Wahl
- [ ] Unter Einstellungen gibt es keinen Eintrag „Bausteine (Vorschau)“ mehr
- [ ] Profile und Ziele: Wochenbudget zeigt „19.600 kcal“ (mit Punkt, „kcal“ direkt dahinter); beim Antippen nur Ziffern

## B. Offline (Flugmodus)

Vorher einmal mit Netz öffnen, damit alles im Cache liegt. Dann Flugmodus an (WLAN auch aus) und App ganz schließen.

- [ ] App startet im Flugmodus, Tagebuch erscheint mit allen Daten
- [ ] Hinzufügen: Suche findet eigene Produkte und BLS (z. B. „Banane“), Eintrag speichern klappt
- [ ] Schnelleintrag und Mahlzeit eintragen klappen
- [ ] Scanner startet nach Tipp, Kamera läuft, Barcode wird erkannt (Decoder ist offline da)
- [ ] Barcode eines noch nie gescannten Produkts → Sheet „Kein Internet“ (Barcode gemerkt), „Später“ → Zeile mit dem gemerkten Scan über den Slots
- [ ] Statistik, Verbrauchsschätzung, Lebensmittel-Liste und Produktdetail öffnen ohne Fehler
- [ ] Export: „Teilen“ öffnet das Teilen-Menü (z. B. „In Dateien sichern“)
- [ ] Flugmodus aus, App in den Vordergrund holen: gemerkter Scan wird nachgeladen (Zeile verschwindet bzw. zeigt das Produkt)

## C. Backup sichern

- [ ] Ein paar erkennbare Testdaten anlegen (z. B. Eintrag „Backup-Test“ heute, eigenes Produkt, Gewicht)
- [ ] Einstellungen › Backup › „Jetzt sichern“ → Teilen-Menü → „In Dateien sichern“ → iCloud Drive
- [ ] Statuszeile zeigt danach „Gesichert heute, …“ mit Uhrzeit (nicht orange)
- [ ] In der Dateien-App liegt die Datei `kcalm-backup-….json` in iCloud Drive

## D. Neu installieren und zurückspielen

- [ ] App vom Home-Bildschirm löschen (löscht alle Daten auf dem Gerät)
- [ ] In Safari `josepuerco.github.io/kcalm/` öffnen → Seitenmenü (drei Striche) → Website-Einstellungen → Kamera „Erlauben“ (siehe `docs/kamera-erlaubnis.md`), dann Teilen → „Zum Home-Bildschirm“
- [ ] Neu installierte App zeigt Icon „Kcalm“ und startet mit dem Willkommensbildschirm (Ring zeichnet sich)
- [ ] „Aus Backup laden“ → Datei aus iCloud Drive wählen → „Ersetzen“ → „Alles ersetzen“ → direkt ins Tagebuch
- [ ] Tagebuch zeigt alle Tage, auch den Eintrag „Backup-Test“; Profile, Slots, Produkte, Mahlzeiten, Rezepte, Gewichte sind da
- [ ] Darstellung, Verbrauchsschätzung an/aus und „Letztes Backup“ sind wie vorher
- [ ] Testdaten aus Teil C wieder löschen

## E. Ergebnis

Alles abgehakt → Claude Code Bescheid geben; dann wird Phase 11 abgeschlossen und Version 1.0.0 veröffentlicht. Auffälligkeiten mit Schritt und Bildschirmfoto melden.

## E. Server-Push (ab 1.5.0)

Token vorher auf dem Laptop holen (PowerShell) und aufs iPhone bringen, z. B. über eine Notiz auf icloud.com, die du danach löschst:
`ssh jan@pi.local "grep -oP '(?<=KCALM_API_TOKEN=).*' ~/kcalm-server/.env" | Set-Clipboard`

- [ ] Einstellungen › Daten: Zeile „Server-Push“ zeigt „Aus“; unter „Über“ steht „alle Daten bleiben auf diesem Gerät“
- [ ] Server-Push öffnen: Adresse `https://kcalm-api.dunkleschokola.de`, Token einfügen, „Sichern“ → Hinweis „Gesichert“ (iOS zoomt beim Tippen nicht)
- [ ] Schalter „Automatisch übertragen“ an → nach wenigen Sekunden „Letzte Übertragung heute, …“, „0 Änderungen“, kein Fehler
- [ ] Unter „Über“ steht jetzt „Daten liegen auf diesem Gerät und deinem eigenen Server“
- [ ] Claude prüft auf dem Pi: Anzahl Einträge, Tagesziele, Profile wie in der App
- [ ] Eintrag anlegen, einen ändern, einen löschen → nach ca. 3 s „0 Änderungen“; Claude prüft auf dem Pi
- [ ] Flugmodus an, Eintrag anlegen → Status „1 Änderung“, „Letzter Fehler: Server nicht erreichbar“, Zeile unter „Daten“ orange; App läuft normal weiter
- [ ] Flugmodus aus, App in den Vordergrund holen → Fehler weg, „0 Änderungen“ (sonst „Jetzt übertragen“)
- [ ] App ganz schließen und neu öffnen: Adresse und Token sind noch da, Push läuft beim Start
- [ ] Backup sichern: Die Datei enthält kein Token (Claude kann sie prüfen)
