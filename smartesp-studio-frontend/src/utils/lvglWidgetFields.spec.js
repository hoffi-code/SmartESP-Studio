import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LVGL_WIDGETS } from "./lvglWidgets";

// Guards the curated LVGL widget schemas against the ESPHome 2026.8.2 schema dump.
// Three checks:
//   1. every widget-specific *flat* config_var is modelled inline (or allowlisted);
//   2. every widget-specific *nested* config_var (lists / sub-schemas) is either
//      modelled, covered by the shared part/state style blocks, or allowlisted;
//   3. no curated widget-specific field is absent from the dump (typo / drift guard).
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const readJson = (rel) => JSON.parse(readFileSync(resolve(root, rel), "utf-8"));

const DUMP = readJson("docs/esphome-schema-reference/2026.8.2/lvgl.json");
const WIDGET_TYPES = DUMP.lvgl.schemas.WIDGET_TYPES.schema.config_vars;
const OBJ_KEYS = new Set(Object.keys(WIDGET_TYPES.obj.schema.config_vars));

// Part/state blocks the shared lvgl_widget_style.json chain exposes generically
// for every widget -- the dump lists them per type, we don't model them per type.
const SHARED_STYLE = readJson(
  "smartesp-studio-frontend/public/schemas/components/base_component/lvgl_widget_style.json"
);
const GENERIC_BLOCK_KEYS = new Set(SHARED_STYLE.fields.map((f) => f.key));

// Flat keys deliberately not modelled, with the reason.
const FLAT_ALLOW = {
  buttonmatrix: ["button_text_list_id"], // GeneratedID, internal
  image: ["rotation", "scale"], // deprecated aliases of angle / zoom
};

// Nested keys deliberately not modelled as a dedicated editor (they still
// round-trip verbatim via node.extra), with the reason.
const NESTED_ALLOW = {
  dropdown: ["dropdown_list"], // opened-list style block
  meter: ["pivot"], // needle pivot style block
  spinbox: ["textarea_placeholder"],
  textarea: ["textarea_placeholder"],
  tabview: ["tabs"], // held as WidgetNode.tabs (nested child widgets)
  tileview: ["tiles"], // held as WidgetNode.tiles
};

// Curated fields with no matching dump config_var, with the reason.
const EXTRA_ALLOW = {
  spinbox: ["step"], // real ESPHome option, absent from the 2026.8.2 config_vars
};

const widgetFile = (type) => {
  const entry = LVGL_WIDGETS.find((w) => w.type === type);
  return entry ? `smartesp-studio-frontend/public/schemas/${entry.schemaPath}` : null;
};

const curatedKeys = (type) => {
  const rel = widgetFile(type);
  if (!rel) return null;
  return new Set(readJson(rel).fields.map((f) => f.key));
};

const isNested = (def) =>
  def && typeof def === "object" && (def.is_list || def.type === "schema");

const cases = Object.keys(WIDGET_TYPES).filter(
  (t) => WIDGET_TYPES[t]?.schema?.config_vars && curatedKeys(t === "container" ? "obj" : t)
);

describe("curated LVGL widget schemas vs ESPHome 2026.8.2 dump", () => {
  it.each(cases)("%s models every widget-specific flat field", (type) => {
    const cv = WIDGET_TYPES[type].schema.config_vars;
    const have = curatedKeys(type === "container" ? "obj" : type);
    const allow = new Set(FLAT_ALLOW[type] || []);

    const missing = Object.keys(cv)
      .filter((k) => !OBJ_KEYS.has(k))
      .filter((k) => !isNested(cv[k]))
      .filter((k) => !have.has(k) && !allow.has(k));

    expect(missing, `${type} is missing flat fields`).toEqual([]);
  });

  it.each(cases)("%s models (or generically covers) every widget-specific nested block", (type) => {
    const cv = WIDGET_TYPES[type].schema.config_vars;
    const have = curatedKeys(type === "container" ? "obj" : type);
    const allow = new Set(NESTED_ALLOW[type] || []);

    const missing = Object.keys(cv)
      .filter((k) => !OBJ_KEYS.has(k))
      .filter((k) => isNested(cv[k]))
      .filter((k) => !have.has(k) && !GENERIC_BLOCK_KEYS.has(k) && !allow.has(k));

    expect(missing, `${type} is missing nested blocks`).toEqual([]);
  });

  it.each(cases)("%s declares no field the dump doesn't know", (type) => {
    const cv = WIDGET_TYPES[type].schema.config_vars;
    const have = curatedKeys(type === "container" ? "obj" : type);
    const allow = new Set(EXTRA_ALLOW[type] || []);

    const unknown = [...have].filter(
      (k) => !(k in cv) && !OBJ_KEYS.has(k) && !allow.has(k)
    );

    expect(unknown, `${type} declares unknown fields`).toEqual([]);
  });
});
