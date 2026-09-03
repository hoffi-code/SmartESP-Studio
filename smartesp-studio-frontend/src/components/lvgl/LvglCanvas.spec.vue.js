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

  it("draws each meter scale with ticks, major-tick labels, needle and arc", () => {
    const p = {
      id: "p",
      widgets: [
        {
          uiId: "m",
          type: "meter",
          common: { x: 0, y: 0, width: 60, height: 60 },
          props: {
            scales: [
              {
                range_from: 0,
                range_to: 100,
                ticks: { count: 6, major: { stride: 5 } },
                indicators: [
                  { line: { value: 40, color: "0xFF0000" } },
                  { arc: { start_value: 60, end_value: 100, color: "0x00FF00" } }
                ]
              },
              {
                range_from: 0,
                range_to: 10,
                ticks: { count: 3 }
              }
            ]
          },
          children: []
        }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    const svg = w.get(".lvgl-w--meter svg");
    // 6 + 3 scale ticks across the two scales
    expect(svg.findAll("line[stroke-width]")).toHaveLength(6 + 3 + 1); // + the needle
    // major ticks at i=0 and i=5 -> labels "0" and "100"
    const labels = svg.findAll("text.lvgl-canvas__meter-label").map((n) => n.text());
    expect(labels).toEqual(["0", "100"]);
    // one needle for the line indicator (red)
    expect(svg.findAll("line").some((l) => /#ff0000/i.test(l.attributes("stroke") || ""))).toBe(true);
    // one coloured arc for the arc indicator (green)
    expect(svg.findAll("path").some((pth) => /#00ff00/i.test(pth.attributes("stroke") || ""))).toBe(true);
  });

  it("reflects image transform, password mode and spinbox format", () => {
    const p = {
      id: "p",
      widgets: [
        { uiId: "im", type: "image", common: { x: 0, y: 0, width: 40, height: 40 }, props: { angle: 90, zoom: 512 }, children: [] },
        { uiId: "ta", type: "textarea", common: { x: 0, y: 50, width: 90, height: 20 }, props: { text: "secret", password_mode: true }, children: [] },
        { uiId: "sb", type: "spinbox", common: { x: 0, y: 80, width: 60, height: 20 }, props: { value: 1234, decimal_places: 2 }, children: [] }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });

    const imgStyle = w.get(".lvgl-w--image .lvgl-canvas__image").attributes("style");
    expect(imgStyle).toContain("rotate(90deg)");
    expect(imgStyle).toContain("scale(2)");
    expect(w.get(".lvgl-w--field .lvgl-canvas__field-text").text()).toBe("••••••");
    expect(w.findAll(".lvgl-w--field .lvgl-canvas__field-text")[1].text()).toBe("12.34");
  });

  it("switches which tab's widgets are laid out when a tab is clicked", async () => {
    const p = {
      id: "p",
      widgets: [
        {
          uiId: "tv",
          type: "tabview",
          common: { x: 0, y: 0, width: 200, height: 200 },
          props: {},
          children: [],
          tabs: [
            { uiId: "g1", name: "One", widgets: [{ uiId: "w-a", type: "label", common: {}, props: { text: "A" }, children: [] }] },
            { uiId: "g2", name: "Two", widgets: [{ uiId: "w-b", type: "label", common: {}, props: { text: "B" }, children: [] }] }
          ]
        }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 240, canvasHeight: 320 } });

    // tab 0 active by default
    expect(w.findAll(".lvgl-canvas__widget").some((el) => el.attributes("title") === "label")).toBe(true);
    const tabs = w.findAll(".lvgl-canvas__tabbar i");
    expect(tabs.map((t) => t.text())).toEqual(["One", "Two"]);
    expect(tabs[0].classes()).toContain("is-active");

    await tabs[1].trigger("pointerdown");
    expect(w.findAll(".lvgl-canvas__tabbar i")[1].classes()).toContain("is-active");
  });

  it("uses an explicit bg_color over the kind default", () => {
    const p = {
      id: "p",
      widgets: [{ uiId: "b", type: "button", common: { x: 0, y: 0, width: 60, height: 24 }, props: { text: "X", bg_color: "0xFF0000" }, children: [] }]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    expect(w.get(".lvgl-w--button").attributes("style")).toContain("background: rgb(255, 0, 0)");
  });

  it("paints the screen background from the display palette", () => {
    const w = mount(LvglCanvas, {
      props: {
        page,
        canvasWidth: 200,
        canvasHeight: 200,
        displayPalette: { background: "#102030" }
      }
    });
    expect(w.get(".lvgl-canvas").attributes("style")).toContain("background: rgb(16, 32, 48)");
  });

  it("renders strictly two-colour for a monochrome display", () => {
    const p = {
      id: "p",
      widgets: [{ uiId: "b", type: "button", common: { x: 0, y: 0, width: 60, height: 24 }, props: { text: "X", bg_color: "0xFF0000" }, children: [] }]
    };
    const w = mount(LvglCanvas, {
      props: {
        page: p,
        canvasWidth: 200,
        canvasHeight: 200,
        displayPalette: { monochrome: true, background: "#000000", foreground: "#e8f6ff" }
      }
    });
    expect(w.get(".lvgl-canvas").classes()).toContain("is-mono");
    // the explicit red bg_color does not reach the widget box in mono mode
    expect(w.get(".lvgl-w--button").attributes("style") || "").not.toContain("rgb(255, 0, 0)");
  });

  it("renders the real bitmap when lvglImageResolver resolves the src", () => {
    const p = {
      id: "p",
      widgets: [{ uiId: "im", type: "image", common: { x: 0, y: 0, width: 40, height: 40 }, props: { src: "logo" }, children: [] }]
    };
    const w = mount(LvglCanvas, {
      props: { page: p, canvasWidth: 200, canvasHeight: 200 },
      global: { provide: { lvglImageResolver: (id) => (id === "logo" ? "/api/assets/images/logo.png" : null) } }
    });
    expect(w.get(".lvgl-w--image img.lvgl-canvas__image-real").attributes("src")).toBe("/api/assets/images/logo.png");

    // no resolver -> placeholder icon
    const w2 = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    expect(w2.find(".lvgl-w--image img").exists()).toBe(false);
    expect(w2.find(".lvgl-w--image svg").exists()).toBe(true);
  });

  it("renders a real QR matrix from the widget text and falls back without text", () => {
    const p = {
      id: "p",
      widgets: [
        { uiId: "q1", type: "qrcode", common: { x: 0, y: 0, width: 60, height: 60 }, props: { text: "https://esphome.io", dark_color: "0x112233" }, children: [] },
        { uiId: "q2", type: "qrcode", common: { x: 0, y: 70, width: 60, height: 60 }, props: {}, children: [] }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    const widgets = w.findAll(".lvgl-w--qr");
    const svg = widgets[0].get("svg.lvgl-canvas__qr-svg");
    // a QR grid has at least 21x21 modules
    const vb = (svg.element.getAttribute("viewBox") || "").split(" ").map(Number);
    expect(vb[2]).toBeGreaterThanOrEqual(21);
    expect(svg.get("path").attributes("fill")).toBe("#112233");
    expect(svg.get("path").attributes("d").length).toBeGreaterThan(0);
    // no text -> neutral placeholder, no matrix svg
    expect(widgets[1].find("svg.lvgl-canvas__qr-svg").exists()).toBe(false);
    expect(widgets[1].find(".lvgl-canvas__qr").exists()).toBe(true);
  });

  it("renders a canvas widget as a sized placeholder, not an image glyph", () => {
    const p = {
      id: "p",
      widgets: [{ uiId: "cv", type: "canvas", common: { x: 0, y: 0, width: 80, height: 40 }, props: {}, children: [] }]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    expect(w.find(".lvgl-w--image").exists()).toBe(false);
    expect(w.get(".lvgl-w--canvas .lvgl-canvas__canvas-dims").text()).toBe("80×40");
  });

  it("drops hidden widgets and honours opa / text_align / line and arc widths", () => {
    const p = {
      id: "p",
      widgets: [
        { uiId: "gone", type: "label", common: { x: 0, y: 0 }, props: { text: "nope", hidden: true }, children: [] },
        { uiId: "lbl", type: "label", common: { x: 0, y: 20, width: 80, height: 14 }, props: { text: "R", text_align: "RIGHT", opa: "50%" }, children: [] },
        { uiId: "ln", type: "line", common: { x: 0, y: 40, width: 100, height: 30 }, props: { points: [{ x: 0, y: 0 }, { x: 100, y: 10 }], line_color: "0x00FF00", line_width: 5 }, children: [] },
        { uiId: "ar", type: "arc", common: { x: 0, y: 80, width: 50, height: 50 }, props: { value: 30, arc_width: 9 }, children: [] }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });

    const widgets = w.findAll(".lvgl-canvas__widget");
    expect(widgets).toHaveLength(3); // hidden label removed
    const lbl = w.get(".lvgl-w--label");
    expect(lbl.attributes("style")).toContain("opacity: 0.5");
    expect(lbl.get(".lvgl-canvas__label").attributes("style")).toContain("text-align: right");
    const poly = w.get(".lvgl-w--line polyline");
    expect(poly.attributes("stroke")).toBe("#00FF00");
    expect(poly.attributes("stroke-width")).toBe("5");
    expect(w.get(".lvgl-w--arc path").attributes("stroke-width")).toBe("9");
  });

  it("merges the checked/disabled state style block over the flat props", () => {
    const p = {
      id: "p",
      widgets: [
        {
          uiId: "sw",
          type: "switch",
          common: { x: 0, y: 0, width: 40, height: 24 },
          props: { state: { checked: true }, bg_color: "0x111111", checked: { bg_color: "0x00FF00" } },
          children: []
        },
        {
          uiId: "btn",
          type: "button",
          common: { x: 0, y: 40, width: 60, height: 24 },
          props: { text: "X", bg_color: "0x111111", disabled: { bg_color: "0x0000FF" } },
          children: []
        }
      ]
    };
    const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    // checked block wins over the flat bg_color
    expect(w.get(".lvgl-w--switch").attributes("style")).toContain("background: rgb(0, 255, 0)");
    // the disabled block only applies once the widget is actually disabled
    expect(w.get(".lvgl-w--button").attributes("style")).toContain("background: rgb(17, 17, 17)");

    p.widgets[1].props.state = { disabled: true };
    const w2 = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
    expect(w2.get(".lvgl-w--button").attributes("style")).toContain("background: rgb(0, 0, 255)");
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

  describe("simulatedState (P8 live binding)", () => {
    it("overrides a label's text with the bound entity's value", () => {
      const p = {
        id: "p",
        widgets: [{ uiId: "l", type: "label", common: { width: 80, height: 16 }, props: { text: "Hi", bind_id: "temp" }, children: [] }]
      };
      const simulatedState = { temp: { kind: "numeric", value: 21.5 } };
      const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200, simulatedState } });
      expect(w.get(".lvgl-canvas__label").text()).toBe("21.5");
    });

    it("overrides a bar's/slider's/arc's fill from the bound entity's value", () => {
      const p = {
        id: "p",
        widgets: [
          { uiId: "b", type: "bar", common: { width: 100, height: 12 }, props: { value: 0, min_value: 0, max_value: 100, bind_id: "temp" }, children: [] }
        ]
      };
      const simulatedState = { temp: { kind: "numeric", value: 75 } };
      const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200, simulatedState } });
      expect(w.get(".lvgl-canvas__bar-fill").attributes("style")).toContain("width: 75%");
    });

    it("overrides a switch's on-state from a bound boolean entity", () => {
      const p = {
        id: "p",
        widgets: [{ uiId: "s", type: "switch", common: { width: 40, height: 20 }, props: { bind_id: "relay" }, children: [] }]
      };
      const simulatedState = { relay: { kind: "boolean", value: true } };
      const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200, simulatedState } });
      expect(w.get(".lvgl-canvas__switch").classes()).toContain("is-on");
    });

    it("overrides a checkbox's checked-state from a bound struct entity's on field", () => {
      const p = {
        id: "p",
        widgets: [{ uiId: "c", type: "checkbox", common: { width: 90, height: 18 }, props: { text: "Lampe", bind_id: "lamp" }, children: [] }]
      };
      const simulatedState = { lamp: { kind: "struct", fields: { on: true } } };
      const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200, simulatedState } });
      expect(w.get(".lvgl-canvas__check-box").classes()).toContain("is-checked");
    });

    it("without a matching entity, the widget renders as if simulatedState were absent", () => {
      const p = {
        id: "p",
        widgets: [{ uiId: "l", type: "label", common: { width: 80, height: 16 }, props: { text: "Hi", bind_id: "missing" }, children: [] }]
      };
      const w = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200, simulatedState: {} } });
      expect(w.get(".lvgl-canvas__label").text()).toBe("Hi");
    });

    it("overrides the main scale's needle value on a meter", () => {
      const p = {
        id: "p",
        widgets: [
          {
            uiId: "m",
            type: "meter",
            common: { width: 100, height: 100 },
            props: {
              bind_id: "temp",
              scales: [{ range_from: 0, range_to: 100, indicators: [{ line: { value: 10, width: 4 } }] }]
            },
            children: []
          }
        ]
      };
      const withoutBinding = mount(LvglCanvas, { props: { page: p, canvasWidth: 200, canvasHeight: 200 } });
      const withBinding = mount(LvglCanvas, {
        props: { page: p, canvasWidth: 200, canvasHeight: 200, simulatedState: { temp: { kind: "numeric", value: 90 } } }
      });
      // Der Nadel-Endpunkt (needle tip) unterscheidet sich sichtbar, sobald der
      // simulierte Wert (90 statt 10) in die Winkelberechnung einfliesst. Ticks und
      // Nadel sind beides <line>-Elemente ohne eigene Klasse -- die Nadel ist die
      // letzte <line> in der Gruppe (Ticks werden zuerst gerendert).
      const tipOf = (wrapper) => wrapper.findAll(".lvgl-canvas__meter line").at(-1).attributes("x2");
      expect(tipOf(withBinding)).not.toBe(tipOf(withoutBinding));
    });
  });
});
