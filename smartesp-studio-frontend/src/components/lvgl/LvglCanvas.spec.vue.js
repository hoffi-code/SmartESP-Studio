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

  it("hides the toolbar and does not drag in preview mode", async () => {
    const wrapper = mount(LvglCanvas, {
      props: { page, canvasWidth: 200, canvasHeight: 200, selectedId: "a", interactive: false }
    });
    expect(wrapper.find(".lvgl-canvas__toolbar").exists()).toBe(false);

    // clicking a widget still selects it (so the parent can open the modal on it)
    await wrapper.findAll(".lvgl-canvas__widget")[0].trigger("pointerdown");
    expect(wrapper.emitted("select").at(-1)).toEqual(["a"]);
    // ...but no drag is wired up
    expect(wrapper.emitted("move")).toBeUndefined();
  });

  it("renders a kind-specific look per widget type", () => {
    const p = {
      id: "mix",
      widgets: [
        { uiId: "btn", type: "button", common: { x: 0, y: 0, width: 60, height: 24 }, props: { text: "OK" }, children: [] },
        { uiId: "sw", type: "switch", common: { x: 0, y: 30, width: 40, height: 20 }, props: { state: "on" }, children: [] },
        { uiId: "sl", type: "slider", common: { x: 0, y: 60, width: 100, height: 12 }, props: { value: 50 }, children: [] },
        { uiId: "cb", type: "checkbox", common: { x: 0, y: 80, width: 90, height: 18 }, props: { text: "A", state: true }, children: [] },
        { uiId: "dd", type: "dropdown", common: { x: 0, y: 100, width: 90, height: 22 }, props: { options: ["One", "Two"], selected_index: 1 }, children: [] },
        { uiId: "ar", type: "arc", common: { x: 0, y: 130, width: 50, height: 50 }, props: { value: 25 }, children: [] },
        { uiId: "ld", type: "led", common: { x: 0, y: 190, width: 16, height: 16 }, props: {}, children: [] }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 240, canvasHeight: 320 } });

    expect(w.get(".lvgl-w--button .lvgl-canvas__btn-label").text()).toBe("OK");
    expect(w.get(".lvgl-w--switch .lvgl-canvas__switch").classes()).toContain("is-on");
    expect(w.get(".lvgl-w--bar .lvgl-canvas__bar-fill").attributes("style")).toContain("width: 50%");
    expect(w.get(".lvgl-w--bar .lvgl-canvas__bar-knob").exists()).toBe(true);
    expect(w.get(".lvgl-w--checkbox .lvgl-canvas__check-box").classes()).toContain("is-checked");
    expect(w.get(".lvgl-w--dropdown .lvgl-canvas__dropdown-text").text()).toBe("Two");
    expect(w.find(".lvgl-w--arc svg.lvgl-canvas__arc").exists()).toBe(true);
    expect(w.get(".lvgl-w--led .lvgl-canvas__led").attributes("style")).toContain("rgb(255, 0, 0)");
  });

  it("renders a button matrix from its rows and a line from its points", () => {
    const p = {
      id: "p",
      widgets: [
        {
          uiId: "bm",
          type: "buttonmatrix",
          common: { x: 0, y: 0, width: 120, height: 60 },
          props: { rows: [{ buttons: [{ text: "A" }, { text: "B" }] }, { buttons: [{ text: "C" }] }] },
          children: []
        },
        {
          uiId: "ln",
          type: "line",
          common: { x: 0, y: 70, width: 100, height: 40 },
          props: { points: [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 0 }] },
          children: []
        }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 240, canvasHeight: 320 } });

    const cells = w.findAll(".lvgl-w--btnmatrix .lvgl-canvas__btnrow i");
    expect(cells.map((c) => c.text())).toEqual(["A", "B", "C"]);
    expect(w.get(".lvgl-w--line polyline").attributes("points").split(" ")).toHaveLength(3);
  });

  it("uses an explicit bg_color over the kind default", () => {
    const p = {
      id: "p",
      widgets: [{ uiId: "b", type: "button", common: { x: 0, y: 0, width: 60, height: 24 }, props: { text: "X", bg_color: "0xFF0000" }, children: [] }]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    expect(w.get(".lvgl-w--button").attributes("style")).toContain("background: rgb(255, 0, 0)");
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
