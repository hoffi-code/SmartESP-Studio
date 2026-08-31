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

  it("skips a widget whose schema has not been loaded rather than emitting it wrong", () => {
    const lvgl = {
      pages: [{ id: "main_page", widgets: [{ uiId: "w1", type: "label", common: {}, props: {}, children: [] }] }]
    };

    const lines = buildLvglYamlLines(lvgl, {});
    expect(lines.join("\n")).toBe(["lvgl:", "  pages:", "    - id: main_page", "      widgets:"].join("\n"));
  });
});
