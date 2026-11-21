# Phase 16.2 – Gewicht von Garmin (Design)

Mit Jan abgestimmt am 21.11.2026. Teil von Phase 16 (Überblick: `2026-11-20-fitboard-vorschlaege-design.md`).

## Absicht

Garmin ist Jans einzige Quelle fürs Gewicht („Single Source of Truth“): Er wiegt sich auf der Index-Waage oder trägt von Hand in Garmin ein. Bisher kommt das Gewicht über Apple Health und einen iOS-Kurzbefehl in Kcalm – von Hand, und deshalb lückenhaft: Stand 21.11.2026 hat Kcalm 33 Gewichte, das letzte vom 26.10.; Garmin hat im selben Zeitraum mehr Tage (z. B. 14., 16.–18.10.) und Wiegungen bis gestern. Trend, Verbrauchsschätzung, g/kg-Makros und Gewichtskarte laufen dadurch auf altem Stand.

Ziel: Kcalm hat ohne Zutun immer dieselben Gewichte wie Garmin.

## Ziele

- Fitboard liefert Garmin-Gewichte ab **01.09.2026** an `kcalm-server`; Kcalm übernimmt sie **automatisch**, ohne Bestätigung.
- Kcalm spiegelt den Garmin-Stand: neue, geänderte und in Garmin **gelöschte** Wiegungen kommen mit.
- Die vorhandenen 33 Kurzbefehl-Gewichte werden durch Garmins Werte **ersetzt** (gleiche Tage: Garmins Wert; fehlende Tage kommen dazu).
- In Kcalm entfallen „Gewichte einfügen“ (Kurzbefehl), „Manuell“ und die Liste „Letzte Gewichte“ ganz.

## Nicht-Ziele

- Keine Bestätigung je Wiegung, keine Zeile im Tagebuch.
- Keine Körperzusammensetzung (Fett, Muskeln, Wasser), nur kg.
- Keine Gewichte vor dem 01.09.2026.
- Keine Änderung an Trend, Schätzung, g/kg-Rechnung oder Gewichtskarte – nur die Herkunft der Daten ändert sich.
- Kein Eintragen von Gewichten in Kcalm, auch nicht als Notlösung.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Kcalm verliert Gewichte, weil eine leere oder kaputte Liste ankommt (z. B. frische Fitboard-Datenbank, Garmin-Schlüssel abgelaufen).
- Jedes Abholen schreibt alle Gewichte neu und erzeugt Push-Verkehr ohne echte Änderung.
- Fehler beim Abholen erscheinen im Tagebuch oder blockieren die App.

## Randbedingungen

- Weg wie in 16.1: Fitboard schreibt mit `KCALM_INBOX_TOKEN` in `kcalm-server`, Kcalm liest mit seinem vorhandenen Token (`KCALM_API_TOKEN`), intern bzw. über `kcalm-api.dunkleschokola.de`.
- Ohne Server kommen keine neuen Gewichte mehr. Von Jan im Phase-16-Design freigegeben; `CLAUDE.md` bekommt diese Ausnahme ausdrücklich („Kcalm muss ohne Server vollständig funktionieren – außer neuen Gewichten, die nur noch aus Garmin über den Server kommen“).
- Offline bleibt alles Vorhandene nutzbar; nur das Abholen fällt aus.
- Kalendertage in Europe/Berlin; Garmins `calendarDate` ist der Tag.
- Mehrere Wiegungen am Tag: die **erste** zählt (bisherige Kcalm-Regel), nach Zeitpunkt der Messung.
- Snapshot-Prinzip bleibt unberührt: Gewichte waren nie Teil eines Snapshots; Trend und Ziele werden berechnet. Vergangene Tage können sich durch die vollständigeren Gewichte leicht verschieben – wie bisher bei jedem Kurzbefehl-Import.

## Ansätze

| | Ansatz | Abwägung |
|---|---|---|
| **A (gewählt)** | **Gewichtsliste auf dem Server:** Fitboard schreibt den ganzen Stand „Tag → Gewicht“ ab 01.09.2026, Kcalm holt ihn und gleicht ab | Übernahme der Geschichte, Korrekturen und Löschungen sind kein Sonderfall; kein Status, kein Verfall, keine Rückmeldung; neue Tabelle und zwei Wege auf dem Server |
| B | Gewichte als Briefkasten-Einträge (`kind: weight`), Kcalm übernimmt sie selbst | Näher am Wortlaut „über den Briefkasten“, aber braucht Ausnahmen von der 7-Tage-Grenze und vom Verfall, ein eigenes „Löschen“ und Rückmeldungen nur fürs Protokoll |
| C | Kcalm liest Garmin-Daten direkt aus Fitboard | Scheidet aus: Fitboard liegt hinter Cloudflare Access, Kcalm spricht nur mit dem eigenen Server |

Jan hat A gewählt (21.11.2026): Eine Gewichtsliste ist ein Stand, den man spiegelt, kein Vorschlag, über den man entscheidet. Abweichung vom Wortlaut des Phase-16-Designs („über den Briefkasten“) bewusst; Server, Tokens und Abholzeitpunkt sind dieselben.

## Entscheidungen

Von Jan:
- Automatisch übernehmen (keine Bestätigung).
- Garmin ersetzt alle Gewichte, ab 01.09.2026.
- Kurzbefehl-Import und manuelles Eintragen entfallen.

Von Claude vorgeschlagen, von Jan bestätigt:
- Korrekturen und Löschungen in Garmin wirken in Kcalm mit.
- Erste Wiegung des Tages zählt.
- Ein Schalter für beides: „Vorschläge aus Fitboard“ heißt künftig **„Daten aus Fitboard“**, Untertitel „Essensvorschläge und Gewicht aus Garmin“.
- Gewichte werden immer gespeichert, auch bei ausgeschalteter Verbrauchsschätzung.
- „Körpergewicht“ im Profil bleibt (Ersatzwert für g/kg ohne Trend, keine Wiegung).
- Schätzungs-Screen zeigt statt der Knöpfe die Herkunft („Gewicht aus Garmin · zuletzt …“); Kurzbefehl-Anleitung (App und `docs/kurzbefehl-gewichte.md`) entfällt.

## Aufbau

### kcalm-server

- Neue Tabelle `garmin_weights`: `date` (Primärschlüssel, `JJJJ-MM-TT`), `kg` (REAL), `measured_at` (ISO-Zeitstempel UTC). Dazu ein Merker, wann Fitboard die Liste zuletzt geschrieben hat und ab welchem Tag sie gilt (`from`), z. B. als Zeile in einer kleinen Tabelle `garmin_weights_meta` oder in einer vorhandenen Meta-Tabelle. Schema-Version erhöhen.
- `PUT /v1/weights` (Fitboard-Token): Body `{ from, items: [{ date, kg, measuredAt }] }`. Ersetzt die **ganze** Liste in einer Transaktion und setzt den Merker. Prüfung mit Zod, alles oder nichts: `from` gültiger Tag; jedes `date` ≥ `from` und ≤ morgen (Berlin), eindeutig; `kg` 20–300 (wie Kcalm `MIN_KG`/`MAX_KG`); höchstens 2000 Einträge. Fehlermeldung mit Pfad, nie mit Werten.
- `GET /v1/weights` (Kcalm-Token, CORS wie `/v1/inbox`): `{ ok: true, from, updatedAt, items: [{ date, kg, measuredAt }] }`, nach Datum sortiert; `updatedAt: null` und leere Liste, solange Fitboard nie geschrieben hat.
- Log wie bisher nur Methode, Pfad, Status, Dauer. README: neuer Weg, welcher Token.

### Fitboard (Version 0.8.0)

- Nach jedem erfolgreichen Garmin-Abruf (und beim Start) die Liste aus `garmin_days` (`kind = 'weight'`) bilden: Tage ≥ `from`, je Tag aus `allWeightMetrics` die Messung mit dem frühesten `timestampGMT` (gleich welche `sourceType`, also auch von Hand in Garmin eingetragene), `kg = weight / 1000` ohne weiteres Runden, `measuredAt` aus `timestampGMT`.
- `from` fest `2026-09-01` (Konstante; optional per `.env` überschreibbar).
- Nur senden, wenn sich die Liste seit dem letzten erfolgreichen Senden geändert hat (Prüfsumme im Status merken); einmal täglich trotzdem senden.
- **Schutz gegen leere Liste:** nicht senden, solange die Garmin-Historie `from` noch nicht abgedeckt hat (Cursor `historyDoneUntil` < `from` bzw. kein Garmin-Abruf erfolgreich).
- Ohne `KCALM_INBOX_TOKEN` aus (Logzeile wie bei den Vorschlägen). Fehler beim Senden: Fehlerart ins Log und in `fitboard_status`, nächster Versuch beim nächsten Abruf.
- Löschungen in Garmin kommen an, weil Fitboard pro abgerufenem Zeitraum ersetzt (letzte 7 Tage bei jedem Lauf, 30 Tage einmal täglich). Ältere Löschungen erst, wenn der Zeitraum erneut abgerufen wird – genügt.

### Kcalm (Version 2.2.0)

**Abholen:** In `src/app/inboxSync.ts` neben `fetchInbox` ein `fetchWeights` (Datei `src/db/garminWeights.ts`), gleicher Schalter (`config.suggestions`), gleicher Auslöser und gleicher Zustand für Fehler/letzten Erfolg (eine Statuszeile für beides). `GET /v1/weights`, Antwort mit Zod prüfen.

**Abgleich (reine Funktion, `src/logic/garminWeights.ts`, Vitest):** `reconcileWeights(local, remote, now)` → `{ created, updated, deleted }`:
- Für jeden Tag der Liste: kein lokales Gewicht → neu (`source: 'garmin'`); lokales mit anderem `kg`, `measuredAt` oder `source` → aktualisieren (`touch`); gleich → nichts.
- Jedes nicht gelöschte lokale Gewicht, dessen Tag **nicht** in der Liste ist → Löschmarker. Das betrifft auch Kurzbefehl- und manuelle Werte und Tage vor `from`.
- Liste ignorieren (nichts ändern), wenn `updatedAt` null **oder** die Liste leer ist – Schutz gegen Datenverlust.
- Mehrere lokale Gewichte am selben Tag (sollte es nicht geben): eines behalten, Rest löschen.
- Tests mit Grenzfällen: leere Liste, `updatedAt` null, nur Änderung von `measuredAt`, Löschen, Tag doppelt, nichts geändert → keine Schreibvorgänge.
- Speichern in einer Transaktion; nur Geändertes schreiben (damit der Push nur echte Änderungen überträgt).

**Schalter aus:** Abholen hört auf; vorhandene Gewichte bleiben unverändert (nichts wird gelöscht), wie beim Ausschalten der Schätzung. Beim Wiedereinschalten gleicht das nächste Abholen ab.

**Backup:** Gewichte bleiben im Backup. Nach dem Einspielen eines älteren Backups (z. B. mit Kurzbefehl-Werten) stellt das nächste Abholen den Garmin-Stand wieder her.

**Datenmodell:** `Weight.source` um `'garmin'` erweitern (`'health'` und `'manual'` bleiben für alte Daten und Backups). Keine neue Dexie-Version nötig (Index unverändert). Backup-Format bleibt 7; das Zod-Schema nimmt zusätzlich `'garmin'` an (Erweiterung, alte Backups bleiben gültig).

**Entfällt:** `src/logic/weightImport.ts` (+ Test), `importWeights`, `setManualWeight` und Gewicht löschen in `src/db/weights.ts`, `PasteSheet`, `ManualWeightSheet`, `GuideSheet` in `src/screens/einstellungen/schaetzung/`, `docs/kurzbefehl-gewichte.md`. `estimateView.ts` entsprechend.

**Oberfläche:**
- Server-Push-Screen: Schalter „Daten aus Fitboard“, Untertitel „Essensvorschläge und Gewicht aus Garmin“; Statuszeile wie bisher.
- Schätzungs-Screen, Karte zum Gewicht (statt „Letztes Gewicht“ mit Knöpfen):
  - Schalter an: „Gewicht aus Garmin“, darunter „zuletzt 20.11., 77,7 kg“ (letzte Wiegung; Anzeige auf 0,1 kg gerundet); bei Abholfehler zusätzlich die Fehlermeldung aus dem Zustand.
  - Schalter aus oder Push nicht eingerichtet: „Gewichte kommen aus Garmin. Einschalten unter Einstellungen › Daten › Server-Push › Daten aus Fitboard.“
  - Noch keine Wiegung: „Noch keine Wiegung aus Garmin“.
- Raster „Sammelt Daten“ und der Hinweis aufs Gewicht unter dem Raster bleiben, Text ohne Verweis auf den Kurzbefehl.
- Nur Tokens aus `design/tokens.json`; vorhandene Bausteine (Karte, Zeile, Hinweistext).

**Doku:** `PLAN.md` (Abschnitte „Gewicht aus Apple Health“ und „Verbrauchsschätzung“, 16.2 abhaken), `CLAUDE.md` (Ausnahme), `CHANGELOG.md`, `docs/iphone-test.md` Teil I.

## Ausrollen

Reihenfolge wie 16.1, jeder Push nach Jans OK: Server → Fitboard (füllt die Liste) → prüfen, dass `GET /v1/weights` die erwarteten Tage liefert (ab 01.09., 12.10. = 77,239 kg) → Kcalm 2.2.0.

iPhone-Test Teil I (Jan):
- Nach dem Update öffnen → Schätzungs-Screen zeigt „Gewicht aus Garmin · zuletzt …“ mit der letzten Garmin-Wiegung; keine Knöpfe „Gewichte einfügen“/„Manuell“.
- Gewichtskarte in der Statistik (3 Monate) zeigt Wiegungen bis gestern, ohne die Lücken vom Oktober.
- Neue Wiegung auf der Waage → nach Fitboards nächstem Abruf (≤ 10 min) und Öffnen der App in Kcalm.
- Eine Wiegung in Garmin löschen oder ändern (Testwert) → verschwindet bzw. ändert sich in Kcalm.
- Flugmodus → keine Fehlermeldung außerhalb des Push- und Schätzungs-Screens.
- Claude prüft auf dem Pi: Kcalm-Gewichte (Push-Kopie) = `garmin_weights`.

## Entscheidungen von Claude beim Aufschreiben (zur Prüfung durch Jan)

- Version 2.2.0 (MINOR), nicht 3.0.0: Daten und Backups bleiben gültig, die Bedienung ändert sich nur im Schätzungs-Screen.
- Kcalm ignoriert eine leere Liste; Fitboard sendet erst, wenn die Garmin-Historie ab 01.09. da ist (doppelter Schutz gegen Datenverlust).
- Eine Statuszeile für Vorschläge und Gewicht im Push-Screen.
- Backup-Format bleibt 7 (nur Erweiterung um `'garmin'`).

## Dem Umsetzer überlassen

- Name und Form des Merkers auf dem Server; Name der Prüfsumme in Fitboards Status.
- Genaue Texte der Fehlermeldungen (Muster wie bei `/v1/inbox`).
- Ob `fitboard_status` einen eigenen Eintrag „Gewicht an Kcalm“ bekommt oder im Kcalm-Eintrag steht.
- Aufteilung in Commits und Tests im Detail.
