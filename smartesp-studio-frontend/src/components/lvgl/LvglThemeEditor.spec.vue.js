// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import LvglThemeEditor from "./LvglThemeEditor.vue";

const styleFields = [{ key: "bg_color", type: "text" }];

const mountEditor = (modelValue = {}) =>
  mount(LvglThemeEditor, { props: { modelValue, styleFields } });

describe("LvglThemeEditor", () => {
  it("shows a section per widget type already present in the value", () => {
    const wrapper = mountEditor({ button: { bg_color: "0xff0000" }, label: {} });
    const summaries = wrapper.findAll(".lvgl-theme-editor__type > summary span").map((s) => s.text());
    expect(summaries).toEqual(["button", "label"]); // alphabetical, "obj" first when present
  });

  it("adds a chosen widget type as a new section", async () => {
    const wrapper = mountEditor();
    expect(wrapper.find(".lvgl-theme-editor__type").exists()).toBe(false);
    await wrapper.get("select").setValue("slider");
    await wrapper.get(".lvgl-theme-editor__add button").trigger("click");
    expect(wrapper.get(".lvgl-theme-editor__type > summary span").text()).toBe("slider");
  });

  it("emits a theme-scoped path when a style prop is edited", async () => {
    const wrapper = mountEditor({ button: {} });
    await wrapper.get(".lvgl-theme-editor__type input[type='text']").setValue("0x112233");
    expect(wrapper.emitted("update").at(-1)).toEqual([
      { path: ["theme", "button", "bg_color"], value: "0x112233" }
    ]);
  });

  it("emits an undefined value to drop a persisted type, but not for a locally-added one", async () => {
    const persisted = mountEditor({ button: { bg_color: "x" } });
    await persisted.get(".lvgl-theme-editor__type > summary button").trigger("click");
    expect(persisted.emitted("update").at(-1)).toEqual([{ path: ["theme", "button"], value: undefined }]);

    const local = mountEditor();
    await local.get("select").setValue("arc");
    await local.get(".lvgl-theme-editor__add button").trigger("click");
    await local.get(".lvgl-theme-editor__type > summary button").trigger("click");
    expect(local.emitted("update")).toBeUndefined();
    expect(local.find(".lvgl-theme-editor__type").exists()).toBe(false);
  });
});
