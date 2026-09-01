import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LVGL_WIDGET_PARTS, LVGL_WIDGET_TYPES } from "./lvglWidgets";

// Structure guards for the shared LVGL schema chain every widget extends:
// widget -> lvgl_widget_common -> lvgl_widget_style -> lvgl_widget_layout ->
// lvgl_style_props, plus the top-level lvgl: options schema.
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
const readJson = (rel) => JSON.parse(readFileSync(resolve(publicDir, rel), "utf-8"));

const styleProps = readJson("schemas/components/base_component/lvgl_style_props.json");
const widgetStyle = readJson("schemas/components/base_component/lvgl_widget_style.json");
const widgetLayout = readJson("schemas/components/base_component/lvgl_widget_layout.json");
const topLevel = readJson("schemas/components/lvgl/lvgl_top_level.json");
const widgetCommon = readJson("schemas/components/base_component/lvgl_widget_common.json");
const widgetDir = "schemas/components/lvgl/widgets";
const widgetFiles = readdirSync(resolve(publicDir, widgetDir)).filter((f) => f.endsWith(".json"));

describe("lvgl widget style schema", () => {
  it("keeps the flat style props in a reusable object schema", () => {
    expect(styleProps.type).toBe("object");
    expect(styleProps.fields.every((f) => f.group === "style")).toBe(true);
    expect(styleProps.fields.map((f) => f.key)).toContain("bg_color");
  });

  it("chains the shared bases: widget style -> layout -> style props", () => {
    expect(widgetStyle.extends).toBe("lvgl_widget_layout.json");
    expect(widgetLayout.extends).toBe("lvgl_style_props.json");
  });

  it("groups the flex/grid + align_to fields under 'layout'", () => {
    const layoutKeys = widgetLayout.fields.filter((f) => f.group === "layout").map((f) => f.key);
    expect(layoutKeys).toContain("layout");
    expect(layoutKeys).toContain("align_to");
    expect(layoutKeys).toContain("flex_grow");
    expect(layoutKeys).toContain("grid_cell_column_pos");
    const layoutBlock = widgetLayout.fields.find((f) => f.key === "layout");
    expect(layoutBlock.type).toBe("object");
    expect(layoutBlock.fields.map((f) => f.key)).toEqual(
      expect.arrayContaining(["type", "flex_flow", "grid_columns", "grid_rows"])
    );
  });

  it("pulls the flat props in via extends and adds state/part blocks", () => {
    const states = widgetStyle.fields.filter((f) => f.group === "states");
    const parts = widgetStyle.fields.filter((f) => f.group === "parts");
    expect(states.map((f) => f.key)).toEqual(
      ["checked", "pressed", "focused", "disabled", "edited", "hovered", "scrolled"]
    );
    expect(parts.map((f) => f.key)).toEqual(
      ["indicator", "knob", "selected", "items", "ticks", "cursor", "scrollbar"]
    );
    for (const block of [...states, ...parts]) {
      expect(block.type).toBe("object");
      expect(block.extends).toBe("lvgl_style_props.json");
    }
  });
});

describe("lvgl widget common base", () => {
  const COMMON_KEYS = ["id", "x", "y", "width", "height", "align"];
  const STD_TRIGGERS = ["on_click", "on_press", "on_release", "on_long_press", "on_focus", "on_defocus"];

  it("carries the position/size fields, the initial state block and the shared trigger blocks", () => {
    expect(widgetCommon.extends).toBe("lvgl_widget_style.json");
    const keys = widgetCommon.fields.map((f) => f.key);
    expect(keys).toEqual([...COMMON_KEYS, "state", ...STD_TRIGGERS]);
    const state = widgetCommon.fields.find((f) => f.key === "state");
    expect(state.type).toBe("object");
    expect(state.fields.map((f) => f.key)).toEqual(
      expect.arrayContaining(["checked", "disabled"])
    );
  });

  it("no widget schema re-declares a common field or a standard trigger", () => {
    for (const file of widgetFiles) {
      const schema = readJson(`${widgetDir}/${file}`);
      expect(schema.extends, file).toBe("lvgl_widget_common.json");
      const keys = schema.fields.map((f) => f.key);
      for (const dup of [...COMMON_KEYS, ...STD_TRIGGERS]) {
        expect(keys, `${file} still declares ${dup}`).not.toContain(dup);
      }
    }
  });
});

describe("lvgl per-widget part map", () => {
  const definedParts = new Set(
    widgetStyle.fields.filter((f) => f.group === "parts").map((f) => f.key)
  );

  it("only references parts the shared style schema defines", () => {
    for (const [type, parts] of Object.entries(LVGL_WIDGET_PARTS)) {
      expect(LVGL_WIDGET_TYPES.has(type) || type === "obj", `${type} is a real widget type`).toBe(true);
      for (const part of parts) {
        expect(definedParts.has(part), `${type} references unknown part ${part}`).toBe(true);
      }
    }
  });
});

describe("lvgl top-level options schema", () => {
  it("curates the common lvgl: options and reuses the style props for style_definitions", () => {
    const keys = topLevel.fields.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining(["default_font", "disp_bg_color", "color_depth", "style_definitions"])
    );
    const styleDefs = topLevel.fields.find((f) => f.key === "style_definitions");
    expect(styleDefs.type).toBe("list");
    expect(styleDefs.item.extends).toBe("lvgl_style_props.json");
    expect(styleDefs.item.fields.map((f) => f.key)).toContain("id");
  });
});
