# Phase 16 – Vorschläge aus Fitboard (Design)

Stand 20.11.2026, mit Jan abgestimmt. Betrifft drei Repos: `kcalm`, `kcalm-server`, `fitboard`.

## Absicht

Jan will Essen eintragen, ohne alles in Kcalm zu tippen: per Foto, per Sprache oder kurz als Text in der Claude-App. Claude legt über Fitboards MCP-Werkzeuge **Vorschläge** ab; Kcalm holt sie ab, und Jan übernimmt oder lehnt ab. Nichts landet ohne Jans Tipp im Tagebuch. Kcalm bleibt maßgeblich und läuft ohne Server und ohne Fitboard wie bisher (Ausnahme ab 16.2: neue Gewichte kommen nur noch aus Garmin).

Anlässe (Jan): großes Rezept, Sprache, das Übliche („heute wie immer Magerquark“). Dazu von Claude vorgeschlagen und von Jan alle aufgenommen: Teller-Foto, Nährwerttabelle abfotografieren, Rezept als Foto/Screenshot, Kassenbon, Nachtragen, Planen, Gewicht von Garmin.

## Aufteilung (Jan, 20.11.2026)

Je Schritt eine eigene Kcalm-Version und ein iPhone-Test. Dieses Dokument beschreibt den Überblick und **16.1 im Detail**; 16.2–16.4 bekommen vor dem Start je ein eigenes kurzes Design.

| Schritt | Inhalt | Fälle |
| --- | --- | --- |
| **16.1 Fundament** | Briefkasten in `kcalm-server`, Abholen in Kcalm, Tagebuch-Vorschläge (Verweis oder freie Werte), Gruppen pro Foto/Nachricht, Übernehmen/Ablehnen | Teller-Foto, das Übliche, Sprache, Nachtragen, Planen |
| 16.2 Gewicht von Garmin | Fitboard liefert Garmin-Gewichte über den Briefkasten. Danach entfallen in Kcalm Kurzbefehl-Import **und** manuelles Eintragen ganz; Garmin ist die einzige Quelle (Jan: „Single Source of Truth“, manuell trägt er in Garmin ein) | Gewicht |
| ~~16.3 Neues anlegen~~ (gestrichen, Jan 21.11.2026) | Vorschläge für neue eigene Lebensmittel (Nährwerttabelle) und Rezepte (ein großes Rezept wird ein gespeichertes Kcalm-Rezept); öffnen die vorhandenen Formulare vorbefüllt | Nährwerttabelle, Rezept |
| 16.4 Preise | Preise vom Kassenbon als Vorschlag für vorhandene Lebensmittel | Kassenbon |

Nachtragen und Planen brauchen in Kcalm nichts Eigenes: Sie sind Tagebuch-Vorschläge mit anderem Datum. Die Arbeit liegt bei Claude/Fitboard (Werkzeugbeschreibungen, Restbudget liest Claude schon über `fitboard_days`).

## Ziele (16.1)

- Claude kann über Fitboard Tagebuch-Vorschläge ablegen: als **Verweis** auf etwas, das Kcalm schon kennt (eigenes oder OFF-Lebensmittel, Mahlzeit, Rezept) mit Menge und Slot, oder mit **freien Werten** (Name, Menge, Nährwerte, unbekannt = `null`).
- Vorschläge aus einem Foto bzw. einer Nachricht bilden eine **Gruppe** mit Namen.
- Kcalm zeigt Vorschläge am jeweiligen Tag, Jan bearbeitet einzelne Teile, übernimmt die ganze Gruppe oder lehnt ab.
- Jans Entscheidung kommt zu Fitboard zurück (Claude sieht, was übernommen wurde).
- Freie Werte bleiben im Tagebuch als „geschätzt“ erkennbar.

## Nicht-Ziele (16.1)

- Kein Abholen anderer Kcalm-Daten vom Server: Kcalm bleibt Hauptquelle, der Server Kopie. Gelesen wird nur der Briefkasten.
- Keine Gewichte, neuen Lebensmittel, Rezepte, Preise (16.2–16.4).
- Keine Fotos auf dem Server oder in Kcalm; nur die geschätzten Werte.
- Kein Bearbeiten bestehender Tagebucheinträge durch Claude.

## Anti-Ziele

- Ein Vorschlag landet ohne Jans Tipp im Tagebuch.
- Ein unbekannter Nährwert wird 0.
- Derselbe Vorschlag wird zweimal eingetragen (doppelt abgeholt, doppelt getippt, nach Backup-Import).
- Kcalm zeigt Fehler im Alltag, weil Server oder Fitboard nicht erreichbar sind.
- Fitboard wird ohne Cloudflare Access von außen erreichbar.
- Inhalte von Vorschlägen erscheinen in Logs.

## Ansätze (Weg der Vorschläge)

| Ansatz | Abwägung |
| --- | --- |
| A – `kcalm-server` reicht Anfragen an Fitboard weiter | Kcalm braucht nichts Neues, aber der Server muss Fitboard kennen und vermitteln. Verworfen zugunsten von D. |
| B – Kcalm fragt Fitboard direkt (eigene Adresse ohne Access) | Zweite Adresse und Token in Kcalm; ein Teil von Fitboard (Gesundheitsdaten) ohne Access im Netz. Verworfen. |
| C – Kcalm meldet sich per Access-Service-Token an | Access blockiert die CORS-Vorabanfrage des Browsers; wackelig. Verworfen. |
| **D – Wie Setlog: Fitboard schreibt in einen Briefkasten in `kcalm-server`, Kcalm holt ihn ab (gewählt)** | Fitboard bekommt einen eigenen Schreib-Token für `kcalm-server` (wie bei Setlog `fitboard-write`). Kcalm holt mit vorhandener Adresse und Token ab; Entscheidungen gehen mit dem normalen Push zurück. Server muss Fitboard nicht kennen; ist Fitboard aus, bleibt der Briefkasten leer. |

Jan hat D gewählt und das **Lesen vom eigenen Server freigegeben** (20.11.2026). Damit ändert sich die Regel in `CLAUDE.md` „Netzzugriff … Einweg-Push“: Kcalm liest zusätzlich den Briefkasten, nur wenn eingeschaltet.

## Entscheidungen

### Von Jan
- Alle acht Fälle in Phase 16, Aufteilung 16.1–16.4 wie oben.
- Weg D (Briefkasten in `kcalm-server`), Lesen freigegeben.
- Pro Foto/Nachricht eine Gruppe mit „Alle übernehmen“; einzelne Teile vorher bearbeitbar.
- Ab 16.2 kein Gewicht mehr in Kcalm außer aus Garmin (auch nicht manuell).
- Ein großes Rezept wird ein gespeichertes Kcalm-Rezept (16.3).

### `kcalm-server`: Briefkasten
- Neue Tabelle `inbox`: `id` (UUIDv7 von Fitboard), `kind` (16.1 nur `entry`; später `weight`, `product`, `recipe`, `price`), `payload` (JSON), `status` (`open` · `accepted` · `rejected` · `withdrawn` · `expired`), `created_at`, `updated_at`, `fetched_at`.
- `POST /v1/inbox` (Fitboard, eigener Token `KCALM_INBOX_TOKEN`, ≥ 32 Zeichen): legt Vorschläge an. Prüft Format mit Zod, Grenzen wie heute in Fitboards `meals.ts` (max. 20 Teile, Wertebereiche), Datum heute − 7 bis morgen (Europe/Berlin). Gleiche `id` zweimal = nichts Neues.
- `POST /v1/inbox/:id/withdraw` (Fitboard-Token): nur aus `open`.
- `GET /v1/inbox` (Kcalm-Token, CORS wie Push): alle `open` mit Datum ≥ heute − 7; setzt `fetched_at` beim ersten Ausliefern. Ältere `open` werden dabei `expired`.
- Kcalm-Token darf den Briefkasten nur lesen, Fitboard-Token nur schreiben/zurückziehen; keiner darf, was der andere darf.
- Entscheidungen kommen über den normalen Push (Tabelle `inboxDecisions`, unten). Beim Speichern eines Pushes setzt der Server `inbox.status` auf `accepted`/`rejected`.
- Logs nur Methode, Pfad, Status, Dauer (wie heute).
- Fitboard erreicht den Server intern unter `http://kcalm-api:3000` im Netz `cloudflare-tunnel`.

### Format eines Tagebuch-Vorschlags (`kind: entry`)
- `date`, `slot` (Kcalm-Slotname oder `null` → Jan wählt), `group` (`{ id, name }`: eine Gruppe je Werkzeugaufruf; ein einzelner Teil ohne Gruppe ist ein Einzelvorschlag).
- Entweder `ref` (`{ type: 'product' | 'meal' | 'recipe', id }`) mit `amount` und `unit` (bzw. Portionen bei Mahlzeiten) **oder** freie Werte: `name`, `amount`, `unit`, `kcal`, `protein`, `carbs`, `sugar`, `fat`, `satFat`, `fiber`, `salt` (alle Kcalm-Nährwerte; unbekannt = `null`, nie 0).
- Ein Verweis darf zusätzlich freie Werte mitbringen (Ersatz, falls Kcalm das Lebensmittel nicht mehr kennt).

### Kcalm
- **Einstellungen › Daten › Server-Push**: Schalter „Vorschläge aus Fitboard“, Standard aus, nur wählbar, wenn Push eingerichtet ist. Ohne Schalter kein einziger Abruf.
- **Abholen** wie bei den gemerkten Scans: still beim Start, wenn das Netz zurückkommt und beim Zurückkehren in die App. Fehler sieht Jan nur im Push-Screen (wie beim Push), nie im Tagebuch.
- Abgeholte Vorschläge liegen lokal in der Tabelle `inbox` (nicht im Push, nicht im Backup; nach einem Backup-Import werden sie neu abgeholt).
- Neue Tabelle `inboxDecisions` (sync-fähig, im Push und im Backup): `id` = Vorschlags-`id`, `decision` (`accepted` | `rejected`), `entryIds`. Sie verhindert Doppelte: Ein Vorschlag mit Entscheidung wird nie wieder angezeigt, auch nicht nach erneutem Abholen oder Backup-Import.
- **Tagebuch**: Zeile „✦ n Vorschläge aus Fitboard ›“ über den Slots, nur an Tagen mit offenen Vorschlägen (wie „2 gemerkte Scans“). Tipp öffnet ein Sheet mit den Vorschlägen des Tages:
  - Gruppe: Kopfzeile mit Name und „Alle übernehmen“, darunter die Teile. Tipp auf einen Teil → gewohnter Mengen-Schritt (Menge, Slot, bei freien Werten optional Treffer statt Schätzung), zurück in die Gruppe, noch nichts eingetragen. Wischen auf einem Teil nimmt ihn aus der Gruppe (gilt als abgelehnt), Wischen auf der Kopfzeile lehnt die Gruppe ab. „Alle übernehmen“ trägt alle verbliebenen Teile als Gruppe ein (`mealGroupId`, `mealName` = Gruppenname), wie eine Mahlzeit.
  - Einzelvorschlag: Tipp → Mengen-Schritt → „Hinzufügen“; Wischen lehnt ab.
- **Verweis**: Kcalm rechnet mit seinen aktuellen Werten (Korrekturen eingeschlossen), Snapshot wie beim Eintragen von Hand. Kennt Kcalm den Verweis nicht (gelöscht, archiviert, noch nicht gesynct), gelten die mitgeschickten freien Werte; ohne solche ist der Teil nicht übernehmbar und zeigt „Lebensmittel nicht gefunden“.
- **Freie Werte**: Kcalm sucht den Namen in eigenen Lebensmitteln und im BLS (vorhandene Suche) und bietet den besten Treffer an: „Stattdessen *Reis gekocht (BLS)* nehmen?“. Ohne Wahl wird ein Schnelleintrag mit Namen, Menge und den Werten.
- **„Geschätzt“**: Einträge aus freien Werten bekommen eine Markierung (neues Feld am Eintrag) und zeigen im Tagebuch klein „geschätzt“. Datenbank- und Backup-Formatversion steigen, Migration setzt bestehende Einträge auf „nicht geschätzt“.
- **Alte Vorschläge**: Datum älter als heute − 7 verschwindet aus der Anzeige (der Server setzt `expired`).
- Rechenlogik in `src/logic/` mit Tests: Format prüfen (Zod), Gruppieren, Verweis auflösen, Vorschlag → Einträge, Ablauf, Doppelte.

### Eigene Entscheidungen (Claude, beim Prüfen des Designs)
- **Menge ändern bei freien Werten**: Nährwerte skalieren linear mit der Menge (450 g → 300 g = ⅔ der Werte); `null` bleibt `null`. Menge und Einheit bleiben am Schnelleintrag gespeichert (heute dort `null`), damit sie im Tagebuch sichtbar und später genauso änderbar sind.
- **Slot fehlt bei „Alle übernehmen“**: Kcalm fragt einmal nach dem Slot für die ganze Gruppe; Teile mit eigenem Slot behalten ihn.
- **Verweis auf eine Kcalm-Mahlzeit innerhalb einer Gruppe**: Die Mahlzeit wird in ihre Bestandteile aufgelöst und gehört zur Gruppe (keine Gruppe in der Gruppe).
- **Geschätzte Einträge zählen** in Summen, Zielen und Statistik wie alle anderen; die Markierung ist nur ein Hinweis.
- **CORS**: Der Server erlaubt für `GET /v1/inbox` dieselbe einzige Herkunft wie für den Push.

### Fitboard
- `meal_suggestions` wird abgelöst: Die Werkzeuge schreiben in den Briefkasten von `kcalm-server` und lesen den Stand aus der Kcalm-Kopie (`kcalm.sqlite`, Tabelle `inbox`).
- `fitboard_meal_suggest` nimmt eine Gruppe (Name) mit Teilen, je Teil Verweis oder freie Werte (inkl. `satFat`, `salt`).
- Neues Werkzeug „Kcalm-Lebensmittel nachschlagen“: sucht in Kcalms Lebensmitteln, Mahlzeiten und Rezepten (aus der Kopie) nach Namen, mit Nährwerten und Portionen, damit Claude verweisen kann.
- `fitboard_meal_suggestions` zeigt Stand inkl. `accepted`/`rejected`/`expired`; `fitboard_meal_withdraw` ruft den Server.
- Werkzeugbeschreibungen erklären: erst nachschlagen und verweisen, nur bei Unbekanntem schätzen; ein Foto/eine Nachricht = eine Gruppe; Nachtragen bis 7 Tage zurück; Planen mit Restbudget aus `fitboard_days`.
- `KCALM_INBOX_TOKEN` in Fitboards `.env`; fehlt er, melden die Werkzeuge „nicht eingerichtet“.

### Reihenfolge und Versionen
1. `kcalm-server`: Briefkasten, Tests, Deploy auf dem Pi, Token anlegen.
2. Fitboard: Werkzeuge umstellen, Deploy.
3. Kcalm: Logik mit Tests, Speicher, Sheet, Einstellungen; Version **2.1.0** (neue Funktion, Migration).
4. Ende-zu-Ende: Claude legt Vorschläge an, Kcalm zeigt, Jan übernimmt, Fitboard sieht `accepted`. iPhone-Test mit eigener Checkliste.

## Dem Umsetzer überlassen
- Genaue Endpunkt- und Feldnamen, Zod-Schemata, Name des Markierungsfelds am Eintrag.
- Wie der Server-Push `inboxDecisions` auf `inbox.status` abbildet (im selben Paket, eine Transaktion).
- Bewertung des „besten Treffers“ bei freien Werten (vorhandene Suche nutzen; ohne guten Treffer kein Angebot).
- Umgang mit offenen Einträgen in Fitboards alter Tabelle `meal_suggestions` (vermutlich nur Tests; vor dem Ablösen prüfen und Jan nennen).
- Darstellung des Sheets nach `design/DESIGN.md` und Tokens; kein Prototyp vorhanden, Muster „gemerkte Scans“ und Mengen-Schritt.
