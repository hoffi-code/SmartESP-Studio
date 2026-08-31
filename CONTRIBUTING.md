# Contributing

## Frontend (`smartesp-studio-frontend/`)

- Node via `.nvmrc` (22) / `engines.node` (`^20.19.0 || >=22.12.0`).
- `.npmrc` points at the public npm registry -- run `npm ci` against that, not a private proxy.
- `npm run lint` / `npm run lint:fix` -- ESLint (flat config, `vue/flat/essential` + `no-unused-vars`
  as a warning). Zero errors is the bar; warnings are pre-existing debt, don't need to be zero.
- `npm test` / `npm run test:watch` -- Vitest. `*.spec.js` runs under Node, `*.spec.dom.js` /
  `*.spec.vue.js` under jsdom (opt in per-file via a `// @vitest-environment jsdom` docblock --
  `environmentMatchGlobs` doesn't exist in Vitest 4).
- `npm run build` -- production build (`dist/`).
- `npm run dev` -- Vite dev server. Needs the backend running for most flows; see
  `smartesp-studio-frontend/README.md` for `VITE_DEV_OFFLINE` to work on schema-only changes
  without one.

## Backend (`smartesp-studio/`)

- `pip install -r requirements-dev.txt` (adds `pytest`, `ruff` on top of the runtime deps).
- `ruff check .` -- lint (`E`/`F`/`W`/`I`; `E501` line length ignored for now).
- `python -m pytest -q` -- unit + smoke tests (`tests/`).

## Commits / PRs

- One logical change per commit; keep the message body on the *why*, not a restatement of the diff.
- Run the relevant checks above before committing -- CI (`.github/workflows/checks.yml`) runs the
  same lint/test/build split for frontend and backend on every PR. The image build lives in a
  separate workflow (`.github/workflows/docker-standalone.yml`) that only runs on pushes to `main`
  and `v*.*.*` tags, not on PRs -- build it locally if you touched a Dockerfile (see below).
- `smartesp-studio/Dockerfile` (the Home Assistant add-on build) is currently not buildable -- see
  the comment at its top. Only `Dockerfile.standalone` (built from the repo root, see
  `.github/workflows/docker-standalone.yml`) is maintained right now.
