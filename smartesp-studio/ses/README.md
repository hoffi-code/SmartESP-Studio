# `ses` module map

`server.py` at the repo root is a 3-line entry point (`from ses import config, create_app;
app = create_app()` + a `waitress`/`app.run` `__main__` block). Everything else lives here.

| Module | What's in it |
|---|---|
| `config.py` | Env-derived settings (`SES_*`), storage paths, regexes, `is_truthy` -- the single patch point for tests (`ses.config.<NAME>`). |
| `logging.py` | `basicConfig` + `get_logger` (`SES_LOG_LEVEL`-controlled). |
| `errors.py` | `json_error`, the HTTP/unexpected-exception handlers registered in `create_app()`. |
| `io.py` | Filesystem helpers: `read/write_json(_atomic)`, `write_text_file_atomic`, log tail reading, `bootstrap_storage`, filename/path normalization. |
| `serial_ports.py` | Host-serial allow-list, listing, validation for the "Serial (this computer)" install path. |
| `catalog.py` | Component catalog: normalize/merge entries, ZIP-import of custom components, catalog item lookups. |
| `projects.py` | `projects.json` index: load/save, add/remove/rename entries. |
| `assets.py` | Asset store: manifest, upload/rename/delete, MDI glyph substitutions. |
| `devices.py` | Device registry, key normalization, mDNS probing, ping/connectivity checks, `build_device_response`. |
| `auth.py` | Ingress access check + standalone basic auth; `resolve_web_root`/`resolve_secrets_path`. |
| `esphome.py` | `Job`/`JobManager` (the compile/flash/OTA job queue + worker thread), `format_sse`. |
| `routes/` | One Flask blueprint per functional group -- `health`, `projects`, `yaml_files`, `assets`, `components`, `devices`, `imports`, `secrets`, `jobs`, `ui`. Registered in `create_app()` (`__init__.py`), which also wires the `before_request` hooks (OPTIONS preflight, standalone basic auth) and error handlers app-wide. |

`job_manager = JobManager()` is created in `create_app()` and hangs off `app.extensions["job_manager"]`
(not a module global) -- each `create_app()` call gets its own, isolated instance. Job routes read it
via `current_app.extensions["job_manager"]`.

See `REFACTORING.md` at the repo root (§8, "B1") for how this split came about.
