# AGENTS.md — SmartESP Studio (ESPConfig-Designer)

Gemeinsame Anleitung für KI-Agenten (Claude Code, Codex). `CLAUDE.md` verweist nur hierher.
Übergreifende Regeln: Plugin `homelab` (Skill `homelab:homelab-grundregeln`), führend außer unter „Abweichungen“.

## Was dieses Projekt ist

SmartESP Studio ist eine Web-App, mit der sich ESPHome-Konfigurationen über einen schemagetriebenen visuellen Editor anlegen, organisieren, validieren, kompilieren und auf Geräte bringen lassen (Dashboard, Builder, Display-Konfigurator, Asset-Manager, Simulation). Ausgeliefert wird ein Standalone-Docker-Image; die ursprüngliche Form als Home-Assistant-Ingress-Add-on ruht.

Das Repo `hoffi-code/SmartESP-Studio` ist ein **Fork** des MIT-lizenzierten Projekts von Sebastian Sokołowski / Smart Solutions for Home (`LICENSE.md`). Stand und Änderungen: `CHANGELOG.md`, Pläne: `plans/`, Überblick und API: `README.md`.

## Live-System / Verteilung

- Image: `ghcr.io/hoffi-code/smartesp-studio` (`:latest`, `:<version>`, `:edge`), multi-arch `amd64`/`arm64`, gebaut von `.github/workflows/docker-standalone.yml` bei Pushes auf `main` (`:edge`) und bei Tags `v*.*.*`.
- Standalone-Betrieb per Docker Compose (`docker/`), Standard `http://<docker-host-ip>:8099`, Basic Auth (`admin`, Passwort aus `docker/.env`, `SES_AUTH_PASSWORD`). Nie direkt ins Internet stellen.
- Kein eigener Proxmox-Gast dieses Projekts.

## Stack und Befehle

- Backend `smartesp-studio/`: Python/Flask (`server.py`, `config.json`, `run.sh`), führt ESPHome-CLI-Jobs aus und streamt Logs; Übersetzungen `translations/`.
- Frontend `smartesp-studio-frontend/`: Vue 3 + Vite, i18n unter `src/i18n/locales/` (`de`, `en`), Node laut `.nvmrc` (22).
- Prüfen Frontend (in `smartesp-studio-frontend/`): `npm ci` (öffentliche npm-Registry laut `.npmrc`), `npm run lint` (0 Fehler; Warnungen sind Altlast), `npm test` (Vitest), `npm run build`.
- Prüfen Backend (in `smartesp-studio/`): `pip install -r requirements-dev.txt`, `ruff check .`, `python -m pytest -q`; Start `python server.py` (Port aus `PORT`, Standard 8099).
- Image lokal: `docker build -f smartesp-studio/Dockerfile.standalone -t smartesp-studio:local --build-arg BUILD_VERSION=dev .` (Repo-Root als Kontext). `smartesp-studio/Dockerfile` (Add-on) ist derzeit nicht baubar.
- CI: `.github/workflows/checks.yml` führt Lint/Test/Build für Frontend und Backend bei jedem PR aus.

## Projektspezifische Regeln

- **Schemagetrieben:** Viele sichtbare UI-Verhalten kommen aus JSON-Schemas, nicht aus View-Logik. `component_list.json` ist die einzige Quelle für `schemaPath`; Projekt-JSON speichert Komponenten-IDs und Laufzeitkonfiguration, keine Schemapfade. Schema-Anleitung: `docs/HOW_TO_CREATE_SCHEMA*.md`.
- **Versionierung nach SemVer** (`MAJOR.MINOR.PATCH`): `PATCH` = kompatible Fehlerbehebung, `MINOR` = kompatible neue Funktion, `MAJOR` = inkompatibel. In der `0.x`-Phase dürfen Breaking Changes in einem `MINOR`-Sprung kommen, müssen im `CHANGELOG.md` aber als **Breaking** markiert sein.
- **Version an genau einer Stelle je Komponente:** `smartesp-studio/config.json` (Add-on/Backend) und `smartesp-studio-frontend/package.json` (Frontend); beide werden zusammen angehoben.
- **CHANGELOG-Pflicht:** Jede nennenswerte Änderung kommt unter `[Unreleased]` in `CHANGELOG.md` (Format Keep a Changelog), jede Versionsanhebung bekommt einen Eintrag mit derselben Nummer.
- **Commits:** eine logische Änderung je Commit, Nachricht knapp und sachlich, Begründung („warum“) statt Diff-Nacherzählung; vor dem Commit die passenden Prüfungen oben laufen lassen. Bei Dockerfile-Änderungen das Image lokal bauen.
- **Schreibstil:** Code, Kommentare, Commits, PR-Beschreibungen und Doku so schreiben wie ein erfahrenes menschliches Teammitglied: kurz, direkt, im Stil und mit den Begriffen des bestehenden Codes; keine Floskeln, keine Marketing-Sprache, keine Meta-Erklärungen. Kommentare nur, wo sie das „Warum“ erklären. Bestehende Benennungen, Muster und Architektur beibehalten, keine unnötigen Abstraktionen.
- UX: `homelab:ux-regeln`, Prüfung mit dem Agenten `ux-pruefer`.

## Abweichungen vom homelab-Plugin

- **Fork eines öffentlichen Projekts:** Repo-Organisation, Lizenz (MIT, Urheber im `LICENSE.md`) und Verteilung über GHCR folgen dem Fork, nicht dem Schema `homelab-<system>`.
- **Keine Hinweise auf KI-Beteiligung** in Commits, PR-Beschreibungen, Code und Doku: Zeilen wie `Co-Authored-By: Claude …` oder „Generated with …“ hier **weglassen**, auch wenn eine Sitzung sie sonst anhängt.
- **SemVer und CHANGELOG-Pflicht** wie oben; Versionsangaben in `config.json` und `package.json`.
- **Kein `STATUS.md`/`PROJECTPLAN.md`:** Stand steht in `CHANGELOG.md`, Planung in `plans/`; `README.md` ist der öffentliche englische Überblick ohne Historien-Abschnitt. Ob `STATUS.md`/`PROJECTPLAN.md` ergänzt werden, ist offen (Entscheidung des Nutzers).
- **Sprache der öffentlichen Doku:** `README.md` und `CONTRIBUTING.md` bleiben englisch (öffentliches Repo); `CHANGELOG.md`, Pläne und Commits deutsch.
