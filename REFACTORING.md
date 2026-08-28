# Refactoring-Analyse ESPConfig Designer

Stand: 1.3.3 (`6f01ed6`), Analysebranch `refactor/analyse`.
Grundlage: statische Durchsicht von `esp-config-designer/` (Backend), `esp-config-designer-frontend/` (Frontend), Build- und CI-Konfiguration.

Diese Datei ist ein Arbeitsdokument für den Umbau und gehört nicht in einen Upstream-PR.

---

## 1. Ist-Stand

### Backend (`esp-config-designer/`)

- Ein Flask-Modul `server.py`, 3835 Zeilen, ~50 Routen, ~120 Modulfunktionen, zwei Klassen (`Job`, `JobManager`).
- Kein App-Factory, kein Blueprint, kein Logging (0 `logging`-Aufrufe, 0 `print`), keine zentrale Fehlerbehandlung (`errorhandler`/`after_request` fehlen).
- Konfiguration ausschließlich über Modul-Level-`os.environ`-Reads plus `run.sh`, das die Umgebung aufbaut.
- Auslieferung: `run.sh` startet `python /server.py` → Werkzeug-Dev-Server, nicht threaded, in Produktion (Add-on und Standalone).
- Tests: `tests/` mit 3 `unittest`-Dateien (676 Zeilen), Import von `server.py` per `importlib`. Keine `pytest.ini`/`pyproject.toml`, keine CI-Ausführung, `tests/` ist per `.dockerignore` aus dem Image ausgeschlossen.
- Abhängigkeiten nur im Dockerfile gepinnt (`flask==3.1.2`, `pyserial==3.5`); kein `requirements.txt`. Standalone-Dockerfile installiert `pyserial` nicht.

### Frontend (`esp-config-designer-frontend/`)

- Vue 3 (`^3.4.21`) + Vite 8 (`^8.1.3`), Composition API, `<script setup>`, kein TypeScript, kein State-Management-Paket (State über Composables + `localStorage`).
- 35 700 Zeilen in `src/`. Größte Einheiten:

  | Datei | Zeilen |
  |---|---:|
  | `views/BuilderView.vue` | 6318 (Script-Setup-Block: ~5800) |
  | `views/DashboardView.vue` | 3093 |
  | `utils/schemaYaml.js` | 2997 |
  | `components/display/DisplayInspector.vue` | 2114 |
  | `components/import/YamlFileImportModal.vue` | 1323 |
  | `components/display/DisplayBuilder.vue` | 1306 |
  | `components/display/DisplayCanvas.vue` | 1247 |
  | `utils/yamlProjectImport.js` | 1222 |
  | `composables/useInstallConsoleFlow.js` | 1017 |

- Refactoring ist bereits begonnen: `BuilderView.vue` importiert 11 Builder-Teilkomponenten und 4 Composables; Kommentar im Code nennt die View „orchestration shell". Der Script-Block ist trotzdem ~5800 Zeilen.
- API-Zugriff nicht zentralisiert: 11 rohe `fetch(`-Aufrufe verteilt über `IconPicker.vue`, `useBuilderComponentCatalog.js`, `gpioData.js`, `schemaLoader.js`, `BuilderView.vue`, `DashboardView.vue`. URL-/Ingress-/Cookie-Logik mehrfach dupliziert (`getApiUrl`, `baseUrl`, `credentials: include`-Handling je Aufrufer).
- Kein ESLint, Prettier, EditorConfig, `tsconfig`/`jsconfig`, kein Test-Runner (Vitest o. Ä.), kein `engines`-Feld, kein `.nvmrc`.
- `package.json` referenziert `scripts/generate-action-definitions.js` (`npm run generate:actions`) — Verzeichnis `scripts/` existiert nicht im Repo (per `.gitignore` ausgeschlossen). Script ist ohne die ignorierte Quelle nicht lauffähig.

### Repo-Struktur / Daten

- Schema- und Katalogdaten liegen doppelt: `esp-config-designer-frontend/public/` (1140 Dateien, 4,2 MB) und `esp-config-designer/web/` (1187 Dateien, 5,3 MB). `web/` enthält zusätzlich den eingecheckten Frontend-Build (`web/assets/*-<hash>.js`).
- Sync erfolgt manuell (README „Deploy frontend into add-on": Build bauen, `dist/*` nach `web/` kopieren). Keine Automatisierung, kein Prüf-Check.
- CI: ein Workflow (`docker-standalone.yml`), baut nur das Standalone-Image. Kein Lint-, Test- oder Frontend-Build-Job. `.gitignore` schließt `.github/workflows/validate.yml` explizit aus.
- Bilder in `docs/screenshots/` existieren; README verweist zusätzlich auf nicht existierende `components_list/components_list.json`-Pfadangaben teils inkonsistent.
- Registry-Metadaten (`repository.yaml`, `config.json`, README-Install-Anleitung, Docker-Image-Namespace) zeigen auf `sokolsok/…`, das Repo liegt unter `hoffi-code/…`.

---

## 2. Befunde

Bewertung: **Auswirkung** (Wartbarkeit/Risiko) × **Aufwand** (S ≤ 0,5 d, M ≤ 2 d, L ≤ 1 Wo, XL > 1 Wo).

### Backend

| # | Befund | Auswirkung | Aufwand |
|---|---|---|---|
| B1 | `server.py` ist ein 3835-Zeilen-Monolith ohne Modulgrenzen. Routen, IO, Job-Orchestrierung, Katalog-Merge, mDNS/Ping, Asset-Handling in einer Datei. | hoch | L |
| B2 | Kein Logging. Fehlerdiagnose im Betrieb nur über ESPHome-Job-Logs möglich, nicht über den API-Server selbst. | hoch | S–M |
| B3 | Keine zentrale Fehlerbehandlung. 121 `jsonify(...)`-Stellen, ~40 `except Exception`-Blöcke mit uneinheitlichem Fehlerschema. `json_error()` existiert, wird aber nicht durchgängig genutzt. | mittel | M |
| B4 | Pro Route wiederholter `if request.method == "OPTIONS": return make_response("", 204)`-Block (30×). Gehört in `before_request`/`after_request` oder einen Decorator. | niedrig | S |
| B5 | Produktion läuft auf dem Werkzeug-Dev-Server (`app.run`), nicht threaded. SSE-Streaming (`/api/jobs/<id>/stream`) plus parallele Jobs plus reguläre Requests konkurrieren auf einem Worker. | mittel | S (Gunicorn/waitress + Threads) |
| B6 | Konfiguration als Modul-Level-Nebenwirkung (`X = os.environ.get(...)` beim Import). Tests müssen Modulattribute zur Laufzeit patchen (siehe `test_yaml_import.py` `setUp`). Erschwert Isolierung und Mehrfachinstanzen. | mittel | M |
| B7 | Kein `requirements.txt`/`pyproject.toml`; Laufzeit-Deps nur im Dockerfile. Standalone-Image installiert `pyserial` nicht — Host-Serial-Flashing dort vermutlich kaputt (`list_host_serial_ports` wirft „pyserial is not available"). Verifizieren. | mittel | S |
| B8 | `serve_ui` baut `os.path.join(web_root, path)` aus user-kontrolliertem `<path:path>`. `send_from_directory` schützt, die manuelle `os.path.isfile`-Prüfung davor nicht offensichtlich. Pfad-Traversal-Prüfung dokumentieren/absichern. | mittel | S |
| B9 | `tests/` per `.dockerignore` ausgeschlossen, aber nie in CI ausgeführt → toter Testcode, der schweigend veralten kann. | mittel | S |
| B10 | `datetime.utcnow()` (deprecated ab Python 3.12) in `utc_now()`. | niedrig | S |

### Frontend

| # | Befund | Auswirkung | Aufwand |
|---|---|---|---|
| F1 | `BuilderView.vue` mit ~5800 Zeilen Script-Setup bleibt der zentrale Engpass trotz begonnener Aufteilung. Preview-Erzeugung, Katalog-Flow, Schema-Laden, Validierung, Bus-Instanzen, Deployment-State, Asset-Flow, Display-Sync in einem Scope. | hoch | XL |
| F2 | Kein Linting/Formatierung. Kein automatisch erzwungener Stil → Stil driftet zwischen Dateien, Reviews diskutieren Formalien. | hoch | S (Setup) |
| F3 | Kein Test-Runner. `schemaYaml.js` (YAML-Emission, 2997 Z.), `yamlProjectImport.js`, `busInstances.js`, `schemaVisibility.js` sind reine Logik ohne UI und ohne einen einzigen Test. Hohes Regressionsrisiko bei jedem Schema-Umbau. | hoch | M (Setup + erste Suites) |
| F4 | API-Zugriff nicht gekapselt: 11 verteilte `fetch`-Aufrufe, dreifach reimplementierte Base-URL-/Ingress-/`credentials`-Logik. Kein einheitliches Fehler-/Timeout-/Retry-Verhalten. | mittel | M |
| F5 | `DashboardView.vue` (3093 Z.) und `DisplayInspector.vue` (2114 Z.) über der sinnvollen Grenze für eine Datei. | mittel | L |
| F6 | Kein `engines`/`.nvmrc`. Vite 8 braucht Node ≥ 20 — nirgends festgehalten. | niedrig | S |
| F7 | ~~`js-yaml: ^5.2.1` sei eine zurückgezogene Linie~~ — **Fehleinschätzung.** `js-yaml` hat die Mainline auf 5.x gehoben (`latest: 5.4.1`, dist-tags `v4-legacy`/`v3-legacy`), Maintainer `vitaly`, Repo `nodeca/js-yaml`. Der CHANGELOG-Sprung 1.3.1 war korrekt. Verwendete Exporte (`load`, `YAML11_SCHEMA`, `defineScalarTag`) in 5.2.1 vorhanden. Kein Handlungsbedarf; Versionspflege → dependabot (R4). | — | — |
| F8 | `npm run generate:actions` verweist auf nicht eingecheckten Code. Entweder Script ins Repo holen oder Target entfernen. | niedrig | S |
| F9 | Kein `<style>` in `BuilderView.vue`; Styling-Strategie (global `style.css` vs. scoped) ist uneinheitlich über die Komponenten. | niedrig | M |

### Repo / Prozess

| # | Befund | Auswirkung | Aufwand |
|---|---|---|---|
| R1 | Schema-/Katalogdaten doppelt gepflegt (`public/` ↔ `web/`), Sync manuell. Divergenz (1140 vs. 1187 Dateien) bereits sichtbar. | hoch | M–L |
| R2 | Frontend-Build (`web/assets/`) ist eingecheckt. Merge-Konflikte auf gehashten Bundles, unlesbare Diffs, Repo-Bloat. | mittel | M (Build in CI verlagern) |
| R3 | Keine CI für Lint/Test/Frontend-Build. Nur Docker-Image-Bau. | hoch | M |
| R4 | Kein `dependabot`/`renovate`, keine gepinnten Frontend-Deps außer über `package-lock.json`. | niedrig | S |
| R5 | Upstream-Referenzen (`sokolsok`) in `repository.yaml`, `config.json`, README, CI-Image-Name passen nicht zum Fork `hoffi-code`. Vor eigenem Release klären. | niedrig | S |
| R6 | `CONTRIBUTING.md`, Frontend-`README`, Architektur-Doku für Backend-Module fehlen. | niedrig | M |

---

## 3. Vorgeschlagene Reihenfolge

Prinzip: erst Sicherheitsnetz (Lint + Tests + CI), dann strukturelle Umbauten. Ohne Netz ist jeder Split am Monolithen ein Blindflug.

### Phase 0 — Sicherheitsnetz (Auswirkung hoch, Aufwand gering)

1. **F2** ESLint (`eslint-plugin-vue`) + Prettier + `.editorconfig`, `npm run lint`. Erstlauf nur prüfen, nicht auto-fixen.
2. **F3** Vitest einrichten. Erste Suites für `schemaYaml.js` (Emission), `busInstances.js`, `schemaVisibility.js` — die Logik mit dem höchsten Regressionsrisiko.
3. **B9/B1-Vorbereitung** `pyproject.toml` mit `pytest` + `ruff`, bestehende `unittest`-Tests unter pytest lauffähig machen (laufen unverändert).
4. **R3** CI-Workflow `checks.yml`: `lint` + `test` (Frontend), `ruff` + `pytest` (Backend), `npm run build` als Smoke.
5. **F6** `engines.node`, `.nvmrc`.

### Phase 1 — kleine, risikoarme Korrekturen

6. **F7** `js-yaml` prüfen und ggf. auf `^4.x` zurück (mit Test-Absicherung aus Phase 0).
7. **F8** `generate:actions`-Target klären.
8. **B10** `datetime.now(timezone.utc)` statt `utcnow()` — 2 Stellen (`server.py:143` `utc_now()`, `server.py:2764` `utcfromtimestamp`).
9. **B7** `requirements.txt` einführen, Standalone-Dockerfile-Deps angleichen, Serial-Feature im Standalone verifizieren.
10. **B4** OPTIONS-/CORS-Boilerplate in `after_request` bzw. Decorator zusammenziehen.
11. **R5** Fork-Metadaten auf `hoffi-code` umstellen (`repository.yaml`, `config.json`, README-Install-URL, CI-Image-Namespace, Dockerfile-`LABEL … source`).
12. **E1** `.gitattributes` mit `* text=auto eol=lf` (Repo hat keins; `git` meldet LF→CRLF beim Commit unter Windows).
13. **E2** `esp-config-designer-frontend/.npmrc` mit `registry=https://registry.npmjs.org/` (lokale Umgebung hat einen unvollständigen privaten Proxy; OSS-Fork soll gegen die öffentliche Registry bauen).

### Phase 2 — Backend-Struktur

14. **B2** `logging` einführen (strukturiert, Level über Env), `print`-freie Baseline halten.
15. **B6** App-Factory `create_app()`, Konfiguration in ein `Config`-Objekt, Tests auf Factory umstellen.
16. **B1** `server.py` in Blueprints/Module aufteilen entlang der bestehenden Routengruppen:
    `projects`, `yaml`, `assets`, `components` (Katalog/Import), `devices` (+ mDNS/Ping), `jobs` (+ `Job`/`JobManager`), `import`, `secrets`, `ui`. Reine Helfer nach `ecd/` (io, validation, esphome).
17. **B3** Einheitliches Fehlerschema über `errorhandler` + konsequente Nutzung von `json_error()`.
18. **B5** Produktions-WSGI-Server: `waitress` (pure-Python, keine C-Abhängigkeit, brauchbar mit SSE über genug Threads). `app.run` nur noch für lokal. `run.sh` ruft `waitress-serve`/`python -m waitress` statt `python /server.py`.

### Phase 3 — Frontend-Struktur

19. **F4** `utils/api.js`: eine `request()`-Funktion mit Base-URL-/Ingress-/`credentials`-Logik, einheitlicher Fehlerbehandlung. Alle 11 `fetch`-Stellen darüber führen.
20. **F1** `BuilderView.vue` weiter zerlegen: Preview-Pipeline, Deployment-State, Asset-Flow, Display-Sync je in ein Composable mit eigener Testabdeckung. Ziel: Script-Setup < 1500 Zeilen.
21. **F5** `DashboardView.vue`, `DisplayInspector.vue` analog entlang funktionaler Schnitte.
22. **F3-Ausbau** Testabdeckung für `yamlProjectImport.js`, `schemaLoader.js`, die neuen Composables.

### Phase 4 — Repo-Hygiene

23. **R1** Einzige Schema-Quelle festlegen (`frontend/public/`), `web/`-Kopie im CI-Build erzeugen statt einchecken. Übergangsweise Sync-Check als CI-Job.
24. **R2** Frontend-Build aus dem Repo nehmen, im Docker-Build bzw. CI erzeugen.
25. **R4** `dependabot.yml` (npm + pip + github-actions).
26. **R6** `CONTRIBUTING.md`, Backend-Modul-Doku, Frontend-`README`.

---

## 4. Entscheidungen

Getroffen (2026-08-28):

- **Scope**: Alle Phasen 0–4 werden durchgeplant und abgearbeitet.
- **R5 (Fork)**: Eigenständiges Produkt. `hoffi-code`-Namespace in allen Metadaten. Kein Zwang zur PR-Kompatibilität mit `sokolsok`.
- **B5 (WSGI)**: `waitress`.

Noch offen:

- **R1/R2**: Build im Docker-Multistage (Node-Stage → Python-Stage) oder CI-Artefakt, das ins Image kopiert wird? Betrifft `Dockerfile` und `Dockerfile.standalone`. Entscheidung spätestens zu Beginn Phase 4.
- **B1**: Blueprints im vorhandenen Layout (`COPY server.py` bleibt, wird zu `COPY ecd/`) oder installierbares `ecd`-Package mit eigenem `pyproject.toml`. Entscheidung zu Beginn Phase 2, sobald der Schnitt der Module steht.

## 5. Umgebungsnotizen (lokal)

- Aktives Node war `v10.24.1` (nvm-windows), umgestellt auf `v22.23.2`. Vite 8 braucht Node ≥ 20 → `.nvmrc`/`engines` (F6) macht das explizit.
- Globale `~/.npmrc` zeigt auf einen privaten Registry-Proxy (`npmregistry.le.eps:4873`), dem Pakete fehlen (`vue-router@4.6.4`). Lokaler Workaround: `npm install --registry https://registry.npmjs.org/`. Dauerhafte Lösung: Projekt-`.npmrc` (E2).
- Baseline vor Umbau grün: `npm run build` ok; `python -m pytest tests/` → 29 passed (identisch unter `unittest`).

## 6. Fortschritt

Branch `refactor/overhaul`.

### Phase 0 — erledigt

| Schritt | Ergebnis |
|---|---|
| F2 | `esp-config-designer-frontend/eslint.config.js` (flat, `vue/flat/essential` + `no-unused-vars` als Warnung). `npm run lint` / `lint:fix`. 3 echte Fehler behoben (`no-unsafe-finally` in `SchemaRenderer.vue`, `vue/valid-define-props` in `DashboardSearchField.vue`, `vue/no-mutating-props` in `DisplayBuilder.vue` bewusst per Kommentar unterdrückt — Shared-Model-Pattern). `no-useless-escape` bis zu den `schemaYaml`-Tests auf Warnung. Stand: 0 Fehler, 112 Warnungen. |
| F3 | Vitest 4. `npm test` / `test:watch`. Erste Suites: `busInstances.spec.js`, `schemaVisibility.spec.js`, `schemaYaml.spec.js` (`formatYamlValue`). 35 Tests grün. |
| B9 | `esp-config-designer/pyproject.toml` (`pytest`, `ruff` — `E/F/W/I`, `E501` bis zum Formatter-Lauf ignoriert). Bestehende `unittest`-Tests laufen unverändert unter `pytest` (29 grün). Import-Blöcke sortiert. |
| R3 | `.github/workflows/checks.yml` — Frontend (`lint`, `test`, `build`) + Backend (`ruff`, `pytest`). |
| F6 | `engines.node` (`^20.19.0 || >=22.12.0`), `esp-config-designer-frontend/.nvmrc` (`22`). |
| E1 | `.gitattributes` (`* text=auto eol=lf`, `*.sh eol=lf` — schützt `run.sh` gegen `core.autocrlf`). |
| E2 | `esp-config-designer-frontend/.npmrc` → öffentliche Registry. |
| — | `.editorconfig` im Repo-Root. |

Offen aus Phase 0 als Warnungen sichtbar, nicht blockierend: 112 ESLint-Warnungen (davon ~90 `no-useless-escape` in `schemaYaml.js`, Rest `no-unused-vars`); 52 `E501` in `server.py`.

### Phase 1 — erledigt

| Schritt | Ergebnis |
|---|---|
| F7 | Kein Change — Analyse-Annahme war falsch (js-yaml 5.x ist die aktuelle Mainline). Befund oben korrigiert. |
| F8 | `generate:actions` aus `package.json` entfernt; „Generators"-Abschnitt in `HOW_TO_CREATE_SCHEMA_EXTENDED.md` auf den tatsächlichen Stand gebracht (Definitionen werden direkt gepflegt, kein Generator im Repo). |
| B10 | `server.py`: `datetime.utcnow()` / `utcfromtimestamp()` → `datetime.now(timezone.utc)` / `fromtimestamp(..., timezone.utc)`. `replace(tzinfo=None)` erhält das `"<iso>Z"`-Format byte-genau. Inline-Duplikat bei `import_yaml_candidates` durch `timestamp_to_utc()` ersetzt. pytest jetzt ohne DeprecationWarnings. |
| B7 | `esp-config-designer/requirements.txt` (`flask==3.1.2`, `pyserial==3.5`) + `requirements-dev.txt` (`+pytest`, `ruff`). Beide Dockerfiles installieren via `-r requirements.txt` — `Dockerfile.standalone` bekommt damit `pyserial` (Venv ohne `--system-site-packages` sah die Base-Image-Version nicht → Host-Serial im Standalone war defekt). CI nutzt `requirements-dev.txt`. Container-Lauf lokal nicht verifiziert (kein Docker-Daemon), CI-Build `docker-standalone.yml` deckt das ab. |
| B4 | 30 × `if request.method == "OPTIONS": return make_response("", 204)` aus den Views entfernt, ein `@app.before_request handle_options_preflight` stattdessen. Verhalten geprüft: OPTIONS → 204 leer für alle Routen, normale Requests unverändert. −90/+7 Zeilen. |
| R5 | `sokolsok` → `hoffi-code` in `repository.yaml`, `README.md` (Add-on-Repo-URL), `docker/compose*.yaml`, `.github/workflows/docker-standalone.yml` (GHCR-Image), `Dockerfile.standalone` (OCI-`source`-Label). |
