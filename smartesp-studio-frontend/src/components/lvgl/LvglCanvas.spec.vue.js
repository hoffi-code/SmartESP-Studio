// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LvglCanvas from "./LvglCanvas.vue";

const page = {
  id: "main",
  widgets: [
    { uiId: "a", type: "label", common: { x: 10, y: 20, width: 40, height: 12 }, props: { text: "Hi" }, children: [] },
    { uiId: "b", type: "switch", common: { align: "CENTER", width: 40, height: 24 }, props: {}, children: [] }
  ]
};

describe("LvglCanvas", () => {
  it("renders one positioned element per widget", () => {
    const wrapper = mount(LvglCanvas, { props: { page, canvasWidth: 200, canvasHeight: 200 } });
    const widgets = wrapper.findAll(".lvgl-canvas__widget");
    expect(widgets).toHaveLength(2);
    // zoom defaults to 1.5 -> x 10 * 1.5 = 15px
    expect(widgets[0].attributes("style")).toContain("left: 15px");
  });

  it("emits select with the widget uiId on pointerdown", async () => {
    const wrapper = mount(LvglCanvas, { props: { page, canvasWidth: 200, canvasHeight: 200 } });
    await wrapper.findAll(".lvgl-canvas__widget")[1].trigger("pointerdown");
    expect(wrapper.emitted("select").at(-1)).toEqual(["b"]);
  });

  it("clears the selection when the canvas background is clicked", async () => {
    const wrapper = mount(LvglCanvas, { props: { page, canvasWidth: 200, canvasHeight: 200, selectedId: "a" } });
    await wrapper.get(".lvgl-canvas").trigger("pointerdown");
    expect(wrapper.emitted("select").at(-1)).toEqual([""]);
  });

  it("emits resize-canvas from the toolbar size inputs", async () => {
    const wrapper = mount(LvglCanvas, { props: { page, canvasWidth: 200, canvasHeight: 200 } });
    const wInput = wrapper.findAll('input[type="number"]')[0];
    await wInput.setValue("320");
    await wInput.trigger("change");
    expect(wrapper.emitted("resize-canvas").at(-1)).toEqual([{ dim: "width", value: 320 }]);
  });

  it("flags a flex container's children as static (no drag)", () => {
    const flexPage = {
      id: "p",
      widgets: [
        {
          uiId: "row",
          type: "obj",
          common: { x: 0, y: 0, width: 120, height: 60 },
          extra: { flex_flow: "ROW" },
          props: {},
          children: [{ uiId: "c1", type: "label", common: {}, props: {}, children: [] }]
        }
      ]
    };
    const wrapper = mount(LvglCanvas, { props: { page: flexPage, canvasWidth: 200, canvasHeight: 200 } });
    const managed = wrapper.findAll(".lvgl-canvas__widget").find((w) => w.classes().includes("is-managed"));
    expect(managed).toBeTruthy();
    expect(managed.classes()).toContain("is-static");
  });
});
