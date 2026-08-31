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

const schemaContext = {
  loadWidgetSchema: async (type) => {
    if (type === "label") return labelSchema;
    if (type === "button") return buttonSchema;
    if (type === "image") return imageSchema;
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

  it("keeps a widget type without a loadWidgetSchema/loaded schema as an opaque raw-YAML node", async () => {
    const node = await parseWidgetNode({ slider: { id: "slider_1", width: 110 } }, schemaContext);

    expect(node.type).toBe("unsupported");
    expect(node.originalType).toBe("slider");
    expect(node.rawYaml).toContain("slider:");
    expect(node.rawYaml).toContain("id: slider_1");
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
