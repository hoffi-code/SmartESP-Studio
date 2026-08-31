# SmartESP Studio -- frontend

Vue 3 (Composition API, `<script setup>`), Vite, no TypeScript, no state-management package --
state lives in composables + `localStorage`.

## Views

- `BuilderView.vue` -- the config editor. Orchestration shell: tab components
  (`components/builder/*`) + composables (`composables/builder/*`) do the actual work. Owns the
  live YAML preview (`useBuilderYamlPreview`), the component catalog (`useBuilderComponentCatalog`),
  validation (`useBuilderValidation`), deployment/device-status polling (`useBuilderDeployment`),
  and save/persistence (`useBuilderProjectPersistence`).
- `DashboardView.vue` -- the project browser/tree. `useDashboardTree` (folder tree),
  `useDashboardDeviceStatus` (online/offline polling), `useDashboardYamlImport` (the two import
  flows), `useDashboardTileCustomization` (per-project icon/color overrides).

Display-configurator UI lives under `components/display/` (`DisplayBuilder.vue` +
`DisplayCanvas.vue` + `DisplayInspector*.vue`, backed by `composables/display/*`) -- a bespoke
editor for the `display:` lambda, not part of the generic schema-field system. `components/lvgl/`
is the same shell for `lvgl:` (`LvglBuilder.vue` = pages strip + widget tree + inspector, rendered
inline in the config frame like every other Builder tab), but the per-widget inspector is
schema-driven: `LvglWidgetInspectorGeneric.vue` renders the widget's JSON schema.
`utils/lvglWidgets.js` is the registry -- adding a widget type = one schema JSON under
`public/schemas/components/lvgl/widgets/` (`extends` `base_component/lvgl_widget_style.json` for the
shared style fields) + one `LVGL_WIDGETS` entry; import (`utils/yamlLvglImport.js`) and export
(`utils/schemaLvglYaml.js`) are generic. Widget schemas are curated subsets -- YAML keys they don't
model are round-tripped verbatim via `node.extra`. The inspector groups `group: "style"` fields and
`on_*` triggers into collapsible sections. A `Form` / `YAML` toggle in the tab header swaps the
form for an editable textarea of just the `lvgl:` block; `Apply` re-parses it via `parseLvglSection`
(same loaders as the project importer, pulled from `schemaLoader.js`) and replaces `config.lvgl` --
lossy for props outside a curated schema (kept in `node.extra`) and does not preserve comments.
`buildLvglYamlLines` stamps each widget's preview lines
with an `lvgl:page:<i>:widget:<uiId>` origin, so clicking an LVGL line in the YAML preview selects
that widget (`BuilderView.activateYamlOriginScope` -> `LvglBuilder.externalSelect`) and an inspector
edit pulses the matching preview line back (`field-edit` -> `lvglPreviewPulse` -> `useBuilderPreview`).

## Import/export pipeline

`utils/yamlProjectImport.js` (import) and `utils/schemaYaml.js` (export) are the generic
schema-driven mapper both directions go through for ordinary component fields. `on_*` actions and
conditions route through `utils/schemaActionImport.js`/`schemaConditionImport.js` and the
shared action/condition catalogs, recursively (works the same whether it's a component's
`on_state`, an LVGL button's `on_click`, or a nested `if/then/else`). `lvgl:` gets its own bespoke
import/export pair (`utils/yamlLvglImport.js`/`utils/schemaLvglYaml.js`) since it's a recursive
widget tree the generic field mapper doesn't model -- `display:` follows the same "own
serializer, own non-emitted config key" pattern inline within `schemaYaml.js`/
`yamlProjectImport.js` rather than a separate module pair.

## API access

`utils/api.js` (`apiUrl`/`apiFetch`/`unwrapJson`/`apiJson`) centralizes the ingress/base-URL/
`credentials` handling every backend call needs. Route new fetches through it rather than raw
`fetch()`.

## Dev vs. add-on runtime

- `npm run dev` talks to a real backend by default -- point it at a running
  `smartesp-studio` instance (standalone container or `python server.py` locally).
- `VITE_DEV_OFFLINE=1 npm run dev` (dev builds only) makes schema/catalog loading read straight
  from `public/schemas/` and `public/components_list/` instead of the backend's
  `/api/component-schemas/...` route -- useful for schema/catalog-only work without a backend up.
- In production (standalone image or the HA add-on), the built frontend is served by the Flask app
  itself; there's no separate dev server.

## Checks

`npm run lint`, `npm test`, `npm run build` -- see `CONTRIBUTING.md` at the repo root.
