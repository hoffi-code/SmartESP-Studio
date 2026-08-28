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
| F7 | `js-yaml: ^5.2.1`: 5.x ist eine zurückgezogene/fehlerhafte Linie, die stabile aktuelle Version ist 4.x. CHANGELOG 1.3.1 dokumentiert den Sprung „4.1.1 → 5.2.1" als absichtlich — vermutlich Versehen. Prüfen und auf `^4.1.0` zurück. | mittel | S |
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
8. **B10** `datetime.now(timezone.utc)` statt `utcnow()`.
9. **B7** `requirements.txt` einführen, Standalone-Dockerfile-Deps angleichen, Serial-Feature im Standalone verifizieren.
10. **B4** OPTIONS-/CORS-Boilerplate in `after_request` bzw. Decorator zusammenziehen.
11. **R5** Fork-Metadaten klären (Entscheidung nötig: eigener Namespace oder Upstream-Angleich).

### Phase 2 — Backend-Struktur

12. **B2** `logging` einführen (strukturiert, Level über Env), `print`-freie Baseline halten.
13. **B6** App-Factory `create_app()`, Konfiguration in ein `Config`-Objekt, Tests auf Factory umstellen.
14. **B1** `server.py` in Blueprints/Module aufteilen entlang der bestehenden Routengruppen:
    `projects`, `yaml`, `assets`, `components` (Katalog/Import), `devices` (+ mDNS/Ping), `jobs` (+ `Job`/`JobManager`), `import`, `secrets`, `ui`. Reine Helfer nach `ecd/` (io, validation, esphome).
15. **B3** Einheitliches Fehlerschema über `errorhandler` + konsequente Nutzung von `json_error()`.
16. **B5** Produktions-WSGI-Server (`gunicorn` mit Threads oder `waitress`), `app.run` nur noch für lokal.

### Phase 3 — Frontend-Struktur

17. **F4** `utils/api.js`: eine `request()`-Funktion mit Base-URL-/Ingress-/`credentials`-Logik, einheitlicher Fehlerbehandlung. Alle 11 `fetch`-Stellen darüber führen.
18. **F1** `BuilderView.vue` weiter zerlegen: Preview-Pipeline, Deployment-State, Asset-Flow, Display-Sync je in ein Composable mit eigener Testabdeckung. Ziel: Script-Setup < 1500 Zeilen.
19. **F5** `DashboardView.vue`, `DisplayInspector.vue` analog entlang funktionaler Schnitte.
20. **F3-Ausbau** Testabdeckung für `yamlProjectImport.js`, `schemaLoader.js`, die neuen Composables.

### Phase 4 — Repo-Hygiene

21. **R1** Einzige Schema-Quelle festlegen (`frontend/public/`), `web/`-Kopie im CI-Build erzeugen statt einchecken. Übergangsweise Sync-Check als CI-Job.
22. **R2** Frontend-Build aus dem Repo nehmen, im Docker-Build bzw. CI erzeugen.
23. **R4** `dependabot.yml` (npm + pip + github-actions).
24. **R6** `CONTRIBUTING.md`, Backend-Modul-Doku, Frontend-`README`.

---

## 4. Offene Entscheidungen

- **R1/R2**: Build im Docker-Multistage bauen (Node-Stage → Python-Stage) oder in CI ein Artefakt erzeugen und ins Image kopieren? Betrifft Add-on-Build (`Dockerfile`) und Standalone (`Dockerfile.standalone`) gleichermaßen.
- **R5**: Fork als eigenständiges Produkt (`hoffi-code`-Namespace überall) oder nah an Upstream halten (Angleich zurück auf `sokolsok` für spätere PRs)?
- **B5**: `gunicorn` (mehr Verbreitung, braucht `gthread`-Worker wegen SSE) vs. `waitress` (pure-Python, einfacher im HA-Add-on-Kontext)?
- **B1**: Blueprints im selben Paket oder Umzug auf ein installierbares `ecd`-Package mit `pyproject.toml`? Letzteres macht das `COPY server.py`-Muster in beiden Dockerfiles hinfällig.
- Scope dieser Iteration: Phasen 0–1 zuerst abschließen und bewerten, oder direkt bis Phase 2 durchplanen?
