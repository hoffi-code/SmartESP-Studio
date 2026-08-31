import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The widget style schema every LVGL widget extends: flat main-part style props
// (via extends) plus one nested block per interactive state and per sub-part.
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
const readJson = (rel) => JSON.parse(readFileSync(resolve(publicDir, rel), "utf-8"));

const styleProps = readJson("schemas/components/base_component/lvgl_style_props.json");
const widgetStyle = readJson("schemas/components/base_component/lvgl_widget_style.json");
const widgetLayout = readJson("schemas/components/base_component/lvgl_widget_layout.json");

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
