// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorShape from "./DisplayInspectorShape.vue";

const baseElement = () => ({
  type: "shape",
  shapeType: "rect",
  rotation: 0,
  filled: false,
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  color: ""
});

describe("DisplayInspectorShape", () => {
  it("renders the shape fields from the selected element", () => {
    const wrapper = mount(DisplayInspectorShape, {
      props: { selectedElement: baseElement(), isMonochrome: true }
    });

    expect(wrapper.get("#shapeType").element.value).toBe("rect");
    expect(wrapper.get("#posX").element.value).toBe("10");
    expect(wrapper.get("#sizeW").element.value).toBe("30");
    expect(wrapper.find("#shapeColor").exists()).toBe(false);
  });

  it("hides the filled checkbox for line shapes and shows the line hint", () => {
    const wrapper = mount(DisplayInspectorShape, {
      props: { selectedElement: { ...baseElement(), shapeType: "line" }, isMonochrome: true }
    });

    expect(wrapper.find("#filled").exists()).toBe(false);
    expect(wrapper.text()).toContain("Line uses X/Y and W/H as end point.");
  });

  it("shows the color picker when not monochrome and emits color updates", async () => {
    const wrapper = mount(DisplayInspectorShape, {
      props: { selectedElement: baseElement(), isMonochrome: false }
    });

    const colorInput = wrapper.get("#shapeColor");
    await colorInput.setValue("#ff0000");
    expect(wrapper.emitted("update")).toEqual([[{ color: "#ff0000" }]]);
  });

  it("emits a plain numeric update for X without aspect-ratio locking", async () => {
    const wrapper = mount(DisplayInspectorShape, {
      props: { selectedElement: baseElement(), isMonochrome: true }
    });

    await wrapper.get("#posX").setValue("15");
    expect(wrapper.emitted("update")).toEqual([[{ x: 15 }]]);
  });

  it("toggles filled via the checkbox", async () => {
    const wrapper = mount(DisplayInspectorShape, {
      props: { selectedElement: baseElement(), isMonochrome: true }
    });

    await wrapper.get("#filled").setValue(true);
    expect(wrapper.emitted("update")).toEqual([[{ filled: true }]]);
  });
});
