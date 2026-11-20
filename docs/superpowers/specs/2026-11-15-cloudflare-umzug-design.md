# Phase 15 – Umzug zu Cloudflare (Design)

Stand 15.11.2026, mit Jan abgestimmt. **Geändert am 20.11.2026 (Jan):** Hosting auf dem Pi wie Setlog (Ansatz D) statt Cloudflare Workers; Abschnitte „Ansätze“, „Hosting auf dem Pi“, „Deploy“ und „Reihenfolge“ entsprechend neu.

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
| A – Workers mit statischen Dateien, Deploy aus GitHub Actions | GitHub Actions bleibt das Tor (Tag, Tests, Lint, Build), danach `wrangler deploy`. Braucht API-Token und zwei Repo-Secrets. Am 15.11. gewählt, am 20.11. verworfen (zu umständlich, Sonderweg im Ökosystem). |
| B – Pages, Deploy aus GitHub Actions | Gleicher Ablauf, `wrangler pages deploy`. Pages bekommt kaum noch neue Funktionen. Verworfen. |
| C – Pages/Workers mit Git-Anbindung | Cloudflare baut selbst bei jedem Push; Tag-Prüfung fällt weg. Verworfen. |
| **D – Container auf dem Pi hinter dem Cloudflare-Tunnel, Deploy per Skript wie Setlog (gewählt)** | Gleicher Weg wie Setlog, Fitboard und kcalm-server. Keine Tokens, keine Secrets. Fällt der Pi aus, gehen nur Neuinstallation und Updates nicht; die installierte App läuft aus dem Cache weiter (offline-first). |

Jan hat D gewählt (20.11.2026).

## Entscheidungen

### App
- `vite.config.ts`: `base = '/'`; damit werden Manifest `id`, `scope`, `start_url` und `navigateFallback` zu `/`.
- `index.html`: Pfade `/kcalm/…` (Favicon, Apple-Touch-Icon, Startbilder) auf `/…` bzw. über `%BASE_URL%`.
- Alle übrigen Stellen mit der alten Adresse anpassen: `CameraGuideSheet.tsx`, `docs/kamera-erlaubnis.md`, `docs/iphone-test.md`, `PLAN.md` (§1, §3), `CLAUDE.md` (Plattform-Regel und Deploy-Prüfung), Kommentar in `deploy.yml`.
- Kein Code in `src/logic/` betroffen; die Push-Logik bemerkt den neuen Ursprung als leere Quittungsliste und macht einen Vollabgleich (bestehendes Verhalten aus 14a/14d).

### Hosting auf dem Pi
- Eigener Container `kcalm-web`, getrennt von `kcalm-api` (App und Server bleiben unabhängig). Im Docker-Netz `cloudflare-tunnel`, **ohne** `ports:`; erreichbar nur über den Tunnel.
- `Dockerfile` zweistufig, gebaut auf dem Pi: `node:24` (`npm ci`, `npm run build`) → `nginx:alpine` liefert nur `dist` aus.
- `deploy/nginx.conf`: unbekannte Pfade → `index.html` (Neu laden auf jeder Seite); `index.html`, `sw.js`, `manifest.webmanifest` mit `Cache-Control: no-cache`; `/assets/*` ein Jahr `immutable`; `.wasm` als `application/wasm`; Health-Check im Container.
- `compose.yaml` im kcalm-Repo; auf dem Pi unter `~/kcalm-web/src`.
- Tunnel-Route im Cloudflare-Dashboard (Jan, einmalig): `kcalm.dunkleschokola.de` → `http://kcalm-web:80`.
- `wrangler.jsonc` und `.github/workflows/deploy.yml` entfallen; ein Push auf GitHub deployt nichts mehr. Kein Test-Workflow auf GitHub (Jan, 20.11.2026): das Skript prüft vor jedem Deploy.
- Vor dem Abschluss mit `curl -I` prüfen, dass `sw.js` und `index.html` nicht gecacht werden (auch nicht von Cloudflare: `cf-cache-status`).

### Deploy
- `scripts/deploy.ts` nach dem Vorbild von Setlog, Aufruf `npm run deploy` (Node statt Bash, weil `bash` in PowerShell auf WSL zeigt, nicht auf Git Bash), Ziel `jan@pi.local` (überschreibbar per `PI_HOST`).
- Bricht ab, wenn: Änderungen nicht committet sind; Tag `v<Version>` nicht auf `HEAD` zeigt (hart, nicht nur Warnung); `HEAD` nicht in `origin/main` enthalten ist (was live läuft, steht auch auf GitHub).
- Dann `npm test` und `npm run lint` auf dem Laptop, `git archive HEAD` per SSH nach `~/kcalm-web/src`, `docker compose up -d --build`, warten bis der Container gesund ist (sonst Logs zeigen, Abbruch).
- Kein Backup nötig (der Container hat keine Daten).
- Zurückrollen: alten Tag auschecken, Skript erneut starten.
- Nach Jans OK: Claude pusht (Commit + Tag) und startet direkt danach das Skript.

### Pi-Server (`kcalm-server`)
- `ALLOWED_ORIGIN` in `~/kcalm-server/.env` auf dem Pi auf `https://kcalm.dunkleschokola.de` umstellen, Container neu starten.
- Nur **eine** erlaubte Domain, keine Übergangsphase mit zwei: So kann die alte App gar nicht mehr pushen, selbst wenn Push dort noch eingeschaltet ist (Schutz gegen zwei Absender).
- Standardwert im Code (`josepuerco.github.io`) im Server-Repo auf die neue Domain ändern, Tests anpassen.

### Reihenfolge des Umzugs
1. Code-Änderungen (App, Container, Skript, Texte) lokal, Tests/Lint/Build grün, im Headless-Chrome unter `/` geprüft.
2. Jan legt die Tunnel-Route `kcalm.dunkleschokola.de` → `http://kcalm-web:80` an.
3. Push als neue Version, dann `scripts/deploy.ts` (`npm run deploy`) → erster Deploy auf den Pi. GitHub Pages bleibt dabei unverändert auf 1.5.0 stehen (es gibt keinen Workflow mehr, der dorthin deployt), die alte App funktioniert weiter.
4. Prüfen von außen: Seite, Manifest, `sw.js`, Offline, Header.
5. Server-CORS auf neue Domain umstellen (ab jetzt kann die alte App nicht mehr pushen).
6. Jan auf dem iPhone, Checkliste: alte App → Push aus, Backup teilen → neue Adresse in Safari, Kamera erlauben, zum Home-Bildschirm → „Aus Backup laden“ → Push mit Adresse und Token einschalten → Vollabgleich, Anzahl Einträge iPhone = Pi → Theme, Profile, Gewichte stichprobenartig → alte App vom Home-Bildschirm löschen.
7. Erst danach GitHub Pages abschalten (`gh api -X DELETE repos/JosePuerco/kcalm/pages`, nach Jans OK) und Umgebung `github-pages` löschen.

### Version
- Vorschlag **2.0.0**: Laut `CHANGELOG.md` ist MAJOR „alte Daten werden nicht mehr automatisch übernommen“. Genau das passiert (Umzug per Backup von Hand). Alternative 1.6.0, wenn man nur auf Datenformat/Funktionen schaut.

## Für die Umsetzung offen
- Exakte Versionen der Images `node` und `nginx` (fest, nicht `latest`).
- Ob `%BASE_URL%` in `index.html` oder feste `/`-Pfade (erledigt in 15a).
