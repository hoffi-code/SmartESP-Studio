# Refactoring-Analyse SmartESP Studio

Stand: 1.3.3 (`6f01ed6`), Analysebranch `refactor/analyse`.
Grundlage: statische Durchsicht von `smartesp-studio/` (Backend), `smartesp-studio-frontend/` (Frontend), Build- und CI-Konfiguration.

Diese Datei ist ein Arbeitsdokument für den Umbau und gehört nicht in einen Upstream-PR.

---

## 1. Ist-Stand

### Backend (`smartesp-studio/`)

- Ein Flask-Modul `server.py`, 3835 Zeilen, ~50 Routen, ~120 Modulfunktionen, zwei Klassen (`Job`, `JobManager`).
- Kein App-Factory, kein Blueprint, kein Logging (0 `logging`-Aufrufe, 0 `print`), keine zentrale Fehlerbehandlung (`errorhandler`/`after_request` fehlen).
- Konfiguration ausschließlich über Modul-Level-`os.environ`-Reads plus `run.sh`, das die Umgebung aufbaut.
- Auslieferung: `run.sh` startet `python /server.py` → Werkzeug-Dev-Server, nicht threaded, in Produktion (Add-on und Standalone).
- Tests: `tests/` mit 3 `unittest`-Dateien (676 Zeilen), Import von `server.py` per `importlib`. Keine `pytest.ini`/`pyproject.toml`, keine CI-Ausführung, `tests/` ist per `.dockerignore` aus dem Image ausgeschlossen.
- Abhängigkeiten nur im Dockerfile gepinnt (`flask==3.1.2`, `pyserial==3.5`); kein `requirements.txt`. Standalone-Dockerfile installiert `pyserial` nicht.

### Frontend (`smartesp-studio-frontend/`)

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

- Schema- und Katalogdaten liegen doppelt: `smartesp-studio-frontend/public/` (1140 Dateien, 4,2 MB) und `smartesp-studio/web/` (1187 Dateien, 5,3 MB). `web/` enthält zusätzlich den eingecheckten Frontend-Build (`web/assets/*-<hash>.js`).
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
13. **E2** `smartesp-studio-frontend/.npmrc` mit `registry=https://registry.npmjs.org/` (lokale Umgebung hat einen unvollständigen privaten Proxy; OSS-Fork soll gegen die öffentliche Registry bauen).

### Phase 2 — Backend-Struktur

14. **B2** `logging` einführen (strukturiert, Level über Env), `print`-freie Baseline halten.
15. **B6** App-Factory `create_app()`, Konfiguration in ein `Config`-Objekt, Tests auf Factory umstellen.
16. **B1** `server.py` in Blueprints/Module aufteilen entlang der bestehenden Routengruppen:
    `projects`, `yaml`, `assets`, `components` (Katalog/Import), `devices` (+ mDNS/Ping), `jobs` (+ `Job`/`JobManager`), `import`, `secrets`, `ui`. Reine Helfer nach `ecd/` (io, validation, esphome).
17. **B3** Einheitliches Fehlerschema über `errorhandler` + konsequente Nutzung von `json_error()`.
18. **B5** Produktions-WSGI-Server: `waitress` (pure-Python, keine C-Abhängigkeit, brauchbar mit SSE über genug Threads). `app.run` nur noch als lokaler Fallback. Umsetzung: `__main__` wählt waitress selbst, `run.sh` bleibt bei `python /server.py`.

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
| F2 | `smartesp-studio-frontend/eslint.config.js` (flat, `vue/flat/essential` + `no-unused-vars` als Warnung). `npm run lint` / `lint:fix`. 3 echte Fehler behoben (`no-unsafe-finally` in `SchemaRenderer.vue`, `vue/valid-define-props` in `DashboardSearchField.vue`, `vue/no-mutating-props` in `DisplayBuilder.vue` bewusst per Kommentar unterdrückt — Shared-Model-Pattern). `no-useless-escape` bis zu den `schemaYaml`-Tests auf Warnung. Stand: 0 Fehler, 112 Warnungen. |
| F3 | Vitest 4. `npm test` / `test:watch`. Erste Suites: `busInstances.spec.js`, `schemaVisibility.spec.js`, `schemaYaml.spec.js` (`formatYamlValue`). 35 Tests grün. |
| B9 | `smartesp-studio/pyproject.toml` (`pytest`, `ruff` — `E/F/W/I`, `E501` bis zum Formatter-Lauf ignoriert). Bestehende `unittest`-Tests laufen unverändert unter `pytest` (29 grün). Import-Blöcke sortiert. |
| R3 | `.github/workflows/checks.yml` — Frontend (`lint`, `test`, `build`) + Backend (`ruff`, `pytest`). |
| F6 | `engines.node` (`^20.19.0 || >=22.12.0`), `smartesp-studio-frontend/.nvmrc` (`22`). |
| E1 | `.gitattributes` (`* text=auto eol=lf`, `*.sh eol=lf` — schützt `run.sh` gegen `core.autocrlf`). |
| E2 | `smartesp-studio-frontend/.npmrc` → öffentliche Registry. |
| — | `.editorconfig` im Repo-Root. |

Offen aus Phase 0 als Warnungen sichtbar, nicht blockierend: 112 ESLint-Warnungen (davon ~90 `no-useless-escape` in `schemaYaml.js`, Rest `no-unused-vars`); 52 `E501` in `server.py`.

### Phase 1 — erledigt

| Schritt | Ergebnis |
|---|---|
| F7 | Kein Change — Analyse-Annahme war falsch (js-yaml 5.x ist die aktuelle Mainline). Befund oben korrigiert. |
| F8 | `generate:actions` aus `package.json` entfernt; „Generators"-Abschnitt in `HOW_TO_CREATE_SCHEMA_EXTENDED.md` auf den tatsächlichen Stand gebracht (Definitionen werden direkt gepflegt, kein Generator im Repo). |
| B10 | `server.py`: `datetime.utcnow()` / `utcfromtimestamp()` → `datetime.now(timezone.utc)` / `fromtimestamp(..., timezone.utc)`. `replace(tzinfo=None)` erhält das `"<iso>Z"`-Format byte-genau. Inline-Duplikat bei `import_yaml_candidates` durch `timestamp_to_utc()` ersetzt. pytest jetzt ohne DeprecationWarnings. |
| B7 | `smartesp-studio/requirements.txt` (`flask==3.1.2`, `pyserial==3.5`) + `requirements-dev.txt` (`+pytest`, `ruff`). Beide Dockerfiles installieren via `-r requirements.txt` — `Dockerfile.standalone` bekommt damit `pyserial` (Venv ohne `--system-site-packages` sah die Base-Image-Version nicht → Host-Serial im Standalone war defekt). CI nutzt `requirements-dev.txt`. Container-Lauf lokal nicht verifiziert (kein Docker-Daemon), CI-Build `docker-standalone.yml` deckt das ab. |
| B4 | 30 × `if request.method == "OPTIONS": return make_response("", 204)` aus den Views entfernt, ein `@app.before_request handle_options_preflight` stattdessen. Verhalten geprüft: OPTIONS → 204 leer für alle Routen, normale Requests unverändert. −90/+7 Zeilen. |
| R5 | `sokolsok` → `hoffi-code` in `repository.yaml`, `README.md` (Add-on-Repo-URL), `docker/compose*.yaml`, `.github/workflows/docker-standalone.yml` (GHCR-Image), `Dockerfile.standalone` (OCI-`source`-Label). |

### Phase 2 — teilweise erledigt

| Schritt | Ergebnis |
|---|---|
| B2 | `logging.basicConfig` (Level über `SES_LOG_LEVEL`), Modul-Logger `log = getLogger("ecd")`. `JobManager._worker` fängt jetzt Exceptions aus `_run_job`: Job wird als `failed` markiert und geloggt, der Worker-Thread lebt weiter (vorher: eine unerwartete Exception legte die komplette Job-Queue still). Startlog in `__main__`. |
| B3 | `handle_http_exception` / `handle_unexpected_exception` — jede nicht abgefangene Exception → `{status, message}` als JSON 500, Traceback ins Log, kein Stack zum Client. `HTTPException` → JSON mit passendem Code. Unbekannte `/api/...`-Routen → JSON 404. Geprüft per Smoke-Test. |
| B5 | `waitress==3.0.2` in `requirements.txt`. `__main__` startet `waitress.serve(app, threads=SES_THREADS|8)`, Fallback auf `app.run` wenn waitress fehlt (lokal). `run.sh` bleibt bei `python /server.py` — ein Entrypoint, Dev/Prod-Parität. |
| B6 | `create_app() -> Flask`. Routen als `Blueprint("ecd")` (43 `@app.route` + 2 `@app.before_request` umgestellt), Error-Handler über `register_error_handler`. Modul-Level `app = create_app()` bleibt für die bestehenden Tests. Zweite unabhängige Instanz per Smoke-Test verifiziert. |
| **B1** | **Angefangen.** Fundament steht: `tests/test_smoke.py` (16 Endpunkte, 1 pro Routengruppe), `ecd/`-Paket mit `config.py` / `logging.py` / `errors.py`, Dockerfiles kopieren `ecd`. `server.py` von ~3830 auf ~3700 Z. Der Route-/Helfer-Split steht noch aus — siehe unten. |

#### B1 — Stand und nächster Schritt

**Erledigt:**

- `tests/test_smoke.py` — je ein erreichbarer Endpunkt pro künftigem Blueprint. Bricht ein Import beim Verschieben, wird die Gruppe 404/500 und der Test rot.
- `ecd/config.py` (Env/Pfade/Regex/Locks/`is_truthy`), `ecd/logging.py` (`basicConfig` + `log` + `get_logger`), `ecd/errors.py` (`json_error` + die zwei Handler). `server.py` importiert daraus.
- `server.py` behält `from ses.config import <NAME>` als Namen im eigenen Namespace → die bestehenden Tests patchen weiter `server.TARGET_DIR` usw. **ohne Änderung**. Das gilt nur, solange der lesende Code in `server.py` bleibt.
- `Dockerfile` + `Dockerfile.standalone`: `COPY ecd /ecd`.

**Nächster Schritt (der eigentliche Split):**

1. In `server.py` alle Config-Lesezugriffe von `NAME` auf `config.NAME` umstellen (`from ecd import config`), ~250 Stellen, wortgrenzensicher. Danach gibt es **einen** Patch-Punkt: `ecd.config`.
2. Die drei Testdateien von `server.<NAME>` auf `ecd.config.<NAME>` umstellen; Helfer-Referenzen (`server.Job`, `server.is_allowed_serial_port`, `server.normalize_component_entry` …) auf die neuen Module zeigen lassen.
3. Dann je ein Route-Modul + zugehörige Helfer nach `ecd/routes/` bzw. `ecd/esphome.py`, `ecd/catalog.py`, `ecd/devices.py`, `ecd/assets.py`, `ecd/io.py` — einzeln, jeweils `pytest` grün.
4. `job_manager = JobManager()` und `bootstrap_storage()` bleiben in `server.py`/`create_app()` (Reihenfolge: erst `bootstrap_storage`, dann `JobManager()`), damit sich das Startverhalten nicht ändert.

Zielstruktur:

```
smartesp-studio/
  server.py                 # from ecd import create_app; app = create_app()
  ecd/
    __init__.py             # create_app(): Blueprints + Error-Handler
    config.py logging.py errors.py     [erledigt]
    io.py                   # read/write_json(_atomic), write_text_file_atomic, seed_*
    esphome.py              # Job, JobManager, run_esphome, Serial-Port-Helfer
    devices.py              # MDNSProbe, ping_host, evaluate_device_connectivity, Registry
    catalog.py              # Komponenten-Katalog: normalize/merge/import-zip, custom components
    assets.py               # Asset-Index, Manifest, Upload/Rename/Delete
    routes/
      health.py projects.py yaml.py assets.py components.py
      devices.py jobs.py import_.py secrets.py ui.py
```

Zielstruktur:

```
smartesp-studio/
  server.py                 # nur noch: from ecd import create_app; app = create_app()
  ecd/
    __init__.py             # create_app(): Blueprints + Error-Handler registrieren
    config.py               # SES_*, *_DIR, ASSET_*, VALID_* Regex, is_truthy, normalize_*
    logging.py              # basicConfig + get_logger
    errors.py               # handle_http_exception, handle_unexpected_exception, json_error
    io.py                   # read/write_json(_atomic), write_text_file_atomic, seed_*
    esphome.py              # Job, JobManager, run_esphome, Serial-Port-Helfer
    devices.py              # MDNSProbe, ping_host, evaluate_device_connectivity, Registry
    catalog.py              # Komponenten-Katalog: normalize/merge/import-zip, custom components
    assets.py               # Asset-Index, Manifest, Upload/Rename/Delete
    routes/
      health.py  runtime.py  projects.py  yaml.py  assets.py
      components.py  devices.py  jobs.py  import_.py  secrets.py  ui.py
```

Blocker und Vorgehen: siehe „B1 — Stand und nächster Schritt" oben.

### Phase 3 — teilweise erledigt

| Schritt | Ergebnis |
|---|---|
| F4 | `src/utils/api.js` — `apiUrl` / `apiFetch` / `unwrapJson` / `apiJson`. Das dreifach kopierte `new URL("./", window.location.href)` + `credentials: "include"` liegt jetzt an **einer** Stelle. `BuilderView.vue` (`buildAddonUrl`/`addonFetch`) und `DashboardView.vue` (`getApiUrl`) delegieren, Aufrufstellen unverändert. `unwrapJson` wandelt non-2xx in einen `Error` mit `{status, message, payload}`. Getestet (`api.spec.js`). Statische Asset-Loader (`schemaLoader.js`, `gpioData.js`) und CDN-Fetches (`IconPicker.vue`) bleiben außen vor — kein Ingress/Credentials-Bezug. |
| F3-Ausbau | Neue Vitest-Suites: `schemaModeLevel`, `schemaTemplatable`, `schemaAuto` (Slug/SSID-Ableitung, `!secret`-Erkennung, Passwort-Generierung/-Validierung). Gesamt 76 Frontend-Tests (vorher 39). |
| **F1** | **Abgeschlossen** (6293 → 3904 Z.). |
| **F5** | **In Arbeit.** `DashboardView.vue` (3093 → 2592 Z.), `DisplayInspector.vue` (2114 Z.) zerlegen. Siehe unten. |

#### F1 / F5 — Vorgehen

Wie B1: erst Netz, dann schneiden. Es gab **keine** Komponententests, und die App lässt sich lokal nicht real starten (braucht Backend + HA-Ingress). Ein Blind-Split am 5800-Zeilen-`<script setup>` wäre zu riskant.

1. ✅ `@vue/test-utils` + `jsdom` als devDeps. `vitest.config.js` lädt jetzt `@vitejs/plugin-vue`; `*.spec.js` bleibt `node`, `*.spec.dom.js`/`*.spec.vue.js` opt-in per `// @vitest-environment jsdom`-Docblock (`environmentMatchGlobs` existiert in Vitest 4 nicht mehr — Docblock ist der offizielle Ersatz). Verifiziert mit einer Charakterisierungssuite für `BuilderComponentRequirementsNotice.vue`.
2. Charakterisierungstests für die stabilen Teilkomponenten, die schon existieren (`BuilderCoreTab`, `SchemaField`, `BuilderComponentPicker` …) — Rendern + Kern-Interaktionen. **Noch offen**, wird bei Bedarf vor der jeweiligen Extraktion nachgezogen statt pauschal vorab.
3. ✅ **Seam #1 — Validation-Regeln:** `buildValueRegistry`, `buildIdIndex`, `buildDuplicateErrors`, `buildIdRefErrors`, `buildDisplayElementIdErrors`, `buildValidationErrors`, `buildGpioUsageIndex` + die Predicates `isArrayLikeSchemaField`/`isObjectArrayLikeField` (letztere blieben in `BuilderView.vue` an 4 weiteren Stellen gebraucht, jetzt aus dem Modul importiert statt lokal dupliziert) nach `src/utils/builderValidationRules.js`. `useBuilderValidation.js` importiert die Funktionen jetzt direkt statt sie als Parameter zu bekommen. `buildGpioUsageIndex` bekam einen expliziten `componentIdFromEntry`-Parameter (Default = bisheriges Inline-Verhalten), weil `componentIdFromEntry` selbst ein Allzweck-Helfer bleibt, der weit außerhalb der Validierungs-Region in `BuilderView.vue` gebraucht wird und nicht mitgezogen wurde. 24 neue Vitest-Fälle (`builderValidationRules.spec.js`). Script-Setup 5783 → ~5000 Z. (roher Zeilenabzug: 6293 → 5512 Z. Gesamtdatei).
4. ✅ **Seam #2 — YAML-Preview-Pipeline:** `yamlPreviewDocument`, `yamlPreview`, `previewTabs` (+ intern `yamlBlocks`, `previewGroups`, `coreBlockKeys`, `bussesBlockKeys`, `customPreviewBlock(Keys)`, `humanizePreviewKey`, die Line-Builder `pushPreviewLine`/`appendPreviewLines`/`makePreviewOrigin`/`makeSourceContext`/`sectionOrigin`/`filterConfigBySchema`/`shouldEmitEmptyBlock`) nach `src/composables/builder/useBuilderYamlPreview.js`. Größte und am stärksten vernetzte Extraktion bisher — die Fabrikfunktion nimmt ~30 benannte Parameter entgegen (Schema-/Config-Refs aus allen Tabs, Katalog-Listen wie `protocolDefinitions`/`bussesDefinitions`/`automationDefinitions`, Helferfunktionen wie `resolveBusEnabled`/`getBusInstances`/`componentIdFromEntry`/`parseComponentId`, plus 6 statische Scope-Id-Strings), da `BuilderView.vue` genau diese Menge an Tab-/Schema-Zustand in die Preview einspeist. Rückgabe bewusst schmal (nur `yamlPreviewDocument`/`yamlPreview`/`previewTabs` — alles andere hat außerhalb der Pipeline keine Verwender, per Grep verifiziert). Nebenbei toter Code entsorgt, der zufällig im extrahierten Bereich lag (textbasiertes `parseYamlBlocks`, `appendTextLines`, `documentLineTexts` — 0 Aufrufer, war schon vor der Extraktion tot). 6 neue Charakterisierungstests (`useBuilderYamlPreview.spec.js`) mit kleinen Referenz-Configs (esphome-Core, esp32-Plattform, WLAN+OTA, Multi-Instance-Bus, Leerfall) — ersetzen die im Plan vorgesehenen Snapshot-Tests, da die komplette `BuilderView.vue` lokal nicht startbar ist. `BuilderView.vue`: 5512 → 4626 Z., `lint`-Warnzahl 112 → 109 (drei durch den toten Code).
5. ✅ **Seam #3 — Deployment/Device-Status:** `useBuilderDeployment.js` — Registry-Handshake (register/promote/unregister eines Device-Keys gegen Yaml+Host), Status-Polling (12s-Intervall, pausiert via Page-Visibility), der `projects-updated`-BroadcastChannel (+ `localStorage`-Signal + Fenster-Event) und die abgeleiteten Capability-Computeds (`canUseOtaInstall`, `canLogsForCurrentDevice`, `builderDeviceStatusLabel/-Class`). Kniffligste Extraktion bisher, weil es echte Netzwerk-Seiteneffekte + eine **zirkuläre** Abhängigkeit zu `useInstallConsoleFlow` gibt: `startDeviceStatusPolling` braucht `compileIsActive` (kommt aus `installFlow`, das selbst erst NACH diesem Composable erzeugt wird, weil sein `onInstallSuccess` eine Funktion *aus* `useBuilderDeployment` aufruft). Gelöst über einen spät gebundenen `getCompileIsActive: () => compileIsActive.value`-Getter — funktioniert, weil der Closure erst beim tatsächlichen Poll-Tick ausgewertet wird, zu dem Zeitpunkt existiert `compileIsActive` längst (gleiches Callback-Wrapper-Muster wie bei `useBuilderComponentCatalog`). Beide `watch(projectFilename)`/`watch(savedDeviceHost)`-Watcher wanderten mit ins Composable (rein deployment-intern). `initialize()`/`dispose()` bündeln Channel-Init, Visibility-Listener und Polling-Start/-Stop für `onMounted`/`onBeforeUnmount`. 5 neue Tests (`useBuilderDeployment.spec.dom.js`, jsdom, gemockter `addonFetch`) prüfen Status-Refresh, OTA-Install-Registrierung, No-op bei irrelevanter Install-Action, Listener-Lifecycle. `BuilderView.vue`: 4626 → 4180 Z.
6. ✅ **Seam #4 — Projekt-Persistenz:** `useBuilderProjectPersistence.js` — Backend-Roundtrip fürs Speichern (`save`/`projects/save`/`projects/load` für `projects.json`) + Projekt-Bundle-Rename. **Bewusste Abweichung vom Plan:** `normalizeConfig`/`loadConfig` (AE) blieben in `BuilderView.vue` — die hängen an `activeModeLevel`/`splitPreviewEnabled`/`resolveModeLevel` (UI-Bootstrap: Mode-Level, Split-Preview) und laden aus `localStorage`, nicht vom Backend. Ein eigenständiges Anliegen (Session-Hydration), keine Projekt-Persistenz im Sinne dieser Extraktion. `sanitizeProjectJsonFilename` wird auch von `loadConfig` gebraucht → aus dem Composable exportiert statt dupliziert. 5 neue Tests (`useBuilderProjectPersistence.spec.js`, gemockter `addonFetch`): kompletter Save-Durchlauf inkl. Rename, Kurzschluss bei „schon gespeichert" bzw. „Save läuft bereits", Fehlerpfad. `BuilderView.vue`: 4180 → 3904 Z.
7. ✅ **Doppelter Deep-Watch konsolidiert:** `useBuilderComponentCatalog.js` hatte einen eigenen `watch(config, {deep:true}) → saveConfig()` neben dem in `BuilderView.vue` — beide feuerten bei jeder Config-Änderung; im Fall „gespeichertes Projekt wird editiert" rief das zweimal `saveConfig()` auf. Der `useBuilderComponentCatalog`-Watcher hatte aber eine andere Aufgabe als der BuilderView-Watcher: unconditional Autosave nach localStorage (läuft immer, auch für ein noch nie gespeichertes Projekt) vs. conditional Dirty-Flag (`isSaved=false`, nur wenn ein bereits gespeichertes Projekt vom persistierten Fingerprint abweicht). Zusammengeführt in einem Watcher in `BuilderView.vue`: Dirty-Flag-Logik inline (statt über `markProjectDirty()`, das selbst nochmal `saveConfig()` aufruft) + genau ein `saveConfig()`-Aufruf danach. `saveConfig`-Parameter aus `useBuilderComponentCatalog` entfernt (war nur für den jetzt gelöschten Watcher da).

**F1 damit komplett.** `BuilderView.vue`: 6293 → 3904 Z. (−38 %). `npm run lint`/`test`/`build` nach jedem Schritt grün, kein einziger neuer Lint-Fehler über alle vier Seams.

#### F5 — DashboardView.vue / DisplayInspector.vue

8. ✅ **DashboardView Seam #1 — YAML-Import-Flow:** `useDashboardYamlImport.js` — beide Import-Wege (lokale .yaml-Datei per Picker, ESPHome-Config-Verzeichnis per Kandidatenliste) münden in denselben Analyse-dann-Bestätigen-Modal-Flow (`importYamlToProjectConfig`). `openYamlFilePicker`/`openBuilderYamlImportModal` wurden aus dem Rückgabewert entfernt (waren nur intern über `handleTopbarImportOption` gebraucht, kein externer Aufrufer mehr in `DashboardView.vue`). 9 neue Tests (`useDashboardYamlImport.spec.dom.js`, jsdom wegen `FileReader`/`File`). `DashboardView.vue`: 3093 → 2778 Z.
9. ✅ **DashboardView Seam #2 — Tile-Customization:** `useDashboardTileCustomization.js` — Icon/Farb-Overrides je Projekt lesen, im Draft bearbeiten, auf `ui.dashboardTile` im Projekt-JSON zurückschreiben. `DEFAULT_TILE_*`-Konstanten blieben in `DashboardView.vue` (auch von `resolveTileCustomization` außerhalb dieser Extraktion gebraucht) und wandern als Parameter rein statt dupliziert zu werden. `customizeProjectName`/`customizeColorTarget`/`openCustomizeModal` mussten nicht zurück nach `DashboardView.vue` destructured werden — extern wird nur `requestCustomizeProjectFromMenu` (liest das Ziel-Projekt aus dem offenen Kontextmenü) gebraucht. 7 neue Tests (`useDashboardTileCustomization.spec.js`, echtes `normalizeHexColor` importiert, Rest als treue Kurz-Reimplementierung der DashboardView-lokalen Helfer). `DashboardView.vue`: 2778 → 2592 Z. (gesamt 3093 → 2592, −16 %).
10. **Offen:** `DisplayInspector.vue` (2114 Z.) Element-Typ-Split (Shape/Icon, Text/Image/Animation, Graph/GraphLegend) + neue Composables `useDisplayFontControls`/`useDisplayImageField`/`useGraphTraces`/`useElementPatch`. Anders als bisher: Split der **Template**-Struktur in Kind-Komponenten, nicht nur Script-Extraktion — neue Art von Risiko (Props/Emits/Slots statt nur JS-Closures).

---

## 7. Rebranding + Betrieb (nach Phase 3, vor dem ersten Push)

Auf Wunsch vorgezogen, bevor die Refactoring-Phasen weiterlaufen. Alles auf `refactor/overhaul`, nichts gepusht.

### Rename → SmartESP Studio

| Bereich | Änderung |
|---|---|
| Name | `ESPConfig Designer` → `SmartESP Studio` überall (README, `config.json` name/slug `smartesp-studio`/panel_title/description, `repository.yaml`, `index.html`-Title, App.vue, Docs, Dockerfile-Labels, Log-Zeilen) |
| Repo | `ESPConfig-Designer` → `SmartESP-Studio`, alle Links auf `github.com/hoffi-code/SmartESP-Studio` |
| Verzeichnisse | `esp-config-designer/` → `smartesp-studio/`, `esp-config-designer-frontend/` → `smartesp-studio-frontend/`, Python-Paket `ecd/` → `ses/` (CI-Pfade, Dockerfiles, `.gitignore` nachgezogen) |
| Env + Code | `ECD_*` → `SES_*` (Env-Strings **und** Python-Identifier), Blueprint-/Logger-Name `"ses"`, `SES_LOG_LEVEL`, `SES_THREADS` |
| Storage | `/config/ecd` → `/config/smartesp`, `/config/.ecd` → `/config/.smartesp`, `independent_ecd` → `independent_smartesp` — **Breaking** für Bestandsinstallationen, im `CHANGELOG.md` als solches markiert |
| Header-Links | YouTube + PayPal raus; übrig GitHub + Buy me a coffee (`buymeacoffee.com/smartcodestudio`) |
| Logo/Favicon | `public/smartesp-logo.png` + `smartesp-studio/logo.png` = geliefertes SmartESP-Studio-Logo (zugeschnittene Fassung, 1958×469); Header-CSS `height: 30px`. Favicon von „VEB"-SVG auf markeneigenes `</>`-Chip-SVG. `index.html` `lang="pl"` → `"en"`. |
| Version | `1.3.3` → `0.1.0` (`package.json` + `config.json`), SemVer-Abschnitt in `CLAUDE.md`, `0.1.0`-Eintrag im `CHANGELOG.md` |
| `icon.png` | **offen** — 863×863 quadratisch, geliefertes Logo ist Querformat; braucht eigene quadratische Variante |

### Component-Paywall entfernt

`componentPickerNotices` (Store-Upsell „Get Pack" → `store.smartsolutions4home.com`), `catalogHasUnavailableComponents`, `hasUnavailableCatalogComponents`, `componentsAvailableOnly` (Toggle „Available only"), `visibleCategories`-Filter, zugehörige Props/Emits, `.components-picker-notice*`/`.components-available-filter*`-CSS. `isComponentAvailable` behält nur die `root_map`-Konfliktprüfung (echte Regel, keine Paywall). −232 Zeilen. Ausgelieferter Katalog hatte ohnehin 0 `available:false` — Feld `"available": true` steht noch 552× drin, wird nicht mehr gelesen (mit R1 aufräumen).

### Docker verifiziert

- `docker build --check` beide Dockerfiles: keine Warnungen. `docker compose config` alle 3 Compose-Dateien: valide.
- Standalone-Image baut (`smartesp-studio:local`, ~1,47 GB), Container läuft `Up (healthy)`, waitress statt Dev-Server, `SES_*`/`/config/smartesp`/`version 0.1.0` korrekt.
- **Fix:** Container war `(unhealthy)` — esphome-Base-Image bringt einen HEALTHCHECK auf `:6052` (Dashboard) mit. `HEALTHCHECK` auf `/api/health` in beide Dockerfiles ergänzt.
- Sichtprüfung (Dashboard + Builder) im Browser ok: Branding, Links, Paywall weg.

### UI-Retheme auf die Logo-Palette

`style.css` `:root` hat jetzt Brand-Tokens (`--brand-navy/-blue/-cyan/-green/-amber`, `--brand-gradient`) + semantische Tokens (`--navy`, `--accent` = Teal `#0e7c8a`, `--accent-strong`, `--accent-line`, `--border`, `--ok`). Sweep der Periwinkle-Akzentfarben (`#6190d6`/`#6791d4`/…) → Tokens über `style.css` + 19 Scoped-Component-Styles. Signature: 2px-Verlaufslinie (`navy→blue→cyan→green`) unter der Topbar (`.builder-hero::after`). Body-Hintergrund von Indigo-Radial auf kühles Neutral. Fokus-Ring → Teal. Status-Farben (Rot/Grün/Amber) unangetastet. Typografie unverändert (Space Grotesk).

Sweep-Bug behoben: 5 Stellen hatten `var(--…)`-Strings in **JS-Farbwerte** geschrieben (Canvas-`fillStyle`, Color-Picker-Swatches, Tile-Default) — auf Hex zurückgesetzt (`ColorPickerModal`, `DashboardModalHost`, `YamlBuilderImportModal`, `DisplayCanvas`, `DashboardView`).

---

## 8. Aktueller Stand (Save-Punkt)

- **Branch:** `refactor/overhaul`, ~45 Commits über `main` (Tag `6f01ed6` = Upstream 1.3.3), **nichts gepusht**.
- **Checks grün:** Frontend `npm run lint` (0 Fehler / 112 Warnungen), `npm test` (76), `npm run build`. Backend `ruff check` (sauber), `pytest` (32 + 16 subtests).
- **Lokaler Container:** `smartesp-studio-test`, Image `smartesp-studio:local`, neu gebaut nach dem
  Route-Split. Gate B1 (curl-Sweep aller Endpunkt-Gruppen + ein realer `validate`-Job-Durchlauf gegen
  eine im Container geschriebene Test-YAML: submit → queued → success, Tail-Log lesbar) bestanden.
- **`CLAUDE.md`** im Repo-Root ist weiterhin **untracked** (bewusst) — Rollen-Prompt + „Schreibstil" + „Versionierung".
- **Gesamtplan mit Meilenstein-/Commit-Tabelle:** `plans/nimm-in-die-planung-swirling-pike.md`.

### B1 — abgeschlossen

`server.py`: **3747 → 24 Z.**, jetzt nur noch `from ses import config, create_app` + `app = create_app()`
+ `__main__` (waitress). Erledigt: `ses/io.py`, `ses/serial_ports.py`, `ses/catalog.py`,
`ses/assets.py`, `ses/projects.py`, `ses/devices.py`, `ses/auth.py`, `ses/esphome.py`,
`ses/routes/{health,components,assets,yaml_files,imports,secrets,projects,devices,jobs,ui}.py`
extrahiert; **Config-Namespace vereinheitlicht** — Code liest ausschließlich `config.NAME`, alle 4
Testdateien patchen `ses.config.<NAME>` (einziger Patch-Punkt). Jeder Schritt einzeln committet,
`ruff`+`pytest` durchgehend grün.

**Route-Split (letzter Commit):** `ses/routes/*.py` — ein Blueprint je Funktionsgruppe, `ses/__init__.py`
hat jetzt `bootstrap_storage()` + `create_app()`: erzeugt die Flask-App, hängt `JobManager()` als
`app.extensions["job_manager"]` ein (Job-Routen lesen ihn über `current_app.extensions["job_manager"]`
statt eines Modul-Globals — läuft pro App-Instanz sauber isoliert, kein geteilter Zustand zwischen
mehreren `create_app()`-Aufrufen/Testdateien), registriert die 10 Blueprints, die beiden
`before_request`-Hooks (OPTIONS-Preflight, Standalone-Basic-Auth) jetzt app-weit statt
blueprint-gebunden, sowie die Error-Handler. `find_firmware_path` (nur von `/api/firmware` gebraucht)
liegt direkt in `ses/routes/jobs.py`, nicht in `ses/devices.py` — Bezug ist Firmware/Job, nicht
Geräte-Registry (Abweichung von der Plan-Notiz, die es bei `ses/devices` gelistet hatte).

**Test-Migration einfacher als geplant:** `test_yaml_import.py`/`test_smoke.py`/`test_component_catalog.py`
mussten **nicht** auf `from ses import create_app` umgestellt werden — sie laden `server.py` weiterhin
per `importlib.util.spec_from_file_location` unter einem eigenen Modulnamen, und da `server.py` jetzt
nur noch `app = create_app()` aufruft, bekommt jede Testdatei bei ihrem eigenen Exec ohnehin eine frische
App + einen frischen `JobManager` (exakt die bisherige Isolation). Nur `test_serial_host.py` wurde
bereits beim `esphome.py`-Schritt auf `from ses.esphome import Job, JobManager` umgestellt.
`ruff` + `pytest` (32 + 16 subtests) grün; manueller Abgleich der Blueprint-App gegen die Route-Tabelle
(`/api/health`, `/api/runtime`, `/projects/list`, `/api/assets/manifest`, `/api/devices/list`,
`/api/import/targets`, `/api/serial/ports`, `/`, `/api/jobs/<id>`, OPTIONS-Preflight) bestätigt.

**Noch offen aus dem ursprünglichen B1-Umfang:** Gate-Schritt „curl-Sweep aller Endpunkte +
Container-Kurzcheck" (Docker-Build lokal nicht ausgeführt in dieser Sitzung) sowie „Add ses/ smoke
coverage per blueprint" (bestehende `test_smoke.py` deckt bereits 1 Pfad pro Blueprint ab — Ausbau
optional).

`ses/devices.py`: Registry (`load_devices`/`save_devices`), Key-Normalisierung
(`normalize_device_key`, `canonical_device_key`, `device_key_from_yaml`), `build_device_response`,
`MDNSProbe`, `ping_host`/`resolve_host`/`evaluate_device_connectivity`. Import als
`from ses import devices as dev` (Routen haben lokale `devices`-Variablen). `zeroconf`-Optional-Import
zog mit um, `server.py` verlor damit auch den `socket`-Import.

`ses/auth.py`: Ingress-Check (`check_access`) + Standalone-Basic-Auth (`is_standalone_mode`,
`read_auth_password`, `basic_auth_challenge`, `standalone_basic_auth_response`), `resolve_web_root`/
`resolve_secrets_path`. Keine Namenskollision mit lokalen Variablen, trotzdem `auth.`-Präfix für
Konsistenz mit den anderen `ses/`-Modulen. `server.py` verlor `base64`/`hmac`-Imports mit.

`ses/esphome.py`: `Job`, `JobManager` (Queue-Worker, `_run_job`/`_run_esphome`/`_run_command`,
Serial-Locking), `format_sse`. `JobManager` löst `_run_esphome` weiterhin über `self` auf, Serial-
Validierung über `serial_ports.validate_host_serial_port` (`from ses import serial_ports` bereits
vorhanden). `job_manager = JobManager()` bleibt bewusst in `server.py` (Startreihenfolge nach
`bootstrap_storage()` unverändert) — nur die Klassen zogen um, `server.py` importiert
`JobManager`/`format_sse`. `test_serial_host.py` auf `from ses.esphome import Job, JobManager`
umgestellt (vorher `server.Job`/`server.JobManager`). `server.py` verlor damit `pty`/`select`/
`shlex`/`subprocess`/`threading`/`collections.deque` mit — nur noch `queue`/`uuid` blieben (anderswo
noch gebraucht).

Route-Split und Gate B1 siehe §8 oben — B1 ist komplett abgeschlossen.

### Danach (Reihenfolge fix, Entscheidungen getroffen)

1. ~~**B1 fertigstellen** → Gate~~ **erledigt** (curl-Sweep aller Endpunktgruppen + realer Job-Durchlauf im Container, siehe §8).
2. **F1** (BuilderView: 4 Seams) + **F5** (DashboardView, DisplayInspector) — erst `@vue/test-utils`+jsdom,
   dann Charakterisierungstests je Extraktion. Gate: voller Browser-Durchlauf.
3. **Phase 4** — Docker-Multistage (Frontend im Image, `smartesp-studio/web/` raus), `dependabot.yml`,
   `CONTRIBUTING.md` + Modul-Doku. Gate.
4. **Abschluss-Feature-Prüfung** (11-Punkte-Checkliste, `plans/…` „Feature-Prüfung").
5. `icon.png` (quadratisch, HA-Add-on-Store) — braucht Asset vom Nutzer.
6. Push + PR, sobald der Nutzer grünes Licht gibt.
