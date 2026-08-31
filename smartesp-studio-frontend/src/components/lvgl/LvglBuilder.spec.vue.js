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
    await clickByText(wrapper, "Remove widget");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets).toEqual([]);
  });
});
