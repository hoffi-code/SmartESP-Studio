import { describe, expect, it } from "vitest";
import { buildLvglYamlLines } from "./schemaLvglYaml";

const asText = (lines) => lines.map((line) => line.text).join("\n");

const labelSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "align", type: "select", required: false, options: ["TOP_MID", "CENTER"] },
    { key: "y", type: "number", required: false },
    { key: "text", type: "text", required: false },
    { key: "text_color", type: "text", required: false }
  ]
};

describe("buildLvglYamlLines", () => {
  it("returns nothing when there is no lvgl config", () => {
    expect(buildLvglYamlLines(null)).toEqual([]);
  });

  it("emits root config plus a page with a label widget", () => {
    const lvgl = {
      displays: ["main_display"],
      touchscreens: ["main_touchscreen"],
      bufferSize: "25%",
      bgColor: "0x000000",
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "label",
              common: { id: "label_1", align: "TOP_MID", y: 8 },
              props: { text: "Couch", text_color: "0x3FFFFF" },
              children: []
            }
          ]
        }
      ]
    };

    const lines = buildLvglYamlLines(lvgl, { label: labelSchema });
    expect(asText(lines)).toBe(
      [
        "lvgl:",
        "  displays:",
        "    - main_display",
        "  touchscreens:",
        "    - main_touchscreen",
        "  buffer_size: 25%",
        "  bg_color: 0x000000",
        "  pages:",
        "    - id: main_page",
        "      widgets:",
        "        - label:",
        "            id: label_1",
        "            align: TOP_MID",
        "            y: 8",
        '            text: "Couch"',
        '            text_color: "0x3FFFFF"'
      ].join("\n")
    );
  });

  it("tags widget lines with an lvgl scopeId and per-field origin paths", () => {
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "label",
              common: { id: "label_1" },
              props: { text: "Couch" },
              children: []
            }
          ]
        }
      ]
    };

    const lines = buildLvglYamlLines(lvgl, { label: labelSchema });
    const headerLine = lines.find((line) => line.text.trim() === "- label:");
    expect(headerLine.origin).toMatchObject({
      owner: "lvgl",
      type: "section",
      scopeId: "lvgl:page:0:widget:w1",
      tabKey: "lvgl"
    });

    const textLine = lines.find((line) => line.text.trim() === 'text: "Couch"');
    expect(textLine.origin).toMatchObject({ scopeId: "lvgl:page:0:widget:w1", path: ["text"] });

    const idLine = lines.find((line) => line.text.trim() === "id: label_1");
    expect(idLine.origin).toMatchObject({ scopeId: "lvgl:page:0:widget:w1", path: ["id"] });

    // Root/page structural lines stay unclickable.
    expect(lines.find((line) => line.text === "lvgl:").origin).toBeNull();
    expect(lines.find((line) => line.text === "    - id: main_page").origin).toBeNull();
  });

  it("emits an unsupported widget as an opaque raw block, nested under its parent", () => {
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "label",
              common: { id: "outer" },
              props: {},
              children: [
                { uiId: "w2", type: "unsupported", originalType: "button", rawYaml: "button:\n  id: btn_1", children: [] }
              ]
            }
          ]
        }
      ]
    };

    const lines = buildLvglYamlLines(lvgl, { label: labelSchema });
    const text = asText(lines);
    expect(text).toContain("widgets:");
    expect(text).toContain("- button:");
    expect(text).toContain("id: btn_1");
  });

  it("emits child widgets nested under an unsupported node", () => {
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "u1",
              type: "unsupported",
              originalType: "chart",
              rawYaml: "chart: {}",
              children: [{ uiId: "w2", type: "label", common: { id: "lbl" }, props: { text: "Hi" }, children: [] }]
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { label: labelSchema }));
    expect(text).toContain("- chart:");
    expect(text).not.toContain("chart: {}");
    expect(text).toMatch(/chart:\n\s+widgets:\n\s+- label:/);
    expect(text).toContain('text: "Hi"');
  });

  it("emits a button widget's on_click action list through the existing generic action renderer", () => {
    const buttonSchema = {
      fields: [
        { key: "id", type: "id", required: false },
        { key: "width", type: "number", required: false },
        { key: "text", type: "text", required: false },
        {
          key: "on_click",
          type: "list",
          required: false,
          item: { type: "object", fields: [], extends: "base_actions.json" }
        }
      ]
    };
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "button",
              common: { id: "btn_1", width: 110 },
              props: {
                text: "Couch",
                on_click: [{ type: "homeassistant.action", config: { action: "switch.toggle" }, fields: [{ key: "action", type: "text" }] }]
              },
              children: []
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { button: buttonSchema }));
    expect(text).toContain("- button:");
    expect(text).toContain("id: btn_1");
    expect(text).toContain("on_click:");
    expect(text).toContain('- homeassistant.action: "switch.toggle"');
  });

  it("emits a slider widget's value fields and an on_value trigger", () => {
    const sliderSchema = {
      fields: [
        { key: "id", type: "id", required: false },
        { key: "value", type: "text", required: false },
        { key: "max_value", type: "text", required: false },
        {
          key: "on_value",
          type: "list",
          required: false,
          item: { type: "object", fields: [], extends: "base_actions.json" }
        }
      ]
    };
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "slider",
              common: { id: "vol", width: 200 },
              props: {
                value: 40,
                max_value: 100,
                on_value: [{ type: "homeassistant.action", config: { action: "light.toggle" }, fields: [{ key: "action", type: "text" }] }]
              },
              children: []
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { slider: sliderSchema }));
    expect(text).toContain("- slider:");
    expect(text).toContain("id: vol");
    expect(text).toContain("value: 40");
    expect(text).toContain("max_value: 100");
    expect(text).toContain("on_value:");
    expect(text).toContain('- homeassistant.action: "light.toggle"');
  });

  it("re-emits node.extra keys the curated schema does not model", () => {
    const sliderSchema = { fields: [{ key: "id", type: "id" }, { key: "value", type: "text" }] };
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "slider",
              common: { id: "vol" },
              props: { value: 10 },
              extra: { scales: [{ ticks: { count: 5 } }], flex_grow: 1 },
              children: []
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { slider: sliderSchema }));
    expect(text).toContain("value: 10");
    expect(text).toContain("scales:");
    expect(text).toContain("count: 5");
    expect(text).toContain("flex_grow: 1");
  });

  it("emits nested state and part style blocks from props", () => {
    const styleBlockFields = [
      { key: "bg_color", type: "color" },
      { key: "text_color", type: "color" }
    ];
    const sliderSchema = {
      fields: [
        { key: "id", type: "id" },
        { key: "value", type: "text" },
        { key: "pressed", type: "object", group: "states", fields: styleBlockFields },
        { key: "knob", type: "object", group: "parts", fields: styleBlockFields }
      ]
    };
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "slider",
              common: { id: "vol" },
              props: { value: 40, pressed: { bg_color: "0xFF0000" }, knob: { bg_color: "0x0000FF" } },
              children: []
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { slider: sliderSchema }));
    expect(text).toContain("pressed:");
    expect(text).toContain('bg_color: "0xFF0000"');
    expect(text).toContain("knob:");
    expect(text).toContain('bg_color: "0x0000FF"');
  });

  it("emits a flex/grid layout block and per-child placement from props", () => {
    const objSchema = {
      fields: [
        { key: "id", type: "id" },
        {
          key: "layout",
          type: "object",
          group: "layout",
          fields: [
            { key: "type", type: "select", options: ["FLEX", "GRID"] },
            { key: "grid_columns", type: "list", item: { type: "text" } }
          ]
        },
        { key: "flex_grow", type: "text", group: "layout" }
      ]
    };
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "w1",
              type: "obj",
              common: { id: "grid" },
              props: { layout: { type: "GRID", grid_columns: ["FR(1)", "FR(1)"] } },
              children: [
                { uiId: "w2", type: "obj", common: { id: "cell" }, props: { flex_grow: 1 }, children: [] }
              ]
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { obj: objSchema }));
    expect(text).toContain("layout:");
    expect(text).toContain("type: GRID");
    expect(text).toContain("grid_columns:");
    expect(text).toContain('- "FR(1)"');
    expect(text).toContain("flex_grow: 1");
  });

  it("emits top-level options verbatim between bg_color and pages", () => {
    const lvgl = {
      bgColor: "0x000000",
      options: { default_font: "roboto_20", style_definitions: [{ id: "big", text_font: "roboto_40" }] },
      pages: [{ id: "main_page", widgets: [] }]
    };
    const text = asText(buildLvglYamlLines(lvgl, {}));
    expect(text).toContain("  bg_color: 0x000000");
    expect(text).toContain("  default_font: roboto_20");
    expect(text).toContain("  style_definitions:");
    expect(text).toContain("    - id: big");
    expect(text.indexOf("default_font")).toBeLessThan(text.indexOf("pages:"));
  });

  it("emits a tabview's tabs with nested widgets", () => {
    const tabviewSchema = { fields: [{ key: "id", type: "id" }, { key: "position", type: "text" }] };
    const lvgl = {
      pages: [
        {
          id: "main_page",
          widgets: [
            {
              uiId: "tv",
              type: "tabview",
              common: { id: "tv" },
              props: { position: "top" },
              children: [],
              tabs: [
                { name: "One", widgets: [{ uiId: "l1", type: "label", common: { id: "l1" }, props: { text: "A" }, children: [] }] },
                { name: "Two", widgets: [] }
              ]
            }
          ]
        }
      ]
    };

    const text = asText(buildLvglYamlLines(lvgl, { tabview: tabviewSchema, label: labelSchema }));
    expect(text).toContain("- tabview:");
    expect(text).toContain('position: "top"');
    expect(text).toContain("tabs:");
    expect(text).toContain("- name: One");
    expect(text).toMatch(/- name: One\n\s+widgets:\n\s+- label:/);
    expect(text).toContain('text: "A"');
    expect(text).toContain("- name: Two");
  });

  it("skips a widget whose schema has not been loaded rather than emitting it wrong", () => {
    const lvgl = {
      pages: [{ id: "main_page", widgets: [{ uiId: "w1", type: "label", common: {}, props: {}, children: [] }] }]
    };

    const lines = buildLvglYamlLines(lvgl, {});
    expect(asText(lines)).toBe(["lvgl:", "  pages:", "    - id: main_page", "      widgets:"].join("\n"));
  });
});
