# Phase 16.1 – Vorschläge aus Fitboard (Fundament) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude legt über Fitboard Tagebuch-Vorschläge in einen Briefkasten in `kcalm-server`; Kcalm holt sie ab, Jan übernimmt (einzeln oder als Gruppe) oder lehnt ab, und die Entscheidung kommt per Push zurück.

**Architecture:** `kcalm-server` bekommt die Tabelle `inbox` mit Schreibzugang für Fitboard (eigener Token, intern `http://kcalm-api:3000`) und Lesezugang für Kcalm (vorhandener Token). Kcalm speichert Abgeholtes lokal (`inbox`, nicht synchronisiert) und Entscheidungen in der sync-fähigen Tabelle `inboxDecisions`, die mit dem normalen Push zum Server geht; der Server setzt daraus den Stand. Fitboard schreibt über HTTP und liest den Stand aus seiner Kopie von `kcalm.sqlite`.

**Tech Stack:** Kcalm: React, Dexie, Zod, Vitest. `kcalm-server`: Node 24 (`node:sqlite`), Hono, Zod, `node:test`/Vitest wie im Repo. Fitboard: Node 24, MCP SDK, Zod.

**Spec:** `docs/superpowers/specs/2026-11-20-fitboard-vorschlaege-design.md`

## Global Constraints

- Unbekannte Nährwerte sind `null`, niemals 0 – in jedem Repo, jedem Schema, jeder Umrechnung.
- Rechenlogik in Kcalm als reine Funktionen in `src/logic/` mit Vitest-Tests inkl. Grenzfällen; intern exakt, nur die Anzeige rundet.
- Snapshot-Prinzip: Ein übernommener Vorschlag speichert absolute Nährwerte im Eintrag; spätere Änderungen ändern ihn nie.
- Sync-Felder `id`, `createdAt`, `updatedAt`, `deletedAt` für jede neue sync-fähige Tabelle; Löschen = Löschmarker.
- Backup-Formatänderung → `BACKUP_FORMAT_VERSION` erhöhen und Migration in `MIGRATIONS` schreiben; Dexie-Version erhöhen mit `upgrade`.
- Datum der Vorschläge: heute − 7 bis morgen, Kalendertage Europe/Berlin; Vorschläge mit Datum < heute − 7 sind `expired`.
- Höchstens 20 Teile je Gruppe; Grenzen: `amount` ≤ 10 000, `kcal` ≤ 10 000, Gramm-Werte ≤ 1 000, `salt` ≤ 100; alle Zahlen ≥ 0.
- Tokens ≥ 32 Zeichen; Kcalm-Token und Inbox-Token verschieden; keiner darf die Wege des anderen.
- Logs: nur Methode, Pfad, Status, Dauer bzw. Werkzeugname, Anzahl, Fehlerart – nie Inhalte oder Tokens.
- Kcalm-Oberfläche Deutsch, Du-Form, Zahlen deutsch, nur Tokens aus `design/tokens.json`, Touch-Ziele ≥ 44 px.
- Ohne Schalter „Vorschläge aus Fitboard“ kein einziger Netzabruf; Fehler beim Abholen nie im Tagebuch, nur im Push-Screen.
- Ausrollen nur in dieser Reihenfolge: `kcalm-server` → Fitboard → Kcalm 2.1.0 (der alte Server lehnt Pushes mit `inboxDecisions` ab). Push/Deploy jeweils erst nach Jans OK.

## Review Focus

1. **Push mit `inboxDecisions` an einen Server ohne die Tabelle** → ganzer Push abgelehnt, Kcalm hängt. Erwartet: Server kennt die Tabelle vor Kcalm 2.1.0 (Task A1 testet Annahme), Rollout-Reihenfolge in Task D1.
2. **Derselbe Vorschlag kommt erneut** (zweites Abholen, Backup-Import, zweimal getippt) → nie zweimal im Tagebuch. Test in Task C2 (`visibleSuggestions`) und C3 (`acceptSuggestions` ignoriert bereits entschiedene ids).
3. **Verweis auf etwas, das Kcalm nicht (mehr) kennt** (gelöscht, archiviert) → mitgeschickte freie Werte gelten; sonst „Lebensmittel nicht gefunden“, nicht übernehmbar. Test in Task C2.
4. **Slotname passt nicht** (in Kcalm umbenannt oder gelöscht) → wie `null`, Jan wählt. Test in Task C2.
5. **Kaputter oder übergroßer Teil im Briefkasten** → nur dieser Teil fällt weg, die übrigen erscheinen; `null` wird nie 0. Tests in Task A2 (Server lehnt ab) und C2 (`parseInbox` filtert einzeln).

---

## Teil A – `kcalm-server` (Repo `C:\Users\Jan\Documents\Claude Projekte\kcalm-server`)

### Task A1: Tabelle `inbox`, Ansicht und `inboxDecisions` im Push

**Files:**
- Modify: `src/db.ts` (Migration 3 an `MIGRATIONS` anhängen)
- Modify: `src/push.ts` (`SYNC_TABLES`, `applyPush`)
- Test: `test/push.test.ts`, `test/inbox.test.ts` (neu, Schema-Teil)

**Interfaces:**
- Produces: SQL-Tabelle `inbox(id TEXT PRIMARY KEY, kind TEXT NOT NULL, date TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, fetched_at TEXT) STRICT`; Ansicht `inbox_view` (id, kind, date, status, payload, created_at, updated_at, fetched_at) für Fitboard; `'inboxDecisions'` in `SYNC_TABLES`.

- [ ] **Step 1: Failing tests**
  - `migrate legt inbox und inbox_view an` – nach `migrate` existieren beide, `schemaVersion(db) === 3`.
  - `push nimmt inboxDecisions an` – Push mit `{ table: 'inboxDecisions', record: { id: X, decision: 'accepted', entryIds: [...], createdAt, updatedAt, deletedAt: null } }` → `ok`.
  - `push setzt inbox.status aus inboxDecisions` – offener Inbox-Eintrag X, Push mit Entscheidung `rejected` → `status = 'rejected'`, `updated_at` = jetzt; unbekannte X → kein Fehler.
  - `Entscheidung ändert withdrawn/expired nicht` – Status bleibt.
- [ ] **Step 2:** `npm test` → die vier Tests schlagen fehl.
- [ ] **Step 3:** Migration 3 schreiben; in `applyPush` innerhalb derselben Transaktion je `inboxDecisions`-Datensatz `UPDATE inbox SET status = ?, updated_at = ? WHERE id = ? AND status = 'open'`.
- [ ] **Step 4:** `npm test` → alle grün.
- [ ] **Step 5:** Commit „Briefkasten: Tabelle inbox, Entscheidungen aus dem Push“.

### Task A2: Briefkasten-Logik `src/inbox.ts`

**Files:**
- Create: `src/inbox.ts`
- Test: `test/inbox.test.ts`

**Interfaces:**
- Produces:
  - `entrySuggestionSchema` (Zod) für `payload` bei `kind: 'entry'`: `{ slot: string|null, group: { id: uuid, name: string(1..60) } | null, ref: { type: 'product'|'meal'|'recipe', id: string } | null, name: string(1..80), amount: number|null, unit: string(1..10)|null, kcal, protein, carbs, sugar, fat, satFat, fiber, salt: number|null }` – Grenzen aus „Global Constraints“; `ref === null` verlangt `kcal !== null`.
  - `addSuggestions(db, body: { items: { id: string; date: string; payload: unknown }[] }, now: Date): { added: number; ignored: number }` – 1–20 Items, ganzer Aufruf in einer Transaktion; vorhandene `id` → `ignored`; Datum außerhalb heute − 7…morgen (Berlin) oder ungültiges `payload` → Fehler mit Index, nichts gespeichert.
  - `withdrawSuggestion(db, id, now): 'withdrawn' | 'notFound' | 'notOpen'`
  - `openForKcalm(db, now): { id; kind; date; payload; createdAt }[]` – setzt vorher `expired` für `open` mit Datum < heute − 7, setzt `fetched_at` wo leer, liefert `open` sortiert nach `date`, `created_at`.

- [ ] **Step 1: Failing tests** `addSuggestions speichert offene Vorschläge`, `gleiche id zweimal → ignored`, `Datum gestern−7 ok, −8 abgelehnt, übermorgen abgelehnt` (Berlin-Datum, Test mit `now` 2026-11-20T23:30:00Z = 21.11. in Berlin), `kcal 0 bleibt 0, kcal null bleibt null`, `freier Teil ohne kcal abgelehnt`, `21 Items abgelehnt`, `negativer Wert abgelehnt`, `withdraw nur aus open`, `openForKcalm setzt expired und fetched_at`.
- [ ] **Step 2:** Tests laufen rot.
- [ ] **Step 3:** Implementieren; Berlin-Datum über `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })`.
- [ ] **Step 4:** Tests grün.
- [ ] **Step 5:** Commit „Briefkasten: Vorschläge anlegen, zurückziehen, für Kcalm ausliefern“.

### Task A3: Wege und Token

**Files:**
- Modify: `src/config.ts` (`inboxToken` aus `KCALM_INBOX_TOKEN`, Pflicht, ≥ 32, ≠ `token`), `src/app.ts`, `.env.example`, `README.md`
- Test: `test/app.test.ts`, `test/config.test.ts`

**Interfaces:**
- Produces: `POST /v1/inbox` (Inbox-Token, Body `{ items }`, Antwort `{ ok: true, added, ignored }` bzw. 400 `{ ok: false, error }`), `POST /v1/inbox/:id/withdraw` (Inbox-Token, 200/404/409), `GET /v1/inbox` (Kcalm-Token, Antwort `{ ok: true, items }`). CORS unverändert (nur Kcalms Herkunft, GET/POST).

- [ ] **Step 1: Failing tests** `GET /v1/inbox mit Kcalm-Token 200`, `GET /v1/inbox mit Inbox-Token 401`, `POST /v1/inbox mit Kcalm-Token 401`, `POST /v1/push mit Inbox-Token 401`, `POST /v1/inbox ohne Token 401`, `CORS-Vorabanfrage für GET /v1/inbox von Kcalms Herkunft erlaubt`, `config: Inbox-Token gleich Kcalm-Token → Startfehler`.
- [ ] **Step 2:** rot.
- [ ] **Step 3:** Je Weg eigenes `bearerAuth`; Body-Limit wie beim Push.
- [ ] **Step 4:** `npm test` grün, `npm run lint` (falls vorhanden) sauber.
- [ ] **Step 5:** Commit „Briefkasten: Wege /v1/inbox mit getrennten Tokens“.

---

## Teil B – Fitboard (Repo `C:\Users\Jan\Documents\Claude Projekte\fitboard`; dort `CLAUDE.md` beachten)

### Task B1: Schreibclient für den Briefkasten

**Files:**
- Create: `src/kcalm/inbox-writer.ts`
- Modify: `src/config.ts` (`kcalm.apiUrl` aus `KCALM_API_URL`, Standard `http://kcalm-api:3000`; `kcalm.inboxToken` aus `KCALM_INBOX_TOKEN`, `null` = nicht eingerichtet), `.env.example`
- Test: `test/kcalm-inbox-writer.test.ts`

**Interfaces:**
- Produces: `createInboxWriter(cfg: { apiUrl: string; token: string }, fetchFn = fetch): { add(items: { id: string; date: string; payload: EntryPayload }[]): Promise<{ added: number; ignored: number }>; withdraw(id: string): Promise<'withdrawn' | 'notFound' | 'notOpen'> }`; Fehler als `InputError` (400 mit Servertext) bzw. eigener Fehler „Kcalm-Server nicht erreichbar“. Timeout 10 s.

- [ ] **Step 1:** Tests mit gefälschtem `fetch`: richtiger Pfad und `Authorization`, 400 → `InputError` mit Servertext, Netzfehler → „Kcalm-Server nicht erreichbar“, 409 bei withdraw → `'notOpen'`.
- [ ] **Step 2:** rot. **Step 3:** implementieren. **Step 4:** grün.
- [ ] **Step 5:** Commit „Kcalm-Briefkasten: Schreibclient“.

### Task B2: Vorschläge über den Briefkasten statt `meal_suggestions`

**Files:**
- Modify: `src/meals.ts`, `src/kcalm/reader.ts` (`KCALM_VIEWS` + `{ view: 'inbox_view', key: 'id' }`), `src/mcp/write-tools.ts`, `src/mcp/server.ts` (`openMealSuggestions`), `src/db.ts` (Migration: `meal_suggestions` entfernen)
- Test: `test/meals.test.ts`, `test/write-tools.test.ts`, `test/kcalm-reader.test.ts`

**Interfaces:**
- Consumes: `createInboxWriter` (B1).
- Produces:
  - `suggestMeal(db, writer, input: { date: string; slot?: string|null; group?: string|null; items: MealItem[] }, now): Promise<MealSuggestion[]>` – `MealItem` = `{ ref?: { type: 'product'|'meal'|'recipe'; id: string } | null; name; amount?; unit?; kcal?; protein?; carbs?; sugar?; fat?; satFat?; fiber?; salt? }`. Mehr als ein Teil oder `group` gesetzt → eine Gruppe (`{ id: uuidv7(), name: group ?? erster Name }`) für alle Teile; ein Teil ohne `group` → Einzelvorschlag. `ref` muss in der Kcalm-Kopie existieren (`products`/`meals`/`recipes`), sonst `InputError`; `slot` wie bisher gegen Kcalm-Slots.
  - `listMealSuggestions(db, filter: { status?: 'open'|'accepted'|'rejected'|'withdrawn'|'expired' })` liest aus `kcalm_rows` (`inbox_view`, `kind = 'entry'`).
  - `withdrawMeal(db, writer, id, now)` über den Writer.
  - Ohne `inboxToken` melden die drei Werkzeuge „Vorschläge für Kcalm sind nicht eingerichtet (KCALM_INBOX_TOKEN fehlt)“.
- [ ] **Step 0:** Vor der Migration auf dem Pi prüfen, ob `meal_suggestions` Zeilen hat; Anzahl Jan nennen, bevor die Tabelle wegfällt.
- [ ] **Step 1: Failing tests** `Gruppe aus drei Teilen bekommt eine gemeinsame group.id`, `ein Teil ohne group ist Einzelvorschlag`, `unbekannter ref → InputError`, `freier Teil ohne kcal → InputError`, `null bleibt null im payload`, `satFat und salt kommen mit`, `ohne Token: nicht eingerichtet`, `listMealSuggestions liest Stand aus inbox_view`.
- [ ] **Step 2:** rot. **Step 3:** implementieren; Werkzeugbeschreibung von `fitboard_meal_suggest`: erst `fitboard_kcalm_foods` nachschlagen und verweisen, nur Unbekanntes schätzen; ein Foto bzw. eine Nachricht = ein Aufruf = eine Gruppe; Nachtragen bis 7 Tage zurück; zum Planen Restbudget aus `fitboard_days`. **Step 4:** grün.
- [ ] **Step 5:** Commit „Mahlzeiten-Vorschläge über den Kcalm-Briefkasten“.

### Task B3: Werkzeug `fitboard_kcalm_foods`

**Files:**
- Modify: `src/mcp/queries.ts` (Suche), `src/mcp/write-tools.ts` oder `server.ts` (Registrierung bei den Lesewerkzeugen)
- Test: `test/write-tools.test.ts` bzw. Lesewerkzeug-Tests

**Interfaces:**
- Produces: `fitboard_kcalm_foods({ query: string, limit?: number ≤ 20 })` → `{ items: { type: 'product'|'meal'|'recipe'; id; name; per100?: Nährwerte; unit?; portions? }[] }` aus der Kcalm-Kopie, Groß/Klein und Umlaute egal, archivierte ausgeschlossen.
- [ ] **Step 1:** Tests `findet Magerquark bei „magerquark“`, `Umlaut: „müsli“ findet „Müsli“`, `archiviert nicht dabei`, `Mahlzeit und Rezept mit type`.
- [ ] **Step 2–4:** rot → implementieren → grün.
- [ ] **Step 5:** Commit „Werkzeug fitboard_kcalm_foods“; Fitboard-Version und CHANGELOG nach Fitboards Regeln.

---

## Teil C – Kcalm (dieses Repo)

### Task C1: Datenmodell

**Files:**
- Modify: `src/db/types.ts` (`Entry.estimated: boolean`; neu `InboxDecision extends SyncFields { decision: 'accepted'|'rejected'; entryIds: string[] }`; neu `InboxItem` = Server-Item), `src/db/schema.ts` (`inboxDecisions: 'id, updatedAt'` in `SCHEMA_V1`; neu `SCHEMA_INBOX = { inbox: 'id, date' }`), `src/db/db.ts`, `src/db/versions.ts` (Version 8: `estimated = false` für alle Einträge), `src/logic/backup.ts` (`BACKUP_FORMAT_VERSION = 7`, Migration 6 → 7: `entries[].estimated = false`, `tables.inboxDecisions ??= []`; Zod: `estimated: z.boolean()`, Tabelle `inboxDecisions`), alle Stellen, die `NewEntryFields` bauen (`foodEntry`, `quickEntry`, `mealEntries`, Kopieren) setzen `estimated: false`
- Test: `src/db/versions.test.ts`, `src/logic/backup.test.ts`, `src/logic/push.test.ts`

**Interfaces:**
- Produces: `Entry.estimated`, Tabelle `db.inboxDecisions`, Tabelle `db.inbox` (lokal), `PUSH_TABLES` enthält `inboxDecisions` (automatisch über `TABLE_NAMES`), `inbox` nicht in Backup/Push.
- [ ] **Step 1: Failing tests** `Version 8 setzt estimated false`, `Backup Format 6 → 7: estimated false, inboxDecisions leer`, `Backup 7 mit inboxDecisions round-trip`, `PUSH_TABLES enthält inboxDecisions, nicht inbox`.
- [ ] **Step 2–4:** rot → implementieren → `npm test`, `npm run lint`, `npx tsc -b` grün.
- [ ] **Step 5:** Commit „Datenmodell: geschätzte Einträge, Briefkasten, Entscheidungen (DB 8, Backup 7)“.

### Task C2: Rechenlogik `src/logic/inbox.ts`

**Files:**
- Create: `src/logic/inbox.ts`, `src/logic/inbox.test.ts`

**Interfaces:**
- Consumes: `FoodChoice`, `foodEntry`, `NewEntryFields` (`addFood.ts`), `initialMealLines`/`mealEntries` (`meal.ts`), `FoodSources` (`db/entries.ts`), `createSearchIndex`/`search` (`search.ts`).
- Produces:
  - `parseInbox(json: unknown): InboxItem[]` – Hülle `{ ok: true, items }`; jedes Item einzeln mit Zod geprüft (gleiche Grenzen wie Server), ungültige fallen weg; unbekanntes `kind` fällt weg.
  - `visibleSuggestions(items: InboxItem[], decided: ReadonlySet<string>, today: LocalDate): InboxItem[]` – ohne entschiedene, ohne Datum < heute − 7.
  - `suggestionsForDay(items, date): SuggestionGroup[]` – `SuggestionGroup = { id: string; name: string | null; items: InboxItem[] }`, Einzelvorschlag = Gruppe mit `name: null` und einem Item; Reihenfolge nach `createdAt`.
  - `estimateChoice(item): FoodChoice | null` – nur wenn `amount > 0` und `unit` ∈ `g|ml`: per-100-Werte = Wert × 100 ÷ `amount`, `null` bleibt `null`; sonst `null`.
  - `resolvePart(item, sources: FoodSources, mealsById): ResolvedPart` mit `ResolvedPart = { kind: 'food'; choice: FoodChoice; amount: number; estimated: boolean } | { kind: 'meal'; lines: MealLine[] } | { kind: 'quick'; values: QuickValues; name: string } | { kind: 'missing' }` – `ref` gefunden → `food`/`meal` mit `estimated: false`; `ref` fehlt/unbekannt → `estimateChoice` → `food` mit `estimated: true`; sonst freie Werte ohne g/ml → `quick`; ohne kcal → `missing`.
  - `slotIdFor(slotName: string | null, slots: Slot[]): string | null` – exakter Name (ohne Groß/Klein), sonst `null`.
  - `suggestionEntries(parts: ResolvedPart[], date, slotId, group: { id: string; name: string } | null): NewEntryFields[]` – Gruppe → `mealGroupId = group.id`, `mealName = group.name`; Mahlzeit-Verweis in Gruppe → Bestandteile in dieselbe Gruppe; Einzel-Mahlzeit → eigene Gruppe wie beim normalen Eintragen; `estimated` aus dem Teil.
  - `bestMatch(name: string, index: SearchIndex<FoodChoice>): FoodChoice | null` – erster Treffer von `search(index, name, 1)` nur, wenn jedes Wort des Namens (nach `normalize`) als ganzes Wort im Treffernamen vorkommt.
  - `suggestionCountLabel(n: number): string` – „1 Vorschlag aus Fitboard“ / „3 Vorschläge aus Fitboard“.
- [ ] **Step 1: Failing tests** (je ein `it`): `parseInbox: kaputtes Item fällt weg, Rest bleibt`, `parseInbox: kcal null bleibt null`, `visibleSuggestions: entschiedene und abgelaufene fehlen`, `suggestionsForDay: Gruppe und Einzelvorschlag`, `estimateChoice: 450 g 610 kcal → 135,555… kcal/100 g, protein null bleibt null`, `estimateChoice: Stück → null`, `resolvePart: Verweis auf gelöschtes Produkt nutzt freie Werte (estimated true)`, `resolvePart: Verweis ohne Ersatzwerte → missing`, `resolvePart: Korrektur (Override) gilt beim Verweis`, `slotIdFor: umbenannter Slot → null`, `suggestionEntries: Gruppe setzt mealGroupId und mealName`, `suggestionEntries: Mahlzeit-Verweis in Gruppe wird aufgelöst`, `bestMatch: „Reis gekocht“ findet „Reis, gekocht“ (BLS)`, `bestMatch: „Pizza“ findet „Pizzateig“ nicht` (ganze Wörter nach `normalize`), `suggestionCountLabel 1/3`.
- [ ] **Step 2–4:** rot → implementieren → grün.
- [ ] **Step 5:** Commit „Rechenlogik Vorschläge aus Fitboard“.

### Task C3: Abholen, Speichern, Entscheiden

**Files:**
- Modify: `src/logic/push.ts` (`PushConfig.suggestions: boolean`, Zod mit `.default(false)`; `PushState.inboxLastSuccessAt`, `inboxLastError` mit Standard `null`; `inboxEndpoint(serverUrl)` = `${serverUrl}/v1/inbox`)
- Create: `src/db/inbox.ts`, `src/db/inbox.test.ts`, `src/app/inboxSync.ts`
- Modify: `src/main.tsx` bzw. Ort von `usePendingSyncTriggers` (Auslöser einhängen)

**Interfaces:**
- Consumes: `readyConfig`, `PushStorage`, `PushNet` (`db/push.ts`), `parseInbox` (C2).
- Produces:
  - `fetchInbox(storage: PushStorage, net: PushNet = defaultPushNet, now = new Date()): Promise<'off' | 'ok' | 'failed'>` – nur wenn `readyConfig` ok und `config.suggestions`; GET mit Bearer, Timeout wie Push; Erfolg ersetzt `db.inbox` komplett und setzt `inboxLastSuccessAt`; Fehler setzt `inboxLastError` (Texte wie `pushErrorMessage`), `db.inbox` bleibt.
  - `loadSuggestions(date: LocalDate, today: LocalDate): Promise<SuggestionGroup[]>` und `countSuggestions(date, today): Promise<number>` – über `visibleSuggestions` mit `db.inboxDecisions`.
  - `acceptSuggestions(entries: NewEntryFields[], acceptedIds: string[], rejectedIds: string[], now): Promise<void>` – eine Transaktion: `addEntries`, je id `inboxDecisions` (accepted mit `entryIds` bzw. rejected); bereits entschiedene ids → keine Einträge, kein Fehler.
  - `rejectSuggestions(ids: string[], now): Promise<void>`
  - `useInboxTriggers()` – Start, `online`, `visibilitychange` sichtbar (wie `usePendingSyncTriggers`).
- [ ] **Step 1: Failing tests** `fetchInbox ohne Schalter fragt nicht ab`, `fetchInbox Erfolg ersetzt inbox`, `fetchInbox Netzfehler behält inbox und setzt Fehler`, `alter gespeicherter PushConfig ohne suggestions → false`, `acceptSuggestions schreibt Einträge und Entscheidungen in einer Transaktion`, `zweites acceptSuggestions mit derselben id erzeugt keine Einträge`, `nach Backup-Import mit Entscheidung bleibt Vorschlag unsichtbar`.
- [ ] **Step 2–4:** rot → implementieren → grün.
- [ ] **Step 5:** Commit „Vorschläge abholen und entscheiden“.

### Task C4: Oberfläche

**Files:**
- Create: `src/screens/tagebuch/Suggestions.tsx` (`SuggestionsRow`, `SuggestionsSheet`)
- Modify: `src/screens/Tagebuch.tsx` (Zeile über den Slots wie `PendingScansRow`), `src/screens/add/AmountStep.tsx` (Einsatz für einen Teil: Rückgabe statt Speichern, Slotwahl, Angebot „Stattdessen … nehmen?“), `src/screens/tagebuch/EntryRow.tsx` (Hinweis „geschätzt“ in `muted`, `tiny`), `src/logic/addFood.ts` (`canEditAsFood`/`choiceFromEntry`: geschätzter Eintrag mit g/ml und `amount > 0` bearbeitbar wie ein Lebensmittel über `estimateChoice`), `src/screens/einstellungen/PushScreen.tsx` (Schalter „Vorschläge aus Fitboard“, nur aktiv mit eingerichtetem Push; Zeile „Vorschläge: zuletzt abgeholt …“ bzw. Fehler)

**Interfaces:**
- Consumes: C2, C3.
- Verhalten nach Spec (Abschnitt Kcalm): Gruppe mit Kopfzeile + „Alle übernehmen“ (fragt einmal nach dem Slot, wenn Teile keinen haben); Tipp auf Teil → Mengen-Schritt → zurück in die Gruppe; Wischen auf Teil = nimmt ihn heraus (rejected beim Übernehmen bzw. sofort, wenn die Gruppe danach leer ist); Wischen auf Kopfzeile = Gruppe ablehnen; Einzelvorschlag: Tipp → Mengen-Schritt → „Hinzufügen“, Wischen = ablehnen; `missing` zeigt „Lebensmittel nicht gefunden“ und ist nicht übernehmbar. Nach „Alle übernehmen“ Toast wie beim Eintragen. `prefers-reduced-motion` beachten.
- [ ] **Step 1:** Für neue Logik in Komponenten (falls vorhanden) zuerst Tests in `src/logic/`; UI-Code ohne Komponententests wie im Projekt üblich.
- [ ] **Step 2:** Implementieren.
- [ ] **Step 3:** `npm test`, `npm run lint`, `npm run build` grün.
- [ ] **Step 4:** Im Headless-Chrome bei 390 px (Hell/Dunkel) mit Test-Datenbank und gefälschtem Briefkasten prüfen: Zeile, Sheet, Gruppe übernehmen, Teil bearbeiten, Wischen, Slotfrage, „geschätzt“ im Tagebuch, Bearbeiten eines geschätzten Eintrags skaliert, Schalter im Push-Screen.
- [ ] **Step 5:** Commit „Vorschläge aus Fitboard im Tagebuch“.

### Task C5: Doku

**Files:**
- Modify: `CLAUDE.md` (Netzregel: „… Jans eigenen Server (Push und, wenn eingeschaltet, Lesen des Briefkastens) …“), `PLAN.md` (Phase 16: Aufteilung 16.1–16.4, offene Fragen als entschieden, Abschnitt 7 Eintrag „Vorschläge aus Fitboard“), `docs/iphone-test.md` (Teil H „Vorschläge aus Fitboard (2.1.0)“)
- [ ] **Step 1:** Ändern. **Step 2:** Commit „Doku Phase 16.1“.

---

## Teil D – Ausrollen

### Task D1: Ende-zu-Ende und Version 2.1.0 (jeder Push nur nach Jans OK)

- [x] **Step 1:** `kcalm-server`: Push; auf dem Pi `KCALM_INBOX_TOKEN` erzeugen (`openssl rand -base64 32`) in `~/kcalm-server/.env`, `git pull && docker compose up -d --build`; `GET /v1/health` gesund; `curl` ohne Token auf `/v1/inbox` → 401.
- [x] **Step 2:** Fitboard: denselben Token als `KCALM_INBOX_TOKEN` in Fitboards `.env`, deployen nach Fitboards Regeln; mit `fitboard_meal_suggest` einen Testvorschlag (morgen, Gruppe aus zwei Teilen) anlegen; `fitboard_meal_suggestions` zeigt `open`.
- [x] **Step 3:** Kcalm: Version 2.1.0 nach `CLAUDE.md` (CHANGELOG, Tag, Push, `npm run deploy`, `curl -I`, Release).
- [ ] **Step 4:** Jan: iPhone-Test Teil H (Schalter an, Vorschlag erscheint, Gruppe übernehmen, ablehnen, Flugmodus ohne Fehler im Tagebuch). Claude prüft danach auf dem Pi: `inbox.status` `accepted`/`rejected`, `fitboard_meal_suggestions` zeigt den Stand, Testeinträge auf Jans Wunsch löschen.
- [ ] **Step 5:** `PLAN.md` abhaken, Zwischenstand, Commit.
