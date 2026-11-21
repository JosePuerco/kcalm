# Phase 16.2 – Gewicht von Garmin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kcalm hat ohne Zutun dieselben Gewichte wie Garmin (ab 01.09.2026); Kurzbefehl-Import und manuelles Eintragen entfallen.

**Architecture:** Fitboard bildet nach jedem Garmin-Abruf die Liste „Tag → erste Wiegung“ und ersetzt damit per `PUT /v1/weights` (Inbox-Token) die Tabelle `garmin_weights` in `kcalm-server`. Kcalm holt sie beim Abholen der Vorschläge per `GET /v1/weights` (Kcalm-Token) und gleicht seine Tabelle `weights` daran an (neu, ändern, Löschmarker). Leere oder nie geschriebene Listen ändern nichts.

**Tech Stack:** Kcalm: React, Dexie, Zod, Vitest. `kcalm-server`: Node 24 (`node:sqlite`), Hono, Zod, Vitest. Fitboard: Node 24, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-garmin-gewicht-design.md`

## Global Constraints

- Garmin-Gewichte ab **2026-09-01**; je Tag die Messung mit dem frühesten `timestampGMT` aus `allWeightMetrics` (jede `sourceType`), `kg = weight / 1000` ohne Runden; Tag = Garmins `calendarDate`.
- `kg` 20–300 (Kcalm `MIN_KG`/`MAX_KG`); Datum ≤ morgen (Europe/Berlin); höchstens 2000 Einträge je Liste.
- Kcalm ändert nichts, wenn `updatedAt` null oder die Liste leer ist. Fitboard sendet nicht, solange die Garmin-Historie 2026-09-01 nicht abdeckt.
- Kcalm schreibt nur Gewichte, die sich wirklich ändern (sonst Push-Verkehr ohne Änderung).
- Schalter aus → kein Netzabruf, vorhandene Gewichte bleiben unverändert.
- Fehler beim Abholen nie im Tagebuch, nur im Push-Screen und im Schätzungs-Screen.
- Tokens: Fitboard nur mit `KCALM_INBOX_TOKEN` auf `PUT /v1/weights`, Kcalm nur mit seinem Token auf `GET /v1/weights`; keiner darf den Weg des anderen.
- Logs nur Methode, Pfad, Status, Dauer bzw. Anzahl und Fehlerart – nie Gewichte oder Tokens.
- Kcalm-Oberfläche Deutsch, Du-Form, Zahlen deutsch (`77,7 kg`), nur Tokens aus `design/tokens.json`, Touch-Ziele ≥ 44 px.
- `Weight.source` behält `'health'` und `'manual'` (alte Daten, Backups), neu `'garmin'`. Backup-Format bleibt 7, Dexie-Version bleibt.
- Versionen: `kcalm-server` ohne Versionsnummer, Fitboard 0.8.0, Kcalm 2.2.0. Ausrollen Server → Fitboard → Kcalm, jeder Push nach Jans OK.

## Review Focus

1. **Leere Liste nach frischer Fitboard-Datenbank oder abgelaufenem Garmin-Schlüssel** → Kcalm behält alle Gewichte. Tests in B1 (`shouldSendWeights` false ohne Historie) und C1 (`reconcileWeights` leer → keine Änderung).
2. **Zweimal abholen ohne Änderung** → keine Schreibvorgänge, kein Push. Test in C1 („gleich → nichts“) und C2 (`updatedAt` der Gewichte unverändert).
3. **Garmin liefert zwei Wiegungen an einem Tag** (z. B. 12.10.: 09:33 `USER_SETTING`, 05:53 Waage) → die frühere zählt (77,239). Test in B1.
4. **Kaputte Antwort vom Server** (kein JSON, `kg` außerhalb, doppelter Tag) → Kcalm ändert nichts, Fehler im Push-Zustand. Test in C1 (`parseWeightList`) und C2.
5. **Abholen der Vorschläge klappt, Gewicht nicht (oder umgekehrt)** → der Fehler des einen wird vom Erfolg des anderen nicht überschrieben. Test in C2.

---

## Teil A – `kcalm-server` (Repo `C:\Users\Jan\Documents\Claude Projekte\kcalm-server`)

### Task A1: Tabelle `garmin_weights` und Wege `/v1/weights`

**Files:**
- Modify: `src/db.ts` (neue Migration am Ende von `MIGRATIONS` → `user_version` 4)
- Create: `src/weights.ts`
- Modify: `src/app.ts` (zwei Wege nach den Briefkasten-Wegen)
- Modify: `README.md` (Abschnitt Wege/Tokens)
- Test: `test/weights.test.ts`, `test/app-weights.test.ts`

**Interfaces:**
- Produces: `GET /v1/weights` → `{ ok: true, from: string | null, updatedAt: string | null, items: { date: string; kg: number; measuredAt: string }[] }` (nach `date` sortiert). `PUT /v1/weights` mit Body `{ from: string, items: { date, kg, measuredAt }[] }` → `{ ok: true, count: number }` bzw. 400 `{ ok: false, error }`.
- In `src/weights.ts`: `weightsBodySchema` (Zod), `replaceWeights(db, json: unknown, now: Date): { ok: true; count: number } | { ok: false; error: string }`, `listWeights(db): { from: string | null; updatedAt: string | null; items: … }`.

Migration:
```sql
CREATE TABLE garmin_weights (date TEXT PRIMARY KEY, kg REAL NOT NULL, measured_at TEXT NOT NULL);
CREATE TABLE garmin_weights_meta (id INTEGER PRIMARY KEY CHECK (id = 1), from_date TEXT NOT NULL, updated_at TEXT NOT NULL);
```

- [ ] **Step 1: Failing tests** in `test/weights.test.ts`:
  - `migrate legt garmin_weights an` – `schemaVersion(db) === 4`.
  - `nie geschrieben → from und updatedAt null, items leer`.
  - `replaceWeights ersetzt die ganze Liste` – erst 3 Tage, dann 2 andere → `listWeights` zeigt nur die 2, `updatedAt === now.toISOString()`, `from` wie gesendet.
  - `ungültig → nichts geändert` – je ein Fall: `kg` 19,9 / 300,1, `date` < `from`, `date` > morgen (Berlin), Tag doppelt, 2001 Einträge, Zusatzfeld (`.strict()`); Fehler beginnt mit `Ungültig:` und enthält den Pfad, nie den Wert; vorherige Liste unverändert.
  - `leere Liste ist erlaubt` – `count 0`, `updatedAt` gesetzt (Kcalm entscheidet, sie zu ignorieren).
- [ ] **Step 2:** `npm test` → neue Tests rot.
- [ ] **Step 3:** Migration und `src/weights.ts`. Ersetzen in `BEGIN IMMEDIATE … COMMIT` (DELETE, INSERTs, Meta-Upsert), Muster wie `addSuggestions` in `src/inbox.ts`; `berlinDate`/`addDays` von dort importieren.
- [ ] **Step 4: Failing tests** in `test/app-weights.test.ts` (Muster `test/app-inbox.test.ts`):
  - `Fitboard ersetzt, Kcalm liest` – PUT mit `INBOX_TOKEN` 200, GET mit `TOKEN` liefert dieselben Einträge.
  - `PUT mit Kcalm-Token → 401`, `GET mit Inbox-Token → 401`, `ohne Token → 401`.
  - `ungültig → 400 mit Pfad`.
  - `CORS-Vorabanfrage für GET /v1/weights von Kcalms Herkunft erlaubt`.
- [ ] **Step 5:** Wege in `src/app.ts`: `app.get('/v1/weights', kcalmAuth, …)`, `app.put('/v1/weights', fitboardAuth, limit, …)` (JSON-Fehler → 400 „Kein gültiges JSON“ wie bei `/v1/inbox`). CORS bleibt (`GET` ist erlaubt; Fitboard ist kein Browser). README ergänzen.
- [ ] **Step 6:** `npm test` und `npm run typecheck` (falls vorhanden) grün.
- [ ] **Step 7:** Commit „Gewichte aus Garmin: Tabelle und Wege /v1/weights“.

## Teil B – Fitboard (Repo `C:\Users\Jan\Documents\Claude Projekte\fitboard`, Branch `garmin-gewicht`)

### Task B1: Gewichtsliste bilden und an `kcalm-server` senden

**Files:**
- Create: `src/kcalm/weights.ts`
- Modify: `src/kcalm/inbox-writer.ts` (`putWeights`)
- Modify: `src/status.ts` (`Source` + `'kcalm_weights'`)
- Modify: `src/config.ts` (`kcalm.weightsFrom`), `.env.example`
- Modify: `src/index.ts` (Writer vor dem Garmin-Zeitplan anlegen, nach `syncGarmin` senden)
- Modify: `README.md`, `CHANGELOG.md` (0.8.0), `package.json` (Version erst beim Ausrollen, Task D1)
- Test: `test/kcalm-weights.test.ts`, `test/kcalm-inbox-writer.test.ts`, `test/config.test.ts`

**Interfaces:**
- Consumes: `PUT /v1/weights` aus A1.
- Produces:
  - `export interface GarminWeight { date: string; kg: number; measuredAt: string }`
  - `buildWeightList(db: Db, from: string): GarminWeight[]` – aus `garmin_days` (`kind = 'weight'`, `date >= from`), nach `date` sortiert.
  - `shouldSendWeights(input: { historyDoneUntil: string | null; from: string; hash: string; last: { hash: string; sentOn: string } | null; today: string }): boolean`
  - `sendGarminWeights(db: Db, writer: InboxWriter, opts: { from: string; today: string; now: Date }): Promise<'sent' | 'unchanged' | 'waiting'>` – liest den Garmin-Cursor (`getStatus(db, 'garmin')`), bildet Liste und Hash (SHA-256 über das JSON), sendet bei Bedarf, merkt `{ hash, sentOn }` als Cursor von `'kcalm_weights'` (`recordSuccess`), Fehler über `recordFailure(db, 'kcalm_weights', …)` und weiterwerfen.
  - `InboxWriter.putWeights(body: { from: string; items: GarminWeight[] }): Promise<{ count: number }>` – Fehlerbehandlung wie `add` (400 → `InputError` mit Server-Grund, 401 → Token-Hinweis).
  - `config.kcalm.weightsFrom: string` aus `KCALM_WEIGHTS_FROM`, Standard `'2026-09-01'`, muss ein gültiger Tag sein.

- [ ] **Step 1: Failing tests** in `test/kcalm-weights.test.ts` (Fixture-Zeilen im Format von Garmins `dailyWeightSummaries`):
  - `nimmt je Tag die früheste Messung` – Tag mit `[{weight: 77200, timestampGMT: 09:33, sourceType: 'USER_SETTING'}, {weight: 77239, timestampGMT: 05:53, sourceType: 'INDEX_SCALE'}]` → `kg 77.239`, `measuredAt` = 05:53 als ISO.
  - `ab from, nach Datum sortiert` – Tage vor `from` fehlen.
  - `Tag ohne allWeightMetrics oder ohne Gewicht fällt weg`.
  - `shouldSendWeights`: `historyDoneUntil` null → false; `historyDoneUntil < from` → false; gleicher Hash, gleicher Tag → false; gleicher Hash, `sentOn` gestern → true; anderer Hash → true; noch nie gesendet → true.
  - `sendGarminWeights`: mit Fake-Writer – `'waiting'` ohne Historie (kein Aufruf), `'sent'` beim ersten Mal, `'unchanged'` beim zweiten Mal am selben Tag; Writer-Fehler → `recordFailure` gesetzt, Fehler geworfen.
- [ ] **Step 2: Failing tests** in `test/kcalm-inbox-writer.test.ts`: `putWeights schickt PUT /v1/weights mit Bearer-Token`, `400 → InputError mit Server-Grund`, `401 → Token-Hinweis`. In `test/config.test.ts`: `weightsFrom Standard 2026-09-01`, `ungültiges KCALM_WEIGHTS_FROM → Fehler`.
- [ ] **Step 3:** `npm test` → rot.
- [ ] **Step 4:** Implementieren. Garmin-Cursor-Feld `historyDoneUntil` aus `GarminCursor` in `src/garmin/sync.ts` (Cursor-JSON aus `getStatus`). In `src/index.ts`: `kcalmInbox` vor dem Garmin-Zeitplan anlegen; im Garmin-Job nach `syncGarmin`: wenn `kcalmInbox`, `sendGarminWeights(…)` in eigenem try/catch, Log `garmin: Gewicht an Kcalm gesendet (n Tage)` / `unverändert` / `wartet auf Garmin-Historie`, Fehler nur mit Fehlerart. `fitboard_status` zeigt `kcalm_weights` automatisch über `SOURCES` – prüfen, dass Status-Tests das zulassen, sonst anpassen.
- [ ] **Step 5:** README (neuer Ablauf, `KCALM_WEIGHTS_FROM`), `.env.example`, CHANGELOG-Abschnitt `## 0.8.0 – TT.MM.JJJJ` (Gewicht an Kcalm, Schutz gegen leere Liste).
- [ ] **Step 6:** `npm test` und `npm run typecheck` grün.
- [ ] **Step 7:** Commit „Garmin-Gewichte an Kcalm senden“.

## Teil C – Kcalm (dieses Repo)

### Task C1: Rechenlogik Abgleich

**Files:**
- Create: `src/logic/garminWeights.ts`
- Modify: `src/db/types.ts` (`Weight.source: 'health' | 'manual' | 'garmin'`), `src/logic/backup.ts` (Zod-Enum um `'garmin'`)
- Test: `src/logic/garminWeights.test.ts`, `src/logic/backup.test.ts`

**Interfaces:**
- Produces:
  - `export interface RemoteWeight { date: LocalDate; kg: number; measuredAt: Timestamp }`
  - `export interface WeightList { from: LocalDate | null; updatedAt: Timestamp | null; items: RemoteWeight[] }`
  - `parseWeightList(json: unknown): WeightList | null` – Zod; `null` bei jedem Fehler (kein `ok: true`, `kg` außerhalb `MIN_KG`/`MAX_KG`, Tag doppelt, falsches Format).
  - `reconcileWeights(local: readonly Weight[], list: WeightList, now: Date): { created: Weight[]; updated: Weight[]; deleted: Weight[] }`
  - `MIN_KG = 20`, `MAX_KG = 300` ziehen von `src/logic/weightImport.ts` hierher um (C3 löscht `weightImport.ts`).

- [ ] **Step 1: Failing tests** `src/logic/garminWeights.test.ts`:
  - `parseWeightList`: gültig → Objekt; `ok` fehlt / `kg` 19 / Tag doppelt / `date` kein Kalendertag → `null`.
  - `reconcileWeights`:
    - `updatedAt null → keine Änderung`; `leere Liste → keine Änderung` (auch wenn lokal Gewichte da sind).
    - `neuer Tag → created mit source garmin, kg und measuredAt aus der Liste` (über `newRecord`).
    - `gleicher Tag, anderes kg → updated` (über `touch`, gleiche `id`); `nur measuredAt anders → updated`; `source health, Werte gleich → updated auf garmin`.
    - `alles gleich → keine Änderung`.
    - `lokaler Tag fehlt in der Liste → deleted` (über `softDelete`), auch `source manual` und Tage vor `from`; bereits gelöschte bleiben unberührt.
    - `zwei lokale Gewichte am selben Tag → eines abgeglichen, das andere deleted`.
  - `backup.test.ts`: `Backup mit source garmin round-trip`.
- [ ] **Step 2:** `npm test -- garminWeights backup` → rot.
- [ ] **Step 3:** Implementieren (reine Funktionen, keine Dexie-Zugriffe).
- [ ] **Step 4:** `npm test` grün, `npm run lint` sauber.
- [ ] **Step 5:** Commit „Rechenlogik Gewicht aus Garmin“.

### Task C2: Abholen und Speichern

**Files:**
- Create: `src/db/garminWeights.ts`
- Modify: `src/logic/push.ts` (`weightsEndpoint`), `src/app/inboxSync.ts`
- Test: `src/db/garminWeights.test.ts`

**Interfaces:**
- Consumes: `parseWeightList`, `reconcileWeights` (C1); `GET /v1/weights` (A1); `PushStorage`, `PushNet`, `readyConfig`, `pushErrorMessage` wie in `src/db/inbox.ts`.
- Produces:
  - `weightsEndpoint(serverUrl: string): string` → `${serverUrl}/v1/weights`
  - `fetchWeights(storage: PushStorage, net?: PushNet, now?: Date): Promise<'off' | 'ok' | 'failed'>` – `'off'` wie `fetchInbox` (Schalter `config.suggestions` aus oder Push nicht bereit, keine Anfrage). Bei Fehler: `storage.saveInboxState({ ...storage.loadInboxState(), lastError: pushErrorMessage(…) })`. Bei Erfolg: Abgleich in einer Dexie-Transaktion über `db.weights`, `bulkPut` nur von `created`/`updated`/`deleted`; Inbox-Zustand **nicht** anfassen.
  - `runInboxFetch()` ruft nacheinander `fetchInbox` und `fetchWeights`; ein Fehler des einen verhindert den anderen nicht.

- [ ] **Step 1: Failing tests** `src/db/garminWeights.test.ts` (Muster `src/db/inbox.test.ts`, fake-indexeddb, Fake-Net):
  - `Schalter aus → off, keine Anfrage, vorhandene Gewichte unverändert`.
  - `Verbrauchsschätzung aus → Gewichte werden trotzdem gespeichert`.
  - `GET ${URL}/v1/weights mit Bearer-Token`.
  - `ersetzt Kurzbefehl-Gewichte durch Garmin` – lokal `health` 12.10. 77,2; Liste 12.10. 77,239 und 14.10. 74,79 → zwei Gewichte `garmin`.
  - `zweites Abholen ohne Änderung → updatedAt aller Gewichte unverändert`.
  - `kaputte Antwort → failed, Gewichte unverändert, lastError gesetzt`.
  - `Fehler beim Gewicht überschreibt nicht lastSuccessAt der Vorschläge`; `Erfolg beim Gewicht löscht keinen lastError der Vorschläge`.
- [ ] **Step 2:** `npm test -- garminWeights` → rot.
- [ ] **Step 3:** Implementieren; HTTP-Teil wie `get` in `src/db/inbox.ts` (gemeinsame Hilfsfunktion herausziehen statt kopieren, wenn es ohne Umbau geht).
- [ ] **Step 4:** `npm test` grün, `npm run lint` sauber.
- [ ] **Step 5:** Commit „Gewichte aus Garmin abholen und abgleichen“.

### Task C3: Oberfläche, Kurzbefehl und Manuell entfernen

**Files:**
- Modify: `src/screens/einstellungen/PushScreen.tsx` (Schalter-Text)
- Modify: `src/screens/einstellungen/EstimateScreen.tsx` (Karte „Gewicht“)
- Modify: `src/logic/estimateView.ts` (+ Test): `lastWeightText` neu, `importMessage` weg
- Modify: `src/db/weights.ts` (+ Test): `importWeights`, `setManualWeight`, `deleteWeight` weg
- Delete: `src/logic/weightImport.ts`, `src/logic/weightImport.test.ts`, `src/screens/einstellungen/schaetzung/PasteSheet.tsx`, `ManualWeightSheet.tsx`, `GuideSheet.tsx`, `docs/kurzbefehl-gewichte.md`

**Interfaces:**
- Consumes: `getPushStorage()` (Konfiguration und Inbox-Zustand) aus `src/app/pushSync.ts`.
- Produces: `lastWeightText(weight: Pick<Weight, 'date' | 'kg'> | undefined, today: LocalDate): string` → `'Noch keine Wiegung aus Garmin'` bzw. `'zuletzt 20.11., 77,7 kg'` (Tag über `dayLabel`: „heute“/„gestern“ oder Datum; `formatNumber(kg, 1)`).

Texte (fest):
- Push-Screen, Schalter: Label `Daten aus Fitboard`, Untertitel `Essensvorschläge und Gewicht aus Garmin`; Statuszeile wie bisher (Label `Vorschläge` → `Abgeholt`, weil sie jetzt für beides gilt).
- Schätzungs-Screen, Karte „Gewicht“: Zeile `Gewicht aus Garmin` mit `lastWeightText(…)` rechts. Darunter, wenn Schalter aus oder Push nicht eingerichtet: `Gewichte kommen aus Garmin. Einschalten unter Einstellungen › Daten › Server-Push › Daten aus Fitboard.`; wenn Schalter an und `lastError`: der Fehlertext in `text-warn-text`. Keine Knöpfe mehr.
- Hinweise unter dem Raster „Sammelt Daten“ ohne Kurzbefehl-Bezug (Text prüfen und anpassen).

- [ ] **Step 1: Failing tests** `estimateView.test.ts`: `lastWeightText` – `undefined` → `Noch keine Wiegung aus Garmin`; heute → `zuletzt heute, 77,7 kg`; älter → `zuletzt 20.11., 77,7 kg`. Alte Tests zu Import und Uhrzeit entfernen.
- [ ] **Step 2:** `npm test -- estimateView` → rot.
- [ ] **Step 3:** Umsetzen, Dateien löschen, tote Importe entfernen (`npm run lint` findet sie).
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` grün.
- [ ] **Step 5:** Im Headless-Chrome bei 390 px prüfen (Hell/Dunkel): Schätzungs-Screen mit Schalter an/aus, mit/ohne Wiegung, mit Fehler; Push-Screen-Schalter.
- [ ] **Step 6:** Commit „Gewicht nur noch aus Garmin: Oberfläche, Kurzbefehl und Manuell entfernt“.

### Task C4: Doku

**Files:**
- Modify: `CLAUDE.md` (Produkt-Regel: „Kcalm muss ohne Server vollständig funktionieren – außer neuen Gewichten, die seit 16.2 nur aus Garmin über den eigenen Server kommen“), `PLAN.md` (Abschnitte „Gewicht aus Apple Health“ → „Gewicht aus Garmin“, „Verbrauchsschätzung“ erster Punkt; 16.2 Teilpunkte A–C), `docs/iphone-test.md` (neuer Teil I, Punkte aus dem Design „Ausrollen“), `docs/ops.md` falls Wege gelistet sind.

- [ ] **Step 1:** Texte anpassen; `grep -rn "Kurzbefehl" src docs PLAN.md CLAUDE.md` zeigt nur noch Kamera-/historische Stellen.
- [ ] **Step 2:** `npm test` und `npm run lint` grün.
- [ ] **Step 3:** Commit „Doku Phase 16.2“.

## Teil D – Ausrollen

### Task D1: Ende-zu-Ende und Versionen (jeder Push nur nach Jans OK)

- [x] **Step 1:** `kcalm-server`: Push; auf dem Pi `git pull && docker compose up -d --build` (vorher `bash scripts/backup.sh`); `GET /v1/health` 200; `GET /v1/weights` ohne Token 401.
- [ ] **Step 2:** Fitboard 0.8.0 wie 0.7.0 (Versions-Commit, Merge `--no-ff` nach `main`, Tag, Push, auf dem Pi Sicherung `VACUUM INTO`, `git pull`, `docker compose up -d --build`). Log zeigt „Gewicht an Kcalm gesendet“. Auf dem Pi prüfen: `garmin_weights` ab 2026-09-01, 12.10. = 77,239, letzter Tag = letzte Garmin-Wiegung.
- [ ] **Step 3:** Kcalm 2.2.0 nach `CLAUDE.md` (CHANGELOG, Tag, Push, `npm run deploy`, `curl -I`, Release).
- [ ] **Step 4:** Jan: iPhone-Test Teil I. Claude prüft danach auf dem Pi: Kcalm-Gewichte (Push-Kopie, Ansicht `weights`) = `garmin_weights`, alle `source garmin`; Test-Wiegung in Garmin gelöscht → nach Fitboard-Abruf und App-Öffnen auch in Kcalm gelöscht.
- [ ] **Step 5:** `PLAN.md` abhaken, Zwischenstand, Commit.
