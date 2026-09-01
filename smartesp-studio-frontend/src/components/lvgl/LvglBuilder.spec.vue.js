// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import LvglBuilder from "./LvglBuilder.vue";

// Minimal label schema so the generic inspector renders its fields without a backend.
const LABEL_SCHEMA = {
  fields: [
    { key: "id", type: "id", required: false },
    { key: "x", type: "text", required: false },
    { key: "y", type: "text", required: false },
    { key: "width", type: "text", required: false },
    { key: "height", type: "text", required: false },
    { key: "align", type: "select", required: false, options: ["TOP_LEFT", "CENTER"] },
    { key: "text", type: "text", required: false }
  ]
};
const widgetSchemas = { label: LABEL_SCHEMA };

// The YAML editor's Apply path runs parseLvglSection, which pulls widget schemas +
// action catalog through schemaLoader's fetch. Stub it to the label schema.
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = async (url = "") => {
    const path = String(url);
    let body = {};
    if (path.includes("/lvgl/widgets/label.json")) body = LABEL_SCHEMA;
    else if (path.includes("catalog") || path.includes("actions") || path.includes("conditions")) body = { actions: [], conditions: [] };
    return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => body, text: async () => JSON.stringify(body) };
  };
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const clickByText = async (wrapper, text) => {
  const button = wrapper.findAll("button").find((btn) => btn.text() === text);
  await button.trigger("click");
};

const addWidget = async (wrapper, type) => {
  await wrapper.get("select.lvgl-widget-type-select").setValue(type);
  await clickByText(wrapper, "Add");
};

describe("LvglBuilder", () => {
  it("seeds an empty lvgl config on mount when none exists yet", () => {
    const wrapper = mount(LvglBuilder, { props: { lvglConfig: null } });

    expect(wrapper.emitted("update")).toHaveLength(1);
    expect(wrapper.emitted("update")[0][0]).toEqual({
      displays: [],
      touchscreens: [],
      bufferSize: "",
      bgColor: "",
      options: {},
      pages: []
    });
    // Rendered inline in the config frame -- no modal backdrop.
    expect(wrapper.find(".lvgl-config-backdrop").exists()).toBe(false);
    expect(wrapper.find(".lvgl-page-list").exists()).toBe(true);
  });

  it("shows the YAML block only from the Advanced mode level up", () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] };
    const simple = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Simple" } });
    expect(simple.find("textarea.lvgl-yaml-editor").exists()).toBe(false);

    const normal = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Normal" } });
    expect(normal.find("textarea.lvgl-yaml-editor").exists()).toBe(false);

    const advanced = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Advanced" } });
    expect(advanced.find("textarea.lvgl-yaml-editor").exists()).toBe(true);
  });

  it("does not re-seed an existing lvgl config", () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("adds a page and selects it", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });

    await clickByText(wrapper, "Add page");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages).toHaveLength(1);
    expect(patch.pages[0]).toEqual({ id: "page_0", widgets: [] });
  });

  it("adds a widget of the picked type to the active page", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });

    await addWidget(wrapper, "label");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets).toHaveLength(1);
    expect(patch.pages[0].widgets[0]).toMatchObject({ type: "label", props: { text: "Label" } });

    await wrapper.setProps({ lvglConfig: patch });
    await wrapper.get(".lvgl-tree-node__button").trigger("click");
    expect(wrapper.get("#schema-text").element.value).toBe("Label");
  });

  it("edits the selected widget's text through the generic inspector", async () => {
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Old" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });
    await wrapper.get(".lvgl-tree-node__button").trigger("click");

    await wrapper.get("#schema-text").setValue("New text");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets[0].props.text).toBe("New text");
  });

  it("re-emits field-edit with the widget scopeId when the inspector changes a field", async () => {
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Old" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });
    await wrapper.get(".lvgl-tree-node__button").trigger("click");

    await wrapper.get("#schema-text").setValue("New text");

    const edit = wrapper.emitted("field-edit").at(-1)[0];
    expect(edit).toEqual({ scopeId: "lvgl:page:0:widget:w1", path: ["text"] });
  });

  it("selects a page + widget from an external-select command", async () => {
    const widgetA = { uiId: "w1", type: "label", common: {}, props: { text: "A" }, children: [] };
    const widgetB = { uiId: "w2", type: "label", common: {}, props: { text: "B" }, children: [] };
    const lvglConfig = {
      displays: [],
      touchscreens: [],
      bufferSize: "",
      bgColor: "",
      pages: [
        { id: "page_0", widgets: [widgetA] },
        { id: "page_1", widgets: [widgetB] }
      ]
    };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });

    await wrapper.setProps({ externalSelect: { pageIndex: 1, uiId: "w2", token: 1 } });

    expect(wrapper.get("#schema-text").element.value).toBe("B");
  });

  it("mirrors the current lvgl config into the YAML editor", () => {
    const widget = { uiId: "w1", type: "label", common: { id: "hi" }, props: { text: "Couch" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Advanced" } });

    const text = wrapper.get("textarea.lvgl-yaml-editor").element.value;
    expect(text).toContain("lvgl:");
    expect(text).toContain("- id: main_page");
    expect(text).toContain("- label:");
    expect(text).toContain('text: "Couch"');
  });

  it("applies edited YAML back into config.lvgl", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Advanced" } });

    await wrapper.get("textarea.lvgl-yaml-editor").setValue(
      ["lvgl:", "  buffer_size: 25%", "  pages:", "    - id: renamed", "      widgets:", "        - label:", '            text: "Hi"'].join("\n")
    );
    await clickByText(wrapper, "Apply");
    await new Promise((r) => setTimeout(r, 0));

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.bufferSize).toBe("25%");
    expect(patch.pages[0].id).toBe("renamed");
    expect(patch.pages[0].widgets[0]).toMatchObject({ type: "label", props: { text: "Hi" } });
  });

  it("shows an error and keeps the draft when the YAML is invalid", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Advanced" } });

    await wrapper.get("textarea.lvgl-yaml-editor").setValue("lvgl:\n  pages:\n   - id: x\n  bad: [unclosed");
    await clickByText(wrapper, "Apply");
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.get(".lvgl-yaml-editor__error").text().length).toBeGreaterThan(0);
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("removes the selected widget", async () => {
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Label" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });

    await wrapper.get(".lvgl-tree-node__button").trigger("click");
    await clickByText(wrapper, "Remove");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets).toEqual([]);
  });

  const twoWidgetConfig = () => ({
    displays: [],
    touchscreens: [],
    bufferSize: "",
    bgColor: "",
    options: {},
    pages: [
      {
        id: "main_page",
        widgets: [
          { uiId: "w1", type: "label", common: {}, props: { text: "A" }, children: [] },
          { uiId: "w2", type: "label", common: {}, props: { text: "B" }, children: [] }
        ]
      }
    ]
  });

  it("adds the picked type as a child of the selected widget", async () => {
    const wrapper = mount(LvglBuilder, { props: { lvglConfig: twoWidgetConfig(), widgetSchemas } });
    await wrapper.findAll(".lvgl-tree-node__button")[0].trigger("click");
    await clickByText(wrapper, "+ child");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets[0].children).toHaveLength(1);
    expect(patch.pages[0].widgets[0].children[0]).toMatchObject({ type: "label" });
  });

  it("reorders a widget among its siblings", async () => {
    const wrapper = mount(LvglBuilder, { props: { lvglConfig: twoWidgetConfig(), widgetSchemas } });
    await wrapper.findAll(".lvgl-tree-node__button")[1].trigger("click"); // select w2
    await clickByText(wrapper, "↑");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets.map((w) => w.uiId)).toEqual(["w2", "w1"]);
  });

  it("nests a widget under its previous sibling and pulls it back out", async () => {
    const wrapper = mount(LvglBuilder, { props: { lvglConfig: twoWidgetConfig(), widgetSchemas } });
    await wrapper.findAll(".lvgl-tree-node__button")[1].trigger("click"); // select w2
    await clickByText(wrapper, "⇥");

    let patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets.map((w) => w.uiId)).toEqual(["w1"]);
    expect(patch.pages[0].widgets[0].children.map((w) => w.uiId)).toEqual(["w2"]);

    await wrapper.setProps({ lvglConfig: patch });
    await wrapper.findAll(".lvgl-tree-node__button")[1].trigger("click"); // select nested w2
    await clickByText(wrapper, "⇤");

    patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets.map((w) => w.uiId)).toEqual(["w1", "w2"]);
    expect(patch.pages[0].widgets[0].children).toEqual([]);
  });

  it("shows a static preview canvas (no toolbar) and opens the edit modal on click", async () => {
    // schema with a style-grouped field so the inspector renders a <details> section
    const styleSchema = { fields: [...LABEL_SCHEMA.fields, { key: "bg_color", type: "text", group: "style" }] };
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Hi" }, children: [] };
    const lvglConfig = {
      displays: [], touchscreens: [], bufferSize: "", bgColor: "", options: {},
      pages: [{ id: "main_page", widgets: [widget] }]
    };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas: { label: styleSchema } } });

    expect(wrapper.find(".lvgl-canvas-preview .lvgl-canvas__toolbar").exists()).toBe(false);
    expect(wrapper.find(".lvgl-editor-modal").exists()).toBe(false);

    await wrapper.get(".lvgl-canvas-preview").trigger("click");
    expect(wrapper.find(".lvgl-editor-modal").exists()).toBe(true);
    // modal canvas is the interactive one -> toolbar present
    expect(wrapper.find(".lvgl-editor-modal .lvgl-canvas__toolbar").exists()).toBe(true);
    // modal inspector groups are expanded
    await wrapper.get(".lvgl-editor-modal .lvgl-canvas__widget").trigger("pointerdown");
    expect(wrapper.find(".lvgl-editor-modal details[open]").exists()).toBe(true);

    await wrapper.get(".lvgl-editor-modal__backdrop").trigger("click");
    expect(wrapper.find(".lvgl-editor-modal").exists()).toBe(false);
  });

  it("keeps the YAML editor inside the Form panel and Advanced-only", () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", options: {}, pages: [] };
    const simple = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });
    expect(simple.find(".lvgl-config-panel--inspector textarea.lvgl-yaml-editor").exists()).toBe(false);

    const advanced = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas, activeModeLevel: "Advanced" } });
    expect(advanced.find(".lvgl-config-panel--inspector textarea.lvgl-yaml-editor").exists()).toBe(true);
  });

  it("edits an unsupported widget's raw YAML", async () => {
    const lvglConfig = {
      displays: [],
      touchscreens: [],
      bufferSize: "",
      bgColor: "",
      options: {},
      pages: [
        {
          id: "main_page",
          widgets: [{ uiId: "u1", type: "unsupported", originalType: "chart", rawYaml: "chart:\n  id: chart_1", children: [] }]
        }
      ]
    };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });
    await wrapper.get(".lvgl-tree-node__button").trigger("click");

    const area = wrapper.get("textarea.lvgl-raw-yaml-editor__area");
    expect(area.element.value).toBe("chart:\n  id: chart_1");
    await area.setValue("chart:\n  id: chart_1\n  width: 120");
    await clickByText(wrapper, "Apply");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets[0].rawYaml).toContain("width: 120");
    expect(patch.pages[0].widgets[0].originalType).toBe("chart");
  });
});
