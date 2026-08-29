# SmartESP Studio — Fortsetzungsplan: B1, F1, F5, Phase 4, Feature-Prüfung

## Context

Der Fork `hoffi-code/SmartESP-Studio` wird auf Branch `refactor/overhaul` umgebaut (39 Commits über
`main` = Upstream 1.3.3, **nichts gepusht**). Erledigt: Sicherheitsnetz (ESLint/Vitest/pytest/ruff/CI),
Kleinkorrekturen, Backend-Härtung (Logging, einheitliche Fehler-JSONs, waitress, `create_app()`-Factory +
**ein** Blueprint), Frontend-`utils/api.js`, Rebranding inkl. Verzeichnis-/Env-/Paket-Umbenennung +
Version `0.1.0`, Paywall-Entfernung, Logo/Favicon, UI-Retheme, Docker-Verifikation. Historie in
`REFACTORING.md` (§6–§8).

Offen sind die vier strukturell größten Brocken; danach eine systematische Verifikation, weil die
automatische Abdeckung dünn ist (16 Endpunkt-Smoke-Tests, 76 FE-Unit-Tests, **keine** Komponenten-/E2E-Tests)
und Rename + Refactor viel angefasst haben.

### Getroffene Entscheidungen (diese Sitzung)

- **F1/F5:** nur die sauberen Seams, kein hartes Zeilenziel, jeder Schritt einzeln testbar.
- **Feature-Prüfung:** manueller Browser-Durchlauf **plus** Vitest + `@vue/test-utils`-Charakterisierungstests
  für jede neu extrahierte Composable/Panel, mitgeschrieben während F1/F5.
- **Prüf-Zeitpunkt:** Verifikations-**Gate nach jeder Großphase** (B1 / F1+F5 / Phase 4) + voller Abschlusslauf.
- **Phase 4:** Docker-Multistage — Frontend im Image bauen, `smartesp-studio/web/` raus aus dem Repo.
- **B1-Paketform** (in diesem Plan festgelegt, beim Approval widersprechbar): `ses/`-Paket **ohne**
  `pip install`; `server.py` bleibt 3-Zeilen-Einstieg (`from ses import create_app; app = create_app()`) +
  `__main__`-waitress-Block; Dockerfiles behalten `COPY server.py` + `COPY ses`.

### Reihenfolge

`B1` → Gate → `F1` + `F5` → Gate → `Phase 4` → Gate → Abschluss-Feature-Prüfung → Push + PR.
Rationale: B1 ändert die Backend-Struktur, auf die F1/F5 (Frontend) nicht aufbauen — trotzdem zuerst,
weil ein B1-Regressionsfund nach F1/F5 schwerer zu isolieren wäre. Phase 4 zuletzt, weil sie Build/CI
umbaut und von einem stabilen Backend + Frontend profitiert.

---

## Meilensteine & Commit-Sequenz

Jede Zeile = ein Commit; nach jedem: `ruff`+`pytest` (Backend) bzw. `lint`+`test`+`build` (Frontend) grün.
Grobe Größe: S ≤ ½ Tag, M ≤ 2 Tage, L ≤ 1 Woche.

### B1 (Summe ~L) — Stand: 6 von ~10 Commits erledigt

| Commit | Größe | Status |
|---|---|---|
| `Extract filesystem helpers into ses/io` (`fa3d2e6`) | M | ✅ |
| `Extract serial-port helpers into ses/serial_ports` + test_serial_host (`cbe2f6d`) | S | ✅ |
| `Extract component catalog into ses/catalog` + test_component_catalog (`dc092c4`) | M | ✅ |
| `Read mutable config through the ses.config module` (`5628bf7`) — **einziger Patch-Punkt jetzt `ses.config`**, alle 4 Testdateien umgestellt | M | ✅ |
| `Extract asset store into ses/assets` (`a65d13d`) | M | ✅ |
| `Extract projects index into ses/projects` (`48f5441`) | S | ✅ |
| `Extract ses/devices` — `load/save_devices`, `unregister_device_record`, `*_device_key`, `build_device_response`, `MDNSProbe` (+ zeroconf try-import mitnehmen), `ping_host`, `resolve_host`, `evaluate_device_connectivity`, `find_firmware_path`. **Achtung:** Modul in `server.py` als `from ses import devices as dev` importieren — es gibt lokale Variablen `devices` in den Device-Routen (Kollision). Prefix `dev.`. `ses/devices.py` braucht `json`, `Tuple`, `normalize_yaml_filename` (aus `ses.io`). | S | ✅ |
| `Extract ses/auth` — `resolve_web_root/secrets_path`, `is_standalone_mode`, `read_auth_password`, `basic_auth_challenge`, `standalone_basic_auth_response`, `check_access`. `server.py` `before_request` + Routen rufen `auth.check_access()` etc. | S | ✅ |
| `Move Job/JobManager into ses/esphome` (`Job`, `JobManager`, `format_sse`). `_run_job` löst `_run_esphome` über `self`, `validate_host_serial_port` über `serial_ports.` auf. `job_manager = JobManager()`-Singleton bleibt bewusst in `server.py` (Startreihenfolge nach `bootstrap_storage()` unverändert, wandert erst mit dem Route-Split in `create_app()`). | M | ✅ |
| `Split routes into ses/routes/* blueprints`, `bootstrap_storage()` → `create_app()`, `server.py` → Dünn-Einstieg + `__main__`. **Abweichung:** `test_yaml_import.py`/`test_smoke.py` mussten nicht umgestellt werden — sie laden weiterhin `server.py` per `importlib`, das jetzt nur `app = create_app()` aufruft, macht also pro Testdatei automatisch eine frische App+JobManager. `job_manager` hängt als `app.extensions["job_manager"]` an der App-Instanz (`current_app.extensions[...]` in den Job-Routen), nicht als Modul-Global — vermeidet geteilten Zustand zwischen mehreren `create_app()`-Aufrufen. | L | ✅ |
| `Add ses/ smoke coverage per blueprint` (ergänzt `test_smoke.py`) | S | ⬜ (bestehende `test_smoke.py` deckt bereits 1 Pfad/Blueprint ab, Ausbau optional) |
| **Gate B1:** curl-Sweep aller Endpunkte + Container-Kurzcheck | S | ✅ |

**Werkzeug:** `$CLAUDE_JOB_DIR/tmp/extract.py` (generisches Cut+Splice+Prefix) funktioniert für reine
Funktionsblöcke ohne Namenskollision (io/catalog/assets/projects). Für `devices` (lokale `devices`-Var)
und Klassen mit `self.`-Methoden **nicht** blind verwenden — Modul-Alias + gezielte Edits.
`server.py`: 3747 → 2599 Z.

### F1 (Summe ~M–L)

| Commit | Größe | Status |
|---|---|---|
| `Add @vue/test-utils + jsdom, wire vitest jsdom project` | S | ✅ (per-file `// @vitest-environment jsdom` docblock — `environmentMatchGlobs` existiert in Vitest 4 nicht mehr) |
| `Extract builderValidationRules module + tests` | M | ✅ |
| `Extract useBuilderYamlPreview + snapshot tests` | M | ✅ |
| `Extract useBuilderDeployment + tests` | M | ✅ |
| `Extract useBuilderProjectPersistence + tests` | M | ⬜ |
| `Consolidate duplicate config deep-watch` | S | ⬜ |

### F5 (Summe ~M–L)

| Commit | Größe |
|---|---|
| `Extract useDashboardYamlImport + tests` | M |
| `Extract useDashboardTileCustomization + tests` | S–M |
| `Split DisplayInspector: Shape + Icon panels` | S |
| `Split DisplayInspector: Text + Image + Animation panels + useDisplayImageField/useDisplayFontControls` | M |
| `Split DisplayInspector: Graph + GraphLegend + useGraphTraces` | M |
| **Gate F1+F5:** voller Browser-Durchlauf (Checkliste), Report | S |

### Phase 4 (Summe ~M)

| Commit | Größe |
|---|---|
| `Multi-stage standalone Dockerfile (build frontend in image)`, `context: .` in docker-standalone.yml, root `.dockerignore` | M |
| `git rm smartesp-studio/web`, gitignore it, resolve HA-add-on path (siehe Phase 4) | S |
| `Add dependabot.yml` | S |
| `Add CONTRIBUTING.md + ses/README.md + frontend README.md` | S |
| **Gate Phase 4:** Image ohne `web/` bauen + Container-Check; `docker build --check`; `compose config` | S |

### Abschluss

| Commit | Größe |
|---|---|
| **Abschluss-Feature-Prüfung:** komplette 11-Punkte-Checkliste, Report in `REFACTORING.md` §9 | S |
| `REFACTORING.md`: Phasen abhaken, „Nächste Schritte" leeren | S |
| Push `refactor/overhaul` + PR gegen `main` (auf Freigabe) | S |

---

## Phase B1 — `server.py` in `ses/`-Module aufteilen

`smartesp-studio/server.py` ist 3747 Z., ein `Blueprint("ses")`, `create_app()`-Factory. Config
(inkl. `ASSET_LOCK`, `COMPONENTS_LOCK`, Regexes, `is_truthy`) liegt bereits in `ses/config.py`;
Logging in `ses/logging.py`, Fehler in `ses/errors.py`. Die einzigen verbleibenden Modul-Level-
Statements in `server.py`: `bootstrap_storage()` (1968), `job_manager = JobManager()` (1969),
`bp = Blueprint("ses")` (1971), `app = create_app()` (3729).

### Zielstruktur

```
smartesp-studio/
  server.py                 # from ses import create_app; app = create_app()  +  __main__ (waitress)
  ses/
    __init__.py             # create_app(): bootstrap_storage(); Blueprints + Error-Handler + before_request registrieren
    config.py logging.py errors.py            [erledigt]
    io.py                   # utc_now, read/write_json(_atomic), copy_if_missing, seed_tree, seed_assets,
                            #   write_text_file_atomic, read_log_tail, sanitize_log_line, should_skip_log_line,
                            #   timestamp_to_utc, bootstrap_storage, normalize_filename/yaml/device, is_same_filesystem_path
    serial_ports.py         # is_allowed_serial_port, list_host_serial_ports, validate_host_serial_port
    assets.py               # sync_asset_index/sync_assets, asset_meta_for_kind, validate_asset_*, build_asset_entries,
                            #   build_assets_manifest, load_mdi_glyph_substitutions, parse_asset_kind/refresh_flag, …
    catalog.py              # die ~40 Komponenten-Katalog-Funktionen (normalize_*/merge_*/ensure_category_*/
                            #   parse_zip_components_catalog/build_custom_component_schema/…)
    projects.py             # projects_index_path, load/save_projects_index, add/remove/rename_project_in_index
    devices.py              # load/save_devices, unregister_device_record, *_device_key, build_device_response,
                            #   MDNSProbe, ping_host, resolve_host, evaluate_device_connectivity, find_firmware_path
    auth.py                 # resolve_web_root/secrets_path, is_standalone_mode, read_auth_password,
                            #   basic_auth_challenge, standalone_basic_auth_response, check_access
    esphome.py              # Job, JobManager, format_sse, job_manager = JobManager()  (Daemon-Thread beim Import)
    routes/
      diagnostics.py        # /api/health, /api/runtime
      components.py         # /api/component-catalog, /api/component-schemas/<>, /api/components/import-zip,
                            #   /api/custom-components (POST/PUT/DELETE)
      assets.py             # /api/assets/{refresh,manifest,mdi-substitutions,upload,rename,<kind>/<file>}
      yaml_files.py         # /save, /yaml/load, /yaml/delete
      projects.py           # /projects/{save,list,load,delete,rename}, /api/projects/purge
      imports.py            # /api/import/{yaml-candidates,targets,yaml,project}
      secrets.py            # /api/secrets/raw (GET/POST)
      devices.py            # /api/devices/{unregister,register,list,status}, /api/serial/ports
      jobs.py               # /api/install, /api/jobs/<>{,/tail,/tail-wait,/stream,/cancel}, /api/firmware
      ui.py                 # /, /<path:path>  (SPA-Catch-all)
```

### Test-Migration (der eigentliche Aufwand)

Heute rebinden die 4 Testdateien Attribute am `server`-Modulobjekt (`server.TARGET_DIR = …`,
`patch.object(server, "list_host_serial_ports", …)`, `server.Job(…)`), und Handler lesen den
`server.py`-lokalen Namen. Sobald Code in `ses/<modul>.py` wandert, greift das nicht mehr.

**Vorgehen:** Es gibt **einen** Patch-Punkt — `ses.config`. Verschobene Helfer lesen Config als
Attributzugriff zur Laufzeit (`from ses import config` … `config.TARGET_DIR`), nicht als
`from ses.config import TARGET_DIR`. Die 4 Testdateien werden umgestellt:

- Bootstrap: statt `importlib.util.spec_from_file_location(… "server.py")` → `from ses import create_app`
  bzw. `import ses.config as config`. `pty`-Stub (`sys.modules.setdefault("pty", …)`) bleibt.
- `bootstrap_storage()` + `job_manager` wandern **in `create_app()`** bzw. nach `ses/esphome.py` →
  `import ses` hat keine Filesystem-Nebenwirkung mehr; Tests patchen `config.*` und rufen dann
  `create_app().test_client()`.
- Attribut-Rebinds → `config.TARGET_DIR = tmp` (statt `server.TARGET_DIR`).
- Helfer-Referenzen → neue Herkunft: `from ses.esphome import Job, JobManager`,
  `from ses.serial_ports import is_allowed_serial_port, validate_host_serial_port, list_host_serial_ports`,
  `from ses.catalog import normalize_component_entry, component_catalog_entry_key, merge_component_catalogs,
  extract_catalog_items, remove_catalog_item_all_by_key, parse_zip_components_catalog,
  safe_zip_component_package_member_path, components_runtime_list_path`.
- `patch.object(server, "list_host_serial_ports", …)` → `patch.object(ses.routes.jobs, "validate_host_serial_port", …)`
  bzw. dort, wo der Aufruf sitzt — oder `patch("ses.serial_ports.list_host_serial_ports", …)` per Pfad-String.
- `JobManager._run_job` muss `_run_esphome` weiter über `self` und `validate_host_serial_port` über die
  eigenen Modulglobals auflösen (bleibt so).

### Reihenfolge (jeder Schritt = 1 Commit, `pytest`/`ruff` grün danach)

1. `ses/io.py` herausziehen; `bootstrap_storage()`-Aufruf nach `create_app()` (`ses/__init__.py`).
2. `ses/serial_ports.py` + `test_serial_host.py` umstellen.
3. `ses/catalog.py` + `test_component_catalog.py` umstellen.
4. `ses/assets.py`, `ses/projects.py`, `ses/devices.py`, `ses/auth.py` (reine Helfer, noch keine Route-Abhängigkeit).
5. `ses/esphome.py` (`Job`, `JobManager`, `job_manager`) + Serial-Job-Tests grün.
6. Route-Gruppen als Per-Datei-Blueprints unter `ses/routes/` anlegen, in `create_app()` registrieren
   (`before_request`-Preflight/Auth + Error-Handler bleiben app-level). `test_yaml_import.py` +
   `test_smoke.py` auf `create_app()` umstellen. Riesen-Blueprint aus `server.py` entfernen →
   `server.py` = 3 Zeilen + `__main__`.
7. `smartesp-studio/pyproject.toml`: `[tool.ruff] extend-exclude`/`src`-Pfade prüfen; keine
   Paketmetadaten nötig. `.dockerignore` unverändert. Dockerfiles unverändert (`COPY ses` steht schon).

### Nicht ändern

Verhalten aller Routen, `run.sh`, `config.json`-Watchdog, das `<iso>Z`-Zeitformat, waitress-Start.

### Verifikation (Gate nach B1)

- `cd smartesp-studio && ruff check . && python -m pytest -q` → alle grün (32 + 16 subtests, ggf. mehr).
- `cd smartesp-studio-frontend && npm run build` (unverändert grün — Frontend nicht angefasst).
- Container neu bauen + starten (siehe unten), dann **jeden** Endpunkt aus der API-Tabelle mit `curl`
  gegen `http://localhost:8099` abklopfen (Statuscode + Grundform), v.a. `/api/runtime`,
  `/api/component-catalog`, `/projects/list`, `/api/assets/manifest`, `/api/devices/list`,
  `/api/import/targets`, `/api/serial/ports`, `POST /api/install` (Job wird angelegt), `/api/jobs/<id>`,
  `/api/jobs/<id>/stream` (SSE öffnet).
- Browser-Kurzcheck: Dashboard lädt, Projekt anlegen → Builder → Save → Validate (Job-Konsole öffnet, Log streamt).

---

## Phase F1 — `BuilderView.vue` entzerren (4 Extraktionen)

`smartesp-studio-frontend/src/views/BuilderView.vue`: Template 1–508 (bereits voll in Kind-Komponenten
zerlegt), `<script setup>` 510–6293 (~5783 Z.) ist das ganze Problem. Kleinste selbstständige Seams:

| # | Was | Quelle (Regionen aus Analyse) | Ziel | Kopplung |
|---|---|---|---|---|
| 1 | **Validation-Regeln** | Region D, Z. ~712–1465 (`buildIdRefErrors`, `buildDisplayElementIdErrors`, `buildValidationErrors`, `buildGpioUsageIndex`, `buildIdIndex`, `buildDuplicateErrors`, Helfer) | **`src/utils/builderValidationRules.js`** (reines Modul). `src/composables/builder/useBuilderValidation.js` importiert die Funktionen direkt statt sie als 6 Params zu bekommen. | keine reaktive Closure außer über Params — verbatim verschiebbar |
| 2 | **YAML-Preview-Pipeline** | Regionen S+T, Z. ~2949–3915 (`yamlPreviewDocument`-Computed, `parseYamlBlocks`, `previewGroups`, `previewTabs`, `humanizePreviewKey`, …) | **`src/composables/builder/useBuilderYamlPreview.js`**, Inputs: `config`, alle Schema-Refs, `generatedAutomation`, `componentDomainsUsingHubs`, `displayImages`, `activeModeLevel` | nur Lesen, kein `config`-Write |
| 3 | **Deployment + Device-Status** | Region Z (Z. ~4469–4858) + Capability-Computeds AA (4860–4880) + Watcher 5058/5077 + `handleBuilderVisibilityChange` + Poll start/stop | **`src/composables/builder/useBuilderDeployment.js`** | über `config.ui.deviceHost`, `projectFilename`, `projectDevice*`, `projectSaveError`; exponiert schon Getter für `useInstallConsoleFlow` |
| 4 | **Projekt-Speichern / YAML-Datei / projects-index** | Region AD (Z. ~5088–5379) + AE `normalizeConfig`/`loadConfig` (5380–5575) | **`src/composables/builder/useBuilderProjectPersistence.js`** | `config`, `projectFilename`, `sourceProjectFilename`, `saveConfig`, `addonFetch` |

Nebenbei: den **doppelten** `watch(config, {deep:true}) → saveConfig` (BuilderView 5839 **und**
`useBuilderComponentCatalog.js:325`) auf eine Stelle konsolidieren.

Erwartung: Script-Setup ~5783 → **~3600 Z.** Kein hartes Ziel; wenn ein 5. Seam (Generated-Password-
Materialisierung, Region R ~2653–2946) sauber rausgeht, mitnehmen.

### Test-Infrastruktur (einmalig, vor der ersten Extraktion)

- devDeps: `@vue/test-utils`, `jsdom` (öffentliche Registry).
- `vitest.config.js`: zweites Test-Projekt bzw. `test.environmentMatchGlobs` — `*.spec.js` bleibt
  `node`, neue `*.spec.dom.js` / `*.spec.vue.js` laufen unter `jsdom`.
- Pro Extraktion eine Charakterisierungs-Suite: für #1 reine Funktionstests (Fixtures: kleine
  schema+config-Paare → erwartete Fehlerliste); für #2 `yamlPreviewDocument`-Output gegen Snapshot
  eines Referenz-Configs; für #3/#4 Composable-Test via winziger Host-Komponente (`mount`) oder
  `withSetup`-Helper.

### Reihenfolge

Test-Infra (1 Commit) → #1 (Modul + Tests) → #2 → #3 → #4 → Watcher-Konsolidierung. Je 1 Commit,
`npm run lint && npm test && npm run build` grün danach.

---

## Phase F5 — `DashboardView.vue` + `DisplayInspector.vue`

### DashboardView (`src/views/DashboardView.vue`, 3093 Z.; Script 177–2394)

Zwei Extraktionen (die klar abgegrenzten, großen):

| Was | Quelle | Ziel |
|---|---|---|
| **YAML-Import-Flow** | State 270–298 + Fns 1549–1866 (`loadBuilderYamlImportCandidates`, `beginYamlImport`, `startYamlImportAnalysis`, `handleYamlImportConfirm`, Datei-/Kandidaten-Picker, Targets, Katalog-Load) | **`src/composables/dashboard/useDashboardYamlImport.js`** |
| **Tile-Customization** | State-Teilmenge 262–298 + Fns 1268–1489 (`readCustomizationFromProject`, `customizePreview*`-Computeds, Icon-/Color-Picker, `persistProjectCustomization`, `applyProjectCustomization`, `resetProjectCustomization`) | **`src/composables/dashboard/useDashboardTileCustomization.js`** |

Bestehende Composables bleiben Vorbild und Nachbar: `useDashboardTree.js` (373 Z.),
`useDashboardDeviceStatus.js` (129 Z.). Erwartung ~3093 → **~2500 Z.**

### DisplayInspector (`src/components/display/DisplayInspector.vue`, 2114 Z.; Template 1–1138)

Per-Element-Typ-Split (Template + zugehörige Logik):

- `DisplayInspectorShape.vue` (Tpl 11–62)
- `DisplayInspectorText.vue` (Tpl 135–298 + Font-Logik 1557–1648)
- `DisplayInspectorImage.vue` (Tpl 299–374 + Encoding 1294–1328, Probe/Auto-Size 1901–1927)
- `DisplayInspectorAnimation.vue` (Tpl 375–538 + 1804–1829)
- `DisplayInspectorGraph.vue` (Tpl 539–1084) + `DisplayInspectorGraphLegend.vue` (Tpl 828–1084 +
  Legenden-Handler 1650–1802, 1831–1899)
- `DisplayInspectorIcon.vue` (Tpl 1085–1137 + Icon-Computeds 1358–1391)

Gestützt auf neue Composables (neues Verzeichnis `src/composables/display/`):
`useDisplayFontControls` (Font-Source/-Variant, geteilt Text+Legende), `useDisplayImageField`
(Encoding + `Image`-Probe-Auto-Size), `useGraphTraces` (Trace-CRUD + Trace-Farbe), `useElementPatch`
(generische `emit('update', …)`-Helfer 1257–1292). `DisplayInspector.vue` wird zum dünnen
`v-if type===…`-Switch (~300 Z.).

### Tests

Je Composable/Panel eine `@vue/test-utils`-Render-/Interaktions-Suite (`*.spec.vue.js`).

### Reihenfolge

DashboardView #1 → #2 → DisplayInspector: pro Panel 1 Commit (Shape/Icon zuerst, dann Text/Image/
Animation, Graph+Legend zuletzt), jeweils Tests + `npm run lint && npm test && npm run build`.

### Verifikation (Gate nach F1+F5)

- `npm run lint && npm test && npm run build` grün; Testzahl deutlich > 76 (neue Komponenten-Suites).
- Container neu, **voller Browser-Durchlauf** der Frontend-Flows (siehe Feature-Prüfung unten).

---

## Phase 4 — Repo-Hygiene

### R2 — Frontend-Build im Docker-Multistage (nicht mehr eingecheckt)

- `smartesp-studio/Dockerfile.standalone`: Node-Build-Stage vorne —
  `FROM node:22-alpine AS web` → `COPY smartesp-studio-frontend/ .` → `npm ci` → `npm run build`.
  Runtime-Stage: `COPY --from=web /app/dist /web` statt `COPY web /web`. **Build-Context = Repo-Root**
  (`docker-standalone.yml`: `context: .`, `file: ./smartesp-studio/Dockerfile.standalone`).
- `.dockerignore` (Repo-Root, neu): `smartesp-studio-frontend/node_modules`, `**/dist`, `.git`, …
- `git rm -r smartesp-studio/web/`; `smartesp-studio/web/` in `.gitignore`.
- **R1 fällt damit automatisch:** `web/schemas` war eine Kopie von `smartesp-studio-frontend/public/`.
  `vite build` kopiert `public/*` nach `dist/` → einzige Quelle ist `public/`, `/web` im Image ist
  abgeleitet. Docs (`HOW_TO_CREATE_SCHEMA*.md`) zeigen bereits auf `public/`.
- **HA-Add-on-`Dockerfile`** (Supervisor baut mit Context = Add-on-Ordner `smartesp-studio/`, das
  `smartesp-studio-frontend/` nicht enthält) — **offene Detailfrage bei der Umsetzung:** entweder
  (a) HA-Add-on-Pfad vorerst mit einem per CI erzeugten `web/`-Artefakt bedienen (Workflow baut
  Frontend, hängt `web/` an den Add-on-Build), oder (b) den HA-Add-on-Distributionsweg zunächst
  zurückstellen und nur das Standalone-Image (GHCR) pflegen. Entscheidung, sobald klar ist, ob der
  HA-Store-Weg aktiv gehalten wird.
- Die wiederkehrenden Commits **„Rebuild add-on web bundle" entfallen** (für den Standalone-Weg sofort).

### R4 — `.github/dependabot.yml`

npm (`/smartesp-studio-frontend`), pip (`/smartesp-studio`, `requirements*.txt`), github-actions. Wöchentlich.

### R6 — Doku

- `CONTRIBUTING.md` (Setup: Node 22 via `.nvmrc`, `npm ci` gegen öffentliche Registry, `npm run lint/test/build`;
  Backend: `pip install -r requirements-dev.txt`, `ruff`, `pytest`; Commit-/PR-Stil).
- `smartesp-studio/ses/README.md`: Modul-Landkarte (welches `ses/`-Modul was macht).
- `smartesp-studio-frontend/README.md`: Views/Composables-Überblick, `VITE_DEV_OFFLINE`, Dev-vs-Add-on-Runtime.

### Verifikation (Gate nach Phase 4)

- `docker build --check` beide Dockerfiles; `docker compose config` alle 3 Compose-Dateien.
- Standalone-Image **ohne eingecheckten `web/`** bauen; Container starten; `/api/health` = 200;
  Browser: UI lädt, Logo/Retheme da, Schemas werden geladen (Builder-Tab öffnet Formular).
- `git status` sauber ohne `web/`-Diff; kein „Rebuild"-Commit mehr nötig.

---

## Feature-Prüfung

Vollständiger, strukturierter Browser-Durchlauf gegen den lokalen Standalone-Container
(`smartesp-studio:local`, `-p 8099:8099`), gesteuert per Chrome-MCP. Pass/Fail je Flow, Report am Ende
jedes Gates und final. Job-Flows (compile/flash/OTA) werden nur bis **„Job angelegt + Log-Stream läuft"**
geprüft — kein echter ESPHome-Toolchain-Lauf lokal.

### Checkliste (aus dem Feature-Inventar)

1. **Dashboard:** Laden, Ordnerbaum (expand/select/breadcrumb), Ordner anlegen/löschen, Projekt per
   Drag → Ordner, Suche, View-Mode-Toggle, Tile-Customization (Icon/Farben, Live-Preview, speichern),
   Projekt-Kontextmenü (Edit/Validate/Logs/Download-YAML/Clean/Delete), Online/Offline-Badge-Polling,
   „New device" → leerer Builder, bestehendes Projekt öffnen.
2. **Builder — Tabs:** Core/Platform/Network/Protocols/Busses/System/Automation je einmal öffnen,
   je ein Feld ändern → YAML-Preview aktualisiert. Mode-Level Simple→Normal→Advanced, „Show Normal/
   Advanced configuration"-Button.
3. **Builder — YAML-Preview:** Single ↔ Tabbed umschalten, Copy-to-Clipboard, Form→YAML-Puls,
   YAML-Zeile klicken → Sprung ins Formularfeld (bidirektional).
4. **Builder — Components:** Picker öffnen, Komponente hinzufügen, entfernen (Confirm),
   `root_map`-Konflikt (Komponente ausgegraut), Custom-Component als Template speichern/löschen,
   ZIP-Import (kleines gültiges Paket → Summary-Modal).
5. **Builder — Save:** Ctrl-S / Save-Button → `POST /save` + `/projects/save`; Rename-Nebeneffekt bei
   Namensänderung; „Back to Dashboard" mit ungespeicherten Änderungen → UnsavedChangesModal.
6. **Display-Configurator:** Modal öffnen (nach Display-Modell-Wahl), je Elementtyp (text/icon/image/
   shape/graph/animation) eins anlegen, im Inspector Eigenschaften ändern, auf Canvas verschieben/
   skalieren, Zoom/Pan/Fit, Reorder per Drag, Delete/Copy/Paste, Reset (Confirm) — YAML enthält das
   generierte `display`-Lambda.
7. **Asset-Manager:** Modal öffnen (Manifest lädt), je Tab (Images/Fonts/Audio) Upload (gültige
   Datei), Rename (Prompt), Delete (Confirm), Suche, geschützte MDI-Font ausgeblendet.
8. **Secrets:** Modal öffnen (`secrets.yaml` lädt), Syntax-Highlight, ungültiges YAML → Save
   deaktiviert + Fehleranzeige, gültige Änderung → Save (`POST /api/secrets/raw`).
9. **YAML-Import:** Import-Menü → „YAML file" (lokale Datei → Editor → Analyse-Report → Confirm →
   neues Projekt); „ESPHome Builder" (Kandidatenliste, sofern `ESPHOME_CONFIG_DIR` befüllt) — sonst
   „keine Kandidaten" sauber angezeigt.
10. **Install-Flows:** Validate / Clean / Logs / OTA / „Serial (HA server)" / „Serial (this computer)"
    / „Download Binary" — jeweils bis Job-Konsole offen + SSE-/Long-Poll-Log läuft bzw. bis zur
    erwarteten Fehlermeldung (kein Gerät / kein Toolchain). Job-Cancel testen.
11. **Backend-API:** alle Routen aus der `@bp.route`-Tabelle per `curl` (Statuscode + Antwortform),
    inkl. `/api/runtime?debug`, `/api/firmware` (404 ohne Binary), `/api/jobs/<id>/tail-wait`.

### Charakterisierungstests (dauerhaft, während F1/F5)

Pro extrahierter Composable/Panel eine Vitest-Suite (`@vue/test-utils` für Komponenten), sodass die
Zerlegung dauerhaft abgesichert ist und die nächste Phase auf grüner Basis startet.

---

## Kritische Dateien

| Bereich | Dateien |
|---|---|
| B1 | `smartesp-studio/server.py`, neu `smartesp-studio/ses/{io,serial_ports,assets,catalog,projects,devices,auth,esphome}.py` + `ses/routes/*.py`, `ses/__init__.py`; `smartesp-studio/tests/{test_yaml_import,test_serial_host,test_component_catalog,test_smoke}.py` |
| F1 | `smartesp-studio-frontend/src/views/BuilderView.vue`; neu `src/utils/builderValidationRules.js`, `src/composables/builder/{useBuilderYamlPreview,useBuilderDeployment,useBuilderProjectPersistence}.js`; `src/composables/builder/useBuilderValidation.js`, `useBuilderComponentCatalog.js`; `vitest.config.js`, `package.json` |
| F5 | `src/views/DashboardView.vue`; neu `src/composables/dashboard/{useDashboardYamlImport,useDashboardTileCustomization}.js`; `src/components/display/DisplayInspector.vue` + neu `DisplayInspector{Shape,Text,Image,Animation,Graph,GraphLegend,Icon}.vue`; neu `src/composables/display/{useDisplayFontControls,useDisplayImageField,useGraphTraces,useElementPatch}.js` |
| Phase 4 | `smartesp-studio/Dockerfile`, `smartesp-studio/Dockerfile.standalone`, `.github/workflows/docker-standalone.yml`, `.github/workflows/checks.yml`, `.dockerignore` (root, neu), `.gitignore`, `.github/dependabot.yml` (neu), `CONTRIBUTING.md` (neu), `smartesp-studio/ses/README.md` (neu), `smartesp-studio-frontend/README.md` (neu); `git rm -r smartesp-studio/web/` |

## Wiederverwenden

- `src/utils/api.js` (`apiUrl`/`apiFetch`/`unwrapJson`/`apiJson`) — jeder neue Fetch geht hierüber.
- Bestehende Composable-Muster: `useDashboardTree.js`, `useDashboardDeviceStatus.js`, `useBuilderPreview.js`
  (wird von `BuilderPreviewPane.vue` konsumiert, nicht von der View) als Vorlage für Ein-/Ausgabe-Konvention.
- `ses/config.py` / `ses/errors.py` / `ses/logging.py` — bereits die Landeplätze für B1.
- `tests/test_smoke.py` — als Vorlage/Ergänzung für Blueprint-Smoke nach dem Split.

## Verifikation (Kommandos, an jedem Gate)

```
# Backend
cd smartesp-studio && ruff check . && python -m pytest -q

# Frontend
cd smartesp-studio-frontend && npm run lint && npm test && npm run build

# Container (Standalone) neu bauen + starten
cd smartesp-studio && rm -rf web 2>/dev/null; \
  docker build -f Dockerfile.standalone -t smartesp-studio:local --build-arg BUILD_VERSION=0.1.0 . && \
  docker rm -f smartesp-studio-test 2>/dev/null; \
  docker run -d --name smartesp-studio-test -p 8099:8099 smartesp-studio:local && sleep 6 && \
  curl -s http://localhost:8099/api/health

# ab Phase 4: Build-Context = Repo-Root, Multistage
docker build -f smartesp-studio/Dockerfile.standalone -t smartesp-studio:local --build-arg BUILD_VERSION=0.1.0 .

# Browser: Chrome-MCP gegen http://localhost:8099, Checkliste oben abarbeiten
```

## Risiken

- **B1 Test-Migration** ist der heikelste Teil: die 4 Testdateien werden umgeschrieben, nicht nur die
  Imports — grün heißt hier auch „prüft noch das Richtige". Deshalb Schritt für Schritt, `pytest` nach
  jedem Modul.
- **F1/F5** an nicht real lokal startbarem Code (Backend + Container nötig) — Absicherung sind die
  Charakterisierungstests + der Browser-Durchlauf am Gate. Kein hartes Zeilenziel = im Zweifel den
  Seam kleiner schneiden.
- **Phase 4 HA-Add-on-Dockerfile** kann den Frontend-Build im Add-on-Context nicht ausführen — die
  offene Detailfrage (CI-Artefakt vs. Add-on-Weg zurückstellen) vor der Umsetzung klären.
- **`git`-Performance:** `core.autocrlf=true` + großer `web/`-Baum → Commits langsam; bis `web/`
  entfernt ist mit `git -c core.autocrlf=input add` + `--no-verify` arbeiten (wie in dieser Sitzung).

## Danach

Push `refactor/overhaul`, PR gegen `main` des Forks. `CLAUDE.md` (Repo-Root, aktuell untracked)
bleibt untracked, sofern nicht anders entschieden.
