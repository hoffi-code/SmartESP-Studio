// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LvglBuilder from "./LvglBuilder.vue";

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

  it("adds a label widget to the active page and shows it in the inspector when clicked", async () => {
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });
    await wrapper.get("button").trigger("click");

    const addLabelButton = wrapper.findAll("button").find((btn) => btn.text() === "Add label");
    await addLabelButton.trigger("click");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets).toHaveLength(1);
    expect(patch.pages[0].widgets[0]).toMatchObject({ type: "label", props: { text: "Label" } });

    await wrapper.setProps({ lvglConfig: patch });
    await wrapper.get(".lvgl-tree-node__button").trigger("click");
    expect(wrapper.get("#schema-text").element.value).toBe("Label");
  });

  it("edits the selected label widget's text through the inspector", async () => {
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Old" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });
    await wrapper.get("button").trigger("click");
    await wrapper.get(".lvgl-tree-node__button").trigger("click");

    await wrapper.get("#schema-text").setValue("New text");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets[0].props.text).toBe("New text");
  });

  it("removes the selected widget", async () => {
    const widget = { uiId: "w1", type: "label", common: {}, props: { text: "Label" }, children: [] };
    const lvglConfig = { displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [{ id: "main_page", widgets: [widget] }] };
    const wrapper = mount(LvglBuilder, { props: { lvglConfig } });
    await wrapper.get("button").trigger("click");

    await wrapper.get(".lvgl-tree-node__button").trigger("click");
    const removeButton = wrapper.findAll("button").find((btn) => btn.text() === "Remove widget");
    await removeButton.trigger("click");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.pages[0].widgets).toEqual([]);
  });
});
