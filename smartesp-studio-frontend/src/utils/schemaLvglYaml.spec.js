import { describe, expect, it } from "vitest";
import { buildLvglYamlLines } from "./schemaLvglYaml";

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
    expect(lines.join("\n")).toBe(
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
    const text = lines.join("\n");
    expect(text).toContain("widgets:");
    expect(text).toContain("- button:");
    expect(text).toContain("id: btn_1");
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

    const lines = buildLvglYamlLines(lvgl, { button: buttonSchema });
    const text = lines.join("\n");
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

    const text = buildLvglYamlLines(lvgl, { slider: sliderSchema }).join("\n");
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

    const text = buildLvglYamlLines(lvgl, { slider: sliderSchema }).join("\n");
    expect(text).toContain("value: 10");
    expect(text).toContain("scales:");
    expect(text).toContain("count: 5");
    expect(text).toContain("flex_grow: 1");
  });

  it("skips a widget whose schema has not been loaded rather than emitting it wrong", () => {
    const lvgl = {
      pages: [{ id: "main_page", widgets: [{ uiId: "w1", type: "label", common: {}, props: {}, children: [] }] }]
    };

    const lines = buildLvglYamlLines(lvgl, {});
    expect(lines.join("\n")).toBe(["lvgl:", "  pages:", "    - id: main_page", "      widgets:"].join("\n"));
  });
});
