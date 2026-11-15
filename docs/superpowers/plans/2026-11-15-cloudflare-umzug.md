# Phase 15 – Umzug zu Cloudflare – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kcalm läuft als Version 2.0.0 unter `https://kcalm.dunkleschokola.de/`, deployt aus GitHub Actions auf Cloudflare Workers (statische Dateien); GitHub Pages ist danach abgeschaltet.

**Architecture:** Die App bekommt den Wurzelpfad `/` statt `/kcalm/`. `wrangler.jsonc` beschreibt einen Worker ohne Code, nur mit `dist` als Assets und einer Custom Domain. Der Workflow behält Job `build` (Tag, Test, Lint, Build) und ersetzt den Pages-Deploy durch `cloudflare/wrangler-action`. Der Pi-Server erlaubt per CORS nur noch die neue Domain.

**Tech Stack:** Vite 7 + vite-plugin-pwa, GitHub Actions, Cloudflare Workers Static Assets (Wrangler), Hono-Server `kcalm-server` (Node 24, Docker auf dem Pi).

**Spec:** `docs/superpowers/specs/2026-11-15-cloudflare-umzug-design.md`

## Global Constraints

- Neue Adresse exakt `https://kcalm.dunkleschokola.de/`, Pfad `/`; keine Zeichenkette `/kcalm/` und kein `josepuerco.github.io` mehr in App, Build-Ausgabe oder Doku (außer historischen Einträgen in `CHANGELOG.md` und PLAN.md §8).
- Keine Änderung an Datenmodell, Backup-Format, Datenbank-Version, `src/logic/`.
- Wrangler nicht in `package.json`; Versionen von Actions und Wrangler fest und mind. zwei Wochen alt.
- Secrets nur `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID`, von Jan selbst gesetzt; nie im Repo oder in Ausgaben.
- `workers_dev: false` – nur eine Adresse.
- Server: genau eine erlaubte Origin `https://kcalm.dunkleschokola.de`, keine Übergangsliste.
- Version 2.0.0 (Jan, 15.11.2026). Push, Pi-Änderungen und Abschalten von Pages nur nach Jans ausdrücklichem OK.
- Oberfläche Deutsch, Du-Form; Befehle für PowerShell.

## Review Focus

1. **BLS-Suche offline unter `/`:** `bls.json` wird über `import.meta.env.BASE_URL` geladen; nach dem Wechsel muss sie im Flugmodus aus dem Precache kommen → Task 1 Schritt 4 prüft offline.
2. **Neu laden auf einem Unterpfad** (z. B. `/einstellungen`, falls Routen Pfade nutzen): darf keine 404 liefern → `not_found_handling: "single-page-application"`, Task 5 Schritt 5 prüft per `curl`.
3. **`sw.js`/`index.html` zu lange gecacht** → Updates kämen nicht an. Task 5 Schritt 5 prüft `Cache-Control`.
4. **Alte App sendet nach dem Umzug weiter an den Pi** → Server antwortet ohne CORS-Freigabe. Task 3 Test, Task 5 Schritt 7 von außen.
5. **Vollabgleich der neuen App markiert Datensätze fälschlich als gelöscht** → Task 5 Schritt 9: Anzahl Einträge iPhone = Pi und Anzahl Datensätze mit `deletedAt` vor/nach gleich.

---

### Task 1: App auf Wurzelpfad `/`

**Files:**
- Modify: `vite.config.ts:7-8` (Kommentar, `base = '/'`)
- Modify: `index.html:15-16,21,26` (`/kcalm/…` → `/…`)
- Modify: `src/screens/einstellungen/CameraGuideSheet.tsx:9` (`kcalm.dunkleschokola.de`)
- Modify: `docs/kamera-erlaubnis.md:11`

**Interfaces:**
- Produces: Build in `dist/` mit Manifest `id`/`scope`/`start_url` = `/`, `navigateFallback` = `/index.html`.

- [ ] **Step 1:** Änderungen oben vornehmen. Feste Pfade `/favicon.svg` usw. in `index.html` (einfacher als `%BASE_URL%`, Base ist jetzt `/`).
- [ ] **Step 2:** `npm test; npm run lint; npm run build` → alles grün.
- [ ] **Step 3:** Prüfen: `Select-String -Path dist\* -Pattern "/kcalm/" -List` → keine Treffer (Ausnahme: IndexedDB-Name `kcalm` taucht nicht mit Schrägstrichen auf). `Get-Content dist\manifest.webmanifest` → `"scope":"/"`, `"start_url":"/"`, `"id":"/"`.
- [ ] **Step 4:** `npm run preview` und im Headless-Chrome bei 390 px: App lädt unter `http://localhost:4173/`, Icons und Startbild-Links ohne 404, Service Worker aktiv; danach offline schalten, neu laden, BLS-Suche „Apfel“ liefert Treffer. Hell und Dunkel kurz ansehen.
- [ ] **Step 5:** Commit „App auf Wurzelpfad / für kcalm.dunkleschokola.de“.

### Task 2: Cloudflare-Konfiguration und Deploy-Workflow

**Files:**
- Create: `wrangler.jsonc`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `dist/` aus Task 1.
- Produces: Workflow-Job `deploy`, der die Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` erwartet.

- [ ] **Step 1:** Aktuelle Versionen ermitteln: `npm view wrangler time --json` (neueste Version, die mind. 14 Tage alt ist), `gh api repos/cloudflare/wrangler-action/releases --jq '.[0:5][] | [.tag_name,.published_at]'`, ebenso `actions/upload-artifact` und `actions/download-artifact`. Werte notieren.
- [ ] **Step 2:** `wrangler.jsonc` anlegen:
  ```jsonc
  {
    "name": "kcalm",
    "compatibility_date": "<Datum der Umsetzung>",
    "workers_dev": false,
    "routes": [{ "pattern": "kcalm.dunkleschokola.de", "custom_domain": true }],
    "assets": { "directory": "./dist", "not_found_handling": "single-page-application" }
  }
  ```
  Kommentare auf Deutsch, was jede Zeile bewirkt.
- [ ] **Step 3:** `deploy.yml` umbauen: Kopfkommentar auf neue Adresse; `permissions: contents: read` (Pages-Rechte raus); `concurrency.group: deploy`; in `build` statt `configure-pages`/`upload-pages-artifact` → `actions/upload-artifact` (Name `dist`, Pfad `dist`, `include-hidden-files: false`). Job `deploy`: `runs-on: ubuntu-24.04`, `needs: build`, `environment: { name: cloudflare, url: https://kcalm.dunkleschokola.de }`, Schritte `actions/checkout` (für `wrangler.jsonc`), `actions/download-artifact` nach `dist`, `cloudflare/wrangler-action@<Version>` mit `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `wranglerVersion: <Version>`, `command: deploy`.
- [ ] **Step 4:** Lokal Trockenlauf: `npx --yes wrangler@<Version> deploy --dry-run` → meldet Assets aus `./dist` ohne Fehler, lädt nichts hoch.
- [ ] **Step 5:** Commit „Deploy auf Cloudflare Workers statt GitHub Pages“.

### Task 3: Pi-Server erlaubt nur die neue Domain (Repo `kcalm-server`)

**Files (in `C:\Users\Jan\Documents\Claude Projekte\kcalm-server`):**
- Modify: `src/config.ts:19` (Standard `https://kcalm.dunkleschokola.de`)
- Modify: `.env.example:5`
- Modify: `test/helpers.ts:6`, `test/config.test.ts:14,27`, `test/app.test.ts:69-71`

- [ ] **Step 1:** Tests zuerst anpassen: `ORIGIN = 'https://kcalm.dunkleschokola.de'`; Config-Test erwartet diesen Standard; „Pfad in Origin wirft“ mit `https://kcalm.dunkleschokola.de/kcalm/`; Test „andere Seite bekommt keine Freigabe“ mit `https://kcalm.dunkleschokola.de.boese.example`. Neuer Test `'alte Adresse josepuerco.github.io bekommt keine Freigabe'`: Push mit `Origin: https://josepuerco.github.io` → Header `access-control-allow-origin` fehlt.
- [ ] **Step 2:** `npm test` → Config-Standard-Test schlägt fehl.
- [ ] **Step 3:** `src/config.ts` und `.env.example` ändern.
- [ ] **Step 4:** `npm test` → alle grün.
- [ ] **Step 5:** Commit im Server-Repo „CORS: nur noch kcalm.dunkleschokola.de“. **Nicht** pushen und nicht auf den Pi bringen (kommt in Task 5).

### Task 4: Doku und Regeln

**Files:**
- Modify: `PLAN.md` §1 Adresse, §3 „Entwicklung und Hosting“ (Zeilen ~190–196), Zeile 387 (wird zur Phase), neuer Abschnitt „Phase 15 – Umzug zu Cloudflare (Version 2.0.0)“ mit Punkten 15a–15e (= Tasks 1–3 und Rollout-Schritte), Zeile in §7 „Hosting: Workers statt Pages“ mit Begründung (Jan, 15.11.2026)
- Modify: `CLAUDE.md` Plattform-Regel (`/kcalm/` → Custom Domain, Wrangler-Konfig) und Deploy-Prüfung (Workflow-Ergebnis + `curl -I https://kcalm.dunkleschokola.de/`)
- Modify: `docs/iphone-test.md` Zeile 38 neue Adresse; neuer Teil „Umzug“ mit der Checkliste aus Spec „Reihenfolge“ Schritt 6

- [ ] **Step 1:** Änderungen vornehmen.
- [ ] **Step 2:** `Select-String -Path *.md,docs\*.md,src\**\*.tsx -Pattern "github.io|/kcalm/"` → nur noch historische Stellen (CHANGELOG, PLAN §8, §6 Phase 0).
- [ ] **Step 3:** Commit „Doku: Umzug zu kcalm.dunkleschokola.de“.

### Task 5: Rollout (mit Jan, Schritt für Schritt)

- [ ] **Step 1 (Jan):** Im Cloudflare-Dashboard API-Token „Edit Cloudflare Workers“-Vorlage, eingeschränkt auf Jans Konto und Zone `dunkleschokola.de`. Dann `gh secret set CLOUDFLARE_API_TOKEN -R JosePuerco/kcalm` und `gh secret set CLOUDFLARE_ACCOUNT_ID -R JosePuerco/kcalm` (Eingabe verdeckt). Ich prüfe nur `gh secret list` → beide Namen da.
- [ ] **Step 2:** Version nach CLAUDE.md: `npm version 2.0.0 --no-git-tag-version`; `CHANGELOG.md` Abschnitt `## 2.0.0 – TT.MM.JJJJ` (neue Adresse, Umzug per Backup, Push neu einrichten, alte Adresse wird abgeschaltet); Commit „Version 2.0.0“, Tag `v2.0.0`.
- [ ] **Step 3 (nach Jans OK):** `git push --atomic origin main v2.0.0`; `gh run watch` → beide Jobs grün.
- [ ] **Step 4:** Alte Adresse unverändert: `curl -sI https://josepuerco.github.io/kcalm/` → 200.
- [ ] **Step 5:** Neue Adresse: `curl -sI https://kcalm.dunkleschokola.de/` → 200; `…/sw.js` und `…/index.html` → `Cache-Control` ohne langes `max-age`; `…/manifest.webmanifest` → `scope "/"`; `…/irgendwas` → 200 mit `index.html`. Headless-Chrome: App lädt, offline neu laden geht.
- [ ] **Step 6 (nach Jans OK):** Server-Repo pushen; auf dem Pi `ALLOWED_ORIGIN=https://kcalm.dunkleschokola.de` in `~/kcalm-server/.env` setzen (Token-Zeile nicht ausgeben), `git pull && docker compose up -d --build`. Vorher Anzahl Datensätze mit `deletedAt` notieren.
- [ ] **Step 7:** Von außen: Vorabanfrage mit `Origin: https://kcalm.dunkleschokola.de` → Freigabe; mit `Origin: https://josepuerco.github.io` → keine.
- [ ] **Step 8 (Jan, iPhone):** Teil „Umzug“ aus `docs/iphone-test.md` abarbeiten.
- [ ] **Step 9:** Anzahl Einträge iPhone = Pi; Anzahl `deletedAt` unverändert gegenüber Step 6.
- [ ] **Step 10 (nach Jans OK):** `gh api -X DELETE repos/JosePuerco/kcalm/pages`, Umgebung `github-pages` löschen; `curl -sI https://josepuerco.github.io/kcalm/` → 404.
- [ ] **Step 11:** `gh release create v2.0.0`, PLAN.md Phase 15 abhaken, §8 Zwischenstand, Commit.
