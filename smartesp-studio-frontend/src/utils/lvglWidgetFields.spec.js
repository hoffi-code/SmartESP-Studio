import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LVGL_WIDGETS } from "./lvglWidgets";

// Guards the curated LVGL widget schemas against the ESPHome 2026.8.2 schema dump:
// every widget-specific *flat* config_var the dump lists must be modelled inline
// (or be on the deliberate allowlist below). Nested lists / sub-schemas are
// tracked by the vertiefung plan (P2-P4), not here.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const readJson = (rel) => JSON.parse(readFileSync(resolve(root, rel), "utf-8"));

const DUMP = readJson("docs/esphome-schema-reference/2026.8.2/lvgl.json");
const WIDGET_TYPES = DUMP.lvgl.schemas.WIDGET_TYPES.schema.config_vars;
const OBJ_KEYS = new Set(Object.keys(WIDGET_TYPES.obj.schema.config_vars));

// Flat keys deliberately not modelled yet, with the reason.
const ALLOW = {
  buttonmatrix: ["button_text_list_id"], // GeneratedID, internal
  image: ["rotation", "scale"], //  deprecated aliases of angle / zoom
  // nested style sub-blocks (covered by the shared style/state schema, P-plan)
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

describe("curated LVGL widget schemas vs ESPHome 2026.8.2 dump", () => {
  const cases = Object.keys(WIDGET_TYPES)
    .filter((t) => WIDGET_TYPES[t]?.schema?.config_vars && curatedKeys(t === "container" ? "obj" : t));

  it.each(cases)("%s models every widget-specific flat field", (type) => {
    const cv = WIDGET_TYPES[type].schema.config_vars;
    const have = curatedKeys(type === "container" ? "obj" : type);
    const allow = new Set(ALLOW[type] || []);

    const missing = Object.keys(cv)
      .filter((k) => !OBJ_KEYS.has(k)) // widget-specific only
      .filter((k) => {
        const v = cv[k];
        return !(v && typeof v === "object" && (v.is_list || v.type === "schema")); // flat only
      })
      .filter((k) => !have.has(k) && !allow.has(k));

    expect(missing, `${type} is missing flat fields`).toEqual([]);
  });
});
