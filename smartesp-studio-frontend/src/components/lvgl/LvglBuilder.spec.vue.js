// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
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

const addWidget = async (wrapper, type) => {
  await wrapper.get("select.lvgl-widget-type-select").setValue(type);
  const addButton = wrapper.findAll("button").find((btn) => btn.text() === "Add");
  await addButton.trigger("click");
};

describe("LvglBuilder", () => {
  it("initializes an empty lvgl config the first time the modal is opened", async () => {
    const wrapper = mount(LvglBuilder, { props: { lvglConfig: null } });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("update")).toHaveLength(1);
    expect(wrapper.emitted("update")[0][0]).toEqual({
      displays: [],
      touchscreens: [],
      bufferSize: "",
      bgColor: "",
      pages: []
    });
    expect(wrapper.find(".lvgl-config-backdrop").exists()).toBe(true);
  });

  it("does not re-initialize an existing lvgl config when opened again", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("adds a page and selects it", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });
    await wrapper.get("button").trigger("click");

    await wrapper.get("button.secondary.compact").trigger("click");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages).toHaveLength(1);
    expect(patch.pages[0]).toEqual({ id: "page_0", widgets: [] });
  });

  it("adds a widget of the picked type to the active page", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });
    await wrapper.get("button").trigger("click");

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
    await wrapper.get("button").trigger("click");
    await wrapper.get(".lvgl-tree-node__button").trigger("click");

    await wrapper.get("#schema-text").setValue("New text");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets[0].props.text).toBe("New text");
  });

  it("removes the selected widget", async () => {
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Label" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig, widgetSchemas } });
    await wrapper.get("button").trigger("click");

    await wrapper.get(".lvgl-tree-node__button").trigger("click");
    const removeButton = wrapper.findAll("button").find((btn) => btn.text() === "Remove widget");
    await removeButton.trigger("click");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets).toEqual([]);
  });
});
