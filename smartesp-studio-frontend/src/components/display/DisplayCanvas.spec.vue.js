// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayCanvas from "./DisplayCanvas.vue";

const textElement = (overrides = {}) => ({
  id: "el1",
  type: "text",
  x: 0,
  y: 0,
  w: 60,
  h: 10,
  text: "Static",
  textMode: "dynamic",
  dynamicId: "temp",
  dynamicDomain: "sensor",
  prefix: "",
  suffix: "",
  ...overrides
});

const mountCanvas = (element, extraProps = {}) =>
  mount(DisplayCanvas, {
    props: { screenW: 128, screenH: 64, elements: [element], ...extraProps }
  });

describe("DisplayCanvas - dynamic text label", () => {
  it("falls back to the {{val}} placeholder without simulatedState (Regression, keine Aenderung ausserhalb der Simulation)", () => {
    const wrapper = mountCanvas(textElement());
    expect(wrapper.get(".display-element__label--text span").text()).toBe("{{val}}");
  });

  it("falls back to the placeholder when the bound entity is missing from simulatedState", () => {
    const wrapper = mountCanvas(textElement(), { simulatedState: {} });
    expect(wrapper.get(".display-element__label--text span").text()).toBe("{{val}}");
  });

  it("resolves a numeric entity's value, with prefix/suffix applied", () => {
    const wrapper = mountCanvas(textElement({ prefix: "T: ", suffix: "°C" }), {
      simulatedState: { temp: { kind: "numeric", value: 21.567 } }
    });
    expect(wrapper.get(".display-element__label--text span").text()).toBe("T: 21.57°C");
  });

  it("keeps an integer numeric value without decimals", () => {
    const wrapper = mountCanvas(textElement(), { simulatedState: { temp: { kind: "numeric", value: 20 } } });
    expect(wrapper.get(".display-element__label--text span").text()).toBe("20");
  });

  it("resolves a boolean entity as ON/OFF", () => {
    const wrapper = mountCanvas(textElement({ dynamicId: "relay", dynamicDomain: "switch" }), {
      simulatedState: { relay: { kind: "boolean", value: true } }
    });
    expect(wrapper.get(".display-element__label--text span").text()).toBe("ON");
  });

  it("resolves a text entity's string value", () => {
    const wrapper = mountCanvas(textElement({ dynamicId: "mode", dynamicDomain: "select" }), {
      simulatedState: { mode: { kind: "text", value: "eco" } }
    });
    expect(wrapper.get(".display-element__label--text span").text()).toBe("eco");
  });

  it("a static text element is unaffected by simulatedState", () => {
    const wrapper = mountCanvas(textElement({ textMode: "static", text: "Hello" }), {
      simulatedState: { temp: { kind: "numeric", value: 99 } }
    });
    expect(wrapper.get(".display-element__label--text span").text()).toBe("Hello");
  });
});
