# Phase 15 – Umzug zu Cloudflare (Design)

Stand 15.11.2026, mit Jan abgestimmt.

## Absicht

Kcalm zieht von `https://josepuerco.github.io/kcalm/` nach `https://kcalm.dunkleschokola.de/`. Grund (Jan): eigene Domain neben dem späteren Dashboard und dem Push-Server (`kcalm-api.dunkleschokola.de`). GitHub Pages fällt danach ganz weg.

## Ziele

- App läuft unter `https://kcalm.dunkleschokola.de/` (Wurzelpfad `/`), installierbar und offline wie bisher.
- Jeder Push auf `main` deployt dorthin, mit denselben Schutzregeln wie heute (Versions-Tag, Tests, Lint, Build).
- Jans Daten kommen per Backup vollständig in die neue App; Server-Push läuft danach von der neuen App aus.
- GitHub Pages ist am Ende abgeschaltet.

## Nicht-Ziele

- Keine Änderung an Funktionen, Datenmodell, Backup-Format oder Datenbank-Version.
- Kein automatischer Datenumzug zwischen den Ursprüngen (technisch nicht möglich: IndexedDB und `localStorage` gehören zum Ursprung).
- Keine Weiterleitung oder Hinweisseite auf der alten Adresse (einziger Nutzer ist Jan).
- Kein Cloudflare Access vor der App, kein Worker-Code (nur statische Dateien).

## Anti-Ziele

- Daten gehen beim Umzug verloren, oder der Pi-Server markiert Datensätze fälschlich als gelöscht.
- Ein Deploy geht raus, ohne dass Tag, Tests oder Lint geprüft wurden.
- Token oder Konto-Geheimnisse landen im öffentlichen Repo.

## Ansätze

| Ansatz | Abwägung |
| --- | --- |
| **A – Workers mit statischen Dateien, Deploy aus GitHub Actions (gewählt)** | GitHub Actions bleibt das Tor (Tag, Tests, Lint, Build), danach `wrangler deploy`. Von Cloudflare für neue Projekte empfohlen. Weicht wörtlich von „Cloudflare Pages“ im Plan ab. |
| B – Pages, Deploy aus GitHub Actions | Gleicher Ablauf, `wrangler pages deploy`. Wörtlich wie geplant, aber Pages bekommt kaum noch neue Funktionen. |
| C – Pages mit Git-Anbindung | Cloudflare baut selbst bei jedem Push, an Tag- und Testprüfung vorbei. Bricht „jeder Push = eine geprüfte Version“. Verworfen. |

Jan hat A gewählt (15.11.2026).

## Entscheidungen

### App
- `vite.config.ts`: `base = '/'`; damit werden Manifest `id`, `scope`, `start_url` und `navigateFallback` zu `/`.
- `index.html`: Pfade `/kcalm/…` (Favicon, Apple-Touch-Icon, Startbilder) auf `/…` bzw. über `%BASE_URL%`.
- Alle übrigen Stellen mit der alten Adresse anpassen: `CameraGuideSheet.tsx`, `docs/kamera-erlaubnis.md`, `docs/iphone-test.md`, `PLAN.md` (§1, §3), `CLAUDE.md` (Plattform-Regel und Deploy-Prüfung), Kommentar in `deploy.yml`.
- Kein Code in `src/logic/` betroffen; die Push-Logik bemerkt den neuen Ursprung als leere Quittungsliste und macht einen Vollabgleich (bestehendes Verhalten aus 14a/14d).

### Cloudflare
- Neue Datei `wrangler.jsonc`: Worker `kcalm`, nur `assets` mit `directory: ./dist`, `not_found_handling: "single-page-application"`, Route `kcalm.dunkleschokola.de` als `custom_domain: true` (Cloudflare legt DNS-Eintrag und Zertifikat selbst an). `workers_dev: false`, damit es keine zweite Adresse gibt.
- Ab dann gilt laut Jans globaler Regel für dieses Repo Wrangler statt `cf`.
- Wrangler kommt **nicht** in `package.json`: Deploy über die offizielle Action `cloudflare/wrangler-action` (feste Version), lokal bei Bedarf per `npx wrangler@<Version>`.
- Cache-Verhalten: Standard von Workers Assets (HTML und `sw.js` werden revalidiert); vor dem Abschluss mit `curl -I` prüfen, dass `sw.js` und `index.html` nicht lange gecacht werden.

### Deploy-Workflow
- Job `build` bleibt (Tag, `npm ci`, Test, Lint, Build), lädt `dist` als normales Artefakt hoch.
- Job `deploy` statt Pages: `wrangler-action` mit `apiToken` = Secret `CLOUDFLARE_API_TOKEN` und `accountId` = Secret `CLOUDFLARE_ACCOUNT_ID`.
- Pages-Rechte (`pages: write`, `id-token: write`) und Umgebung `github-pages` entfallen; `concurrency` bleibt.
- API-Token legt Jan im Cloudflare-Dashboard an, mit minimalen Rechten: Konto „Workers Scripts: Bearbeiten“, Zone `dunkleschokola.de` „Workers Routes: Bearbeiten“ (für die Custom Domain nötig; genaue Liste beim Umsetzen gegen die Cloudflare-Doku prüfen). Jan trägt Token und Konto-ID selbst per `gh secret set` ein.

### Pi-Server (`kcalm-server`)
- `ALLOWED_ORIGIN` in `~/kcalm-server/.env` auf dem Pi auf `https://kcalm.dunkleschokola.de` umstellen, Container neu starten.
- Nur **eine** erlaubte Domain, keine Übergangsphase mit zwei: So kann die alte App gar nicht mehr pushen, selbst wenn Push dort noch eingeschaltet ist (Schutz gegen zwei Absender).
- Standardwert im Code (`josepuerco.github.io`) im Server-Repo auf die neue Domain ändern, Tests anpassen.

### Reihenfolge des Umzugs
1. Code-Änderungen (App, `wrangler.jsonc`, Workflow, Texte) lokal, Tests/Lint/Build grün, im Headless-Chrome unter `/` geprüft.
2. Jan legt API-Token an und setzt die beiden Secrets.
3. Push als neue Version → erster Deploy auf Cloudflare. GitHub Pages bleibt dabei unverändert auf 1.5.0 stehen (der Workflow deployt nicht mehr dorthin), die alte App funktioniert weiter.
4. Prüfen von außen: Seite, Manifest, `sw.js`, Offline, Header.
5. Server-CORS auf neue Domain umstellen (ab jetzt kann die alte App nicht mehr pushen).
6. Jan auf dem iPhone, Checkliste: alte App → Push aus, Backup teilen → neue Adresse in Safari, Kamera erlauben, zum Home-Bildschirm → „Aus Backup laden“ → Push mit Adresse und Token einschalten → Vollabgleich, Anzahl Einträge iPhone = Pi → Theme, Profile, Gewichte stichprobenartig → alte App vom Home-Bildschirm löschen.
7. Erst danach GitHub Pages abschalten (`gh api -X DELETE repos/JosePuerco/kcalm/pages`, nach Jans OK) und Umgebung `github-pages` löschen.

### Version
- Vorschlag **2.0.0**: Laut `CHANGELOG.md` ist MAJOR „alte Daten werden nicht mehr automatisch übernommen“. Genau das passiert (Umzug per Backup von Hand). Alternative 1.6.0, wenn man nur auf Datenformat/Funktionen schaut.

## Für die Umsetzung offen
- Exakte `wrangler-action`- und Wrangler-Version (aktuell, mind. zwei Wochen alt).
- Genaue Token-Rechte gegen die Cloudflare-Doku prüfen.
- Ob `%BASE_URL%` in `index.html` oder feste `/`-Pfade (beides geht; Builder entscheidet, Hauptsache kein `/kcalm/` mehr).
