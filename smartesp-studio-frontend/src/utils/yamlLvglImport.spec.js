import { describe, expect, it } from "vitest";
import { parseLvglSection, parseWidgetNode } from "./yamlLvglImport";

const labelSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "align", type: "select", required: false, options: ["TOP_MID", "CENTER"] },
    { key: "y", type: "number", required: false },
    { key: "text", type: "text", required: false },
    { key: "text_color", type: "text", required: false }
  ]
};

const buttonSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "width", type: "number", required: false },
    { key: "height", type: "number", required: false },
    { key: "text", type: "text", required: false },
    { key: "checkable", type: "boolean", required: false },
    {
      key: "on_click",
      type: "list",
      required: false,
      item: { type: "object", fields: [], extends: "base_actions.json" }
    }
  ]
};

const homeassistantActionDefinition = {
  fields: [{ key: "action", type: "text", required: true }]
};

const imageSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "y", type: "number", required: false },
    { key: "src", type: "id_ref", required: false, domain: "image" },
    { key: "image_recolor", type: "text", required: false }
  ]
};

// Mirrors what lvgl_style_props.json resolves to: a nested style block reused by
// every state/part key on the widget style schema.
const styleBlockFields = [
  { key: "bg_color", type: "color", required: false },
  { key: "text_color", type: "color", required: false }
];

// Mirrors what lvgl_widget_layout.json resolves to for the flex/grid support.
const layoutFields = [
  {
    key: "layout",
    type: "object",
    required: false,
    group: "layout",
    fields: [
      { key: "type", type: "select", options: ["FLEX", "GRID", "NONE"] },
      { key: "flex_flow", type: "select", options: ["ROW", "ROW_WRAP"] },
      { key: "grid_columns", type: "list", item: { type: "text" } },
      { key: "grid_rows", type: "list", item: { type: "text" } }
    ]
  },
  {
    key: "align_to",
    type: "object",
    required: false,
    group: "layout",
    fields: [
      { key: "id", type: "id_ref", domain: "lvgl" },
      { key: "align", type: "select", options: ["OUT_BOTTOM_MID"] },
      { key: "x", type: "text" },
      { key: "y", type: "text" }
    ]
  },
  { key: "flex_grow", type: "text", required: false, group: "layout" },
  { key: "grid_cell_column_pos", type: "text", required: false, group: "layout" }
];

const sliderSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "width", type: "number", required: false },
    { key: "value", type: "text", required: false },
    { key: "min_value", type: "text", required: false },
    { key: "max_value", type: "text", required: false },
    { key: "mode", type: "select", required: false, options: ["NORMAL", "RANGE"] },
    { key: "on_value", type: "list", required: false, item: { type: "object", fields: [], extends: "base_actions.json" } },
    { key: "pressed", type: "object", required: false, group: "states", fields: styleBlockFields },
    { key: "checked", type: "object", required: false, group: "states", fields: styleBlockFields },
    { key: "indicator", type: "object", required: false, group: "parts", fields: styleBlockFields },
    { key: "knob", type: "object", required: false, group: "parts", fields: styleBlockFields },
    ...layoutFields
  ]
};

const objSchema = { fields: [{ key: "id", type: "id", required: false }, ...layoutFields] };

const switchSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "align", type: "select", required: false, options: ["CENTER"] },
    { key: "on_value", type: "list", required: false, item: { type: "object", fields: [], extends: "base_actions.json" } }
  ]
};

const dropdownSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "options", type: "list", required: false, item: { type: "text" } },
    { key: "selected_index", type: "text", required: false }
  ]
};

const qrcodeSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "text", type: "text", required: false },
    { key: "size", type: "text", required: false }
  ]
};

// A widget with no flat fields at all -- only common + a nested block (scales).
// Mirrors meter.json's scales -> ticks/indicators nesting (trimmed).
const meterSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    {
      key: "scales",
      type: "list",
      item: {
        type: "object",
        fields: [
          { key: "range_from", type: "text" },
          { key: "range_to", type: "text" },
          { key: "ticks", type: "object", fields: [{ key: "count", type: "text" }, { key: "color", type: "color" }] },
          {
            key: "indicators",
            type: "list",
            item: {
              type: "object",
              fields: [
                { key: "line", type: "object", fields: [{ key: "value", type: "text" }, { key: "color", type: "color" }] },
                { key: "arc", type: "object", fields: [{ key: "start_value", type: "text" }, { key: "end_value", type: "text" }] }
              ]
            }
          }
        ]
      }
    }
  ]
};

// Mirrors buttonmatrix.json's nested rows -> buttons -> control shape.
const buttonmatrixSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    {
      key: "rows",
      type: "list",
      required: false,
      item: {
        type: "object",
        fields: [
          {
            key: "buttons",
            type: "list",
            item: {
              type: "object",
              fields: [
                { key: "text", type: "text" },
                { key: "width", type: "text" },
                { key: "control", type: "object", fields: [{ key: "checkable", type: "boolean" }, { key: "disabled", type: "boolean" }] }
              ]
            }
          }
        ]
      }
    }
  ]
};

const lineSchema = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "points", type: "list", item: { type: "object", fields: [{ key: "x", type: "text" }, { key: "y", type: "text" }] } }
  ]
};

const schemaContext = {
  loadWidgetSchema: async (type) => {
    if (type === "label") return labelSchema;
    if (type === "button") return buttonSchema;
    if (type === "image") return imageSchema;
    if (type === "slider") return sliderSchema;
    if (type === "switch") return switchSchema;
    if (type === "dropdown") return dropdownSchema;
    if (type === "qrcode") return qrcodeSchema;
    if (type === "meter") return meterSchema;
    if (type === "obj") return objSchema;
    if (type === "buttonmatrix") return buttonmatrixSchema;
    if (type === "line") return lineSchema;
    return null;
  },
  loadActionCatalog: async () => [{ id: "homeassistant.action", schemaUrl: "actions/homeassistant/action.json" }],
  loadActionDefinition: async () => homeassistantActionDefinition
};

describe("parseWidgetNode", () => {
  it("parses a supported label widget with its common and text-specific fields", async () => {
    const node = await parseWidgetNode(
      { label: { id: "label_1", align: "TOP_MID", y: 8, text: "Couch", text_color: "0x3FFFFF" } },
      schemaContext
    );

    expect(node.type).toBe("label");
    expect(node.common).toMatchObject({ id: "label_1", align: "TOP_MID", y: 8 });
    expect(node.props).toEqual({ text: "Couch", text_color: "0x3FFFFF" });
    expect(node.children).toEqual([]);
  });

  it("parses a button widget's on_click action list through the shared action-catalog mapper", async () => {
    const node = await parseWidgetNode(
      {
        button: {
          id: "btn_1",
          width: 110,
          text: "Couch",
          on_click: [{ "homeassistant.action": { action: "switch.toggle" } }]
        }
      },
      schemaContext
    );

    expect(node.type).toBe("button");
    expect(node.common).toMatchObject({ id: "btn_1", width: 110 });
    expect(node.props.text).toBe("Couch");
    expect(node.props.on_click).toHaveLength(1);
    expect(node.props.on_click[0]).toMatchObject({ type: "homeassistant.action", config: { action: "switch.toggle" } });
  });

  it("parses a supported image widget", async () => {
    const node = await parseWidgetNode(
      { image: { id: "img_1", y: -8, src: "icon_couch", image_recolor: "0x3FFFFF" } },
      schemaContext
    );

    expect(node.type).toBe("image");
    expect(node.common).toMatchObject({ id: "img_1", y: -8 });
    expect(node.props).toEqual({ src: "icon_couch", image_recolor: "0x3FFFFF" });
  });

  it("parses a slider widget with its common/props split and value fields", async () => {
    const node = await parseWidgetNode(
      { slider: { id: "vol", width: 200, value: 40, min_value: 0, max_value: 100, mode: "NORMAL" } },
      schemaContext
    );

    expect(node.type).toBe("slider");
    expect(node.common).toMatchObject({ id: "vol", width: 200 });
    expect(node.props).toEqual({ value: 40, min_value: 0, max_value: 100, mode: "NORMAL" });
  });

  it("parses a switch on_value trigger through the shared action-catalog mapper", async () => {
    const node = await parseWidgetNode(
      { switch: { id: "sw", on_value: [{ "homeassistant.action": { action: "light.toggle" } }] } },
      schemaContext
    );

    expect(node.type).toBe("switch");
    expect(node.props.on_value).toHaveLength(1);
    expect(node.props.on_value[0]).toMatchObject({ type: "homeassistant.action", config: { action: "light.toggle" } });
  });

  it("parses a dropdown options list", async () => {
    const node = await parseWidgetNode(
      { dropdown: { id: "dd", options: ["One", "Two", "Three"], selected_index: 1 } },
      schemaContext
    );

    expect(node.type).toBe("dropdown");
    expect(node.props.options).toEqual(["One", "Two", "Three"]);
    expect(node.props.selected_index).toBe(1);
  });

  it("maps state and part style blocks into props instead of extra", async () => {
    const node = await parseWidgetNode(
      {
        slider: {
          id: "vol",
          value: 40,
          pressed: { bg_color: "0xFF0000" },
          indicator: { bg_color: "0x00FF00" },
          knob: { bg_color: "0x0000FF", text_color: "0xFFFFFF" }
        }
      },
      schemaContext
    );

    expect(node.props.value).toBe(40);
    expect(node.props.pressed).toEqual({ bg_color: "0xFF0000" });
    expect(node.props.indicator).toEqual({ bg_color: "0x00FF00" });
    expect(node.props.knob).toEqual({ bg_color: "0x0000FF", text_color: "0xFFFFFF" });
    expect(node.extra).toBeUndefined();
  });

  it("maps a button matrix's nested rows/buttons/control into props", async () => {
    const node = await parseWidgetNode(
      {
        buttonmatrix: {
          id: "bm",
          rows: [
            { buttons: [{ text: "A", control: { checkable: true } }, { text: "B", width: 2 }] },
            { buttons: [{ text: "C" }] }
          ]
        }
      },
      schemaContext
    );

    expect(node.type).toBe("buttonmatrix");
    expect(node.props.rows).toHaveLength(2);
    expect(node.props.rows[0].buttons[0]).toEqual({ text: "A", control: { checkable: true } });
    expect(node.props.rows[0].buttons[1]).toEqual({ text: "B", width: 2 });
    expect(node.props.rows[1].buttons).toEqual([{ text: "C" }]);
    expect(node.extra).toBeUndefined();
  });

  it("maps a line's points into props", async () => {
    const node = await parseWidgetNode(
      { line: { id: "ln", points: [{ x: 0, y: 0 }, { x: 40, y: 20 }] } },
      schemaContext
    );
    expect(node.props.points).toEqual([{ x: 0, y: 0 }, { x: 40, y: 20 }]);
    expect(node.extra).toBeUndefined();
  });

  it("keeps YAML keys the curated schema does not model in node.extra", async () => {
    const node = await parseWidgetNode(
      { slider: { id: "vol", value: 10, scales: [{ ticks: { count: 5 } }], scroll_dir: "VER" } },
      schemaContext
    );

    expect(node.type).toBe("slider");
    expect(node.props).toEqual({ value: 10 });
    expect(node.extra).toEqual({ scales: [{ ticks: { count: 5 } }], scroll_dir: "VER" });
  });

  it("maps flex/grid layout and align_to into props, not extra", async () => {
    const node = await parseWidgetNode(
      {
        obj: {
          id: "row",
          layout: { type: "FLEX", flex_flow: "ROW_WRAP" },
          align_to: { id: "header", align: "OUT_BOTTOM_MID", y: 4 }
        }
      },
      schemaContext
    );

    expect(node.type).toBe("obj");
    expect(node.props.layout).toEqual({ type: "FLEX", flex_flow: "ROW_WRAP" });
    expect(node.props.align_to).toEqual({ id: "header", align: "OUT_BOTTOM_MID", y: 4 });
    expect(node.extra).toBeUndefined();
  });

  it("maps per-child flex_grow / grid_cell placement into props", async () => {
    const node = await parseWidgetNode(
      { slider: { id: "vol", value: 10, flex_grow: 1, grid_cell_column_pos: 2 } },
      schemaContext
    );

    expect(node.props).toEqual({ value: 10, flex_grow: 1, grid_cell_column_pos: 2 });
    expect(node.extra).toBeUndefined();
  });

  it("parses a qrcode widget's flat fields", async () => {
    const node = await parseWidgetNode({ qrcode: { id: "qr", text: "https://x.y", size: 120 } }, schemaContext);
    expect(node.type).toBe("qrcode");
    expect(node.props).toEqual({ text: "https://x.y", size: 120 });
  });

  it("maps a meter's scales / ticks / indicators into props", async () => {
    const node = await parseWidgetNode(
      {
        meter: {
          id: "m",
          scales: [
            {
              range_from: 0,
              range_to: 100,
              ticks: { count: 11 },
              indicators: [{ line: { value: 40 } }, { arc: { start_value: 60, end_value: 100 } }]
            }
          ]
        }
      },
      schemaContext
    );
    expect(node.type).toBe("meter");
    expect(node.props.scales[0].ticks).toEqual({ count: 11 });
    expect(node.props.scales[0].indicators[0]).toEqual({ line: { value: 40 } });
    expect(node.props.scales[0].indicators[1]).toEqual({ arc: { start_value: 60, end_value: 100 } });
    expect(node.extra).toBeUndefined();
  });

  it("keeps a widget type outside the registry as an opaque raw-YAML node", async () => {
    const node = await parseWidgetNode({ chart: { id: "chart_1", width: 110 } }, schemaContext);

    expect(node.type).toBe("unsupported");
    expect(node.originalType).toBe("chart");
    expect(node.rawYaml).toContain("chart:");
    expect(node.rawYaml).toContain("id: chart_1");
    expect(node.children).toEqual([]);
  });

  it("falls back to unsupported for every widget when no schemaContext is given", async () => {
    const node = await parseWidgetNode({ label: { id: "label_1", text: "Couch" } });
    expect(node.type).toBe("unsupported");
    expect(node.originalType).toBe("label");
  });

  it("recurses into a supported widget's children", async () => {
    const node = await parseWidgetNode(
      { label: { id: "outer", widgets: [{ label: { id: "inner", text: "child" } }] } },
      schemaContext
    );

    expect(node.children).toHaveLength(1);
    expect(node.children[0].type).toBe("label");
    expect(node.children[0].props.text).toBe("child");
  });

  it("returns null for a malformed widget entry (not a single-key object)", async () => {
    expect(await parseWidgetNode({ label: {}, button: {} })).toBeNull();
    expect(await parseWidgetNode("not-an-object")).toBeNull();
  });
});

describe("parseLvglSection", () => {
  it("parses root config plus a page with a label widget", async () => {
    const lvgl = await parseLvglSection(
      {
        displays: ["main_display"],
        touchscreens: ["main_touchscreen"],
        buffer_size: "25%",
        bg_color: "0x000000",
        pages: [{ id: "main_page", widgets: [{ label: { id: "label_1", text: "Couch" } }] }]
      },
      schemaContext
    );

    expect(lvgl.displays).toEqual(["main_display"]);
    expect(lvgl.touchscreens).toEqual(["main_touchscreen"]);
    expect(lvgl.bufferSize).toBe("25%");
    expect(lvgl.bgColor).toBe("0x000000");
    expect(lvgl.pages).toHaveLength(1);
    expect(lvgl.pages[0].id).toBe("main_page");
    expect(lvgl.pages[0].widgets).toHaveLength(1);
    expect(lvgl.pages[0].widgets[0].type).toBe("label");
    expect(lvgl.options).toEqual({});
  });

  it("keeps unmapped top-level lvgl keys verbatim in options", async () => {
    const lvgl = await parseLvglSection(
      {
        bg_color: "0x000000",
        default_font: "roboto_20",
        style_definitions: [{ id: "big", text_font: "roboto_40" }],
        theme: { obj: { bg_color: 0x112233 } },
        pages: []
      },
      schemaContext
    );

    expect(lvgl.bgColor).toBe("0x000000");
    expect(lvgl.options).toEqual({
      default_font: "roboto_20",
      style_definitions: [{ id: "big", text_font: "roboto_40" }],
      theme: { obj: { bg_color: 0x112233 } }
    });
  });

  it("returns null when there is no lvgl section", async () => {
    expect(await parseLvglSection(undefined)).toBeNull();
    expect(await parseLvglSection("not-an-object")).toBeNull();
  });

  it("returns an empty pages array when lvgl has no pages", async () => {
    const lvgl = await parseLvglSection({ displays: ["main_display"] });
    expect(lvgl.pages).toEqual([]);
  });
});
