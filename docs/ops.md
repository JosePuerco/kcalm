# Betrieb: Kcalm auf dem Pi

Kcalm läuft als Container `kcalm-web` auf dem Raspberry Pi, gleicher Weg wie Setlog. nginx liefert nur die gebaute App aus (keine Daten im Container; alle Daten bleiben auf dem iPhone). Erreichbar ist er ausschließlich über den Cloudflare-Tunnel unter `https://kcalm.dunkleschokola.de/`.

| Was | Wo |
| --- | --- |
| Container-Bauplan | `Dockerfile` (node baut, nginx liefert aus) |
| nginx-Einstellungen | `deploy/nginx.conf` |
| Container-Start | `compose.yaml` (Netz `cloudflare-tunnel`, **kein** `ports:`) |
| Auf dem Pi | `~/kcalm-web/src` (wird bei jedem Deploy ersetzt) |
| Tunnel-Route | Cloudflare-Dashboard: `kcalm.dunkleschokola.de` → `http://kcalm-web:80` |

Fällt der Pi aus, gehen nur Neuinstallation und Updates nicht. Die installierte App läuft aus dem Cache weiter.

## Deploy

Nach dem Versions-Commit, Tag und Push (Ablauf in `CLAUDE.md`):

```powershell
npm run deploy
```

Das Skript (`scripts/deploy.ts`) bricht ab, wenn

- es nicht committete Änderungen gibt (ausgeliefert wird nur `HEAD`),
- der Tag `v<Version>` nicht auf `HEAD` zeigt,
- `HEAD` nicht in `origin/main` enthalten ist (erst pushen),
- `npm test` oder `npm run lint` fehlschlägt.

Dann überträgt es `HEAD` per `git archive` und SSH nach `~/kcalm-web/src`, baut dort mit `docker compose up -d --build` und wartet, bis der Container gesund ist. Sonst zeigt es die letzten Logzeilen.

Anderes Ziel als `jan@pi.local`: `$env:PI_HOST = 'jan@<adresse>'; npm run deploy`.

Danach prüfen:

```powershell
curl.exe -I https://kcalm.dunkleschokola.de/
```

## Zurückrollen

```powershell
git checkout vX.Y.Z
npm run deploy
git checkout main
```

## Auf dem Pi nachsehen

```bash
ssh jan@pi.local
docker ps --filter name=kcalm-web
docker logs -f kcalm-web
```

## Caching

- `index.html`, `sw.js`, `registerSW.js`, Manifest, `bls.json`, Icons: `Cache-Control: no-cache` (Browser und Cloudflare fragen jedes Mal nach, Updates kommen sicher an).
- `/assets/*` (Hash im Namen): ein Jahr, `immutable`.
