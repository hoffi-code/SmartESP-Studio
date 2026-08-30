// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorIcon from "./DisplayInspectorIcon.vue";

const baseElement = () => ({
  type: "icon",
  x: 10,
  y: 20,
  w: 30,
  h: 40,
  icon: "mdi:home-thermometer",
  color: ""
});

const mdiIcons = ["home-thermometer", "thermometer"];

describe("DisplayInspectorIcon", () => {
  it("renders position/size fields and the icon value", () => {
    const wrapper = mount(DisplayInspectorIcon, {
      props: { selectedElement: baseElement(), isMonochrome: true, mdiIcons }
    });

    expect(wrapper.get("#posX").element.value).toBe("10");
    expect(wrapper.get("#sizeW").element.value).toBe("30");
    expect(wrapper.get("#iconValue").element.value).toBe("mdi:home-thermometer");
    expect(wrapper.find("#iconColor").exists()).toBe(false);
  });

  it("flags an unknown icon name as invalid", () => {
    const wrapper = mount(DisplayInspectorIcon, {
      props: { selectedElement: { ...baseElement(), icon: "mdi:not-a-real-icon" }, isMonochrome: true, mdiIcons }
    });

    expect(wrapper.get("#iconValue").classes()).toContain("field-error");
    expect(wrapper.text()).toContain("Invalid MDI icon name.");
  });

  it("shows the color picker when not monochrome and emits color updates", async () => {
    const wrapper = mount(DisplayInspectorIcon, {
      props: { selectedElement: baseElement(), isMonochrome: false, mdiIcons }
    });

    const colorInput = wrapper.get("#iconColor");
    await colorInput.setValue("#00ff00");
    expect(wrapper.emitted("update")).toEqual([[{ color: "#00ff00" }]]);
  });

  it("keeps the aspect ratio locked when width changes", async () => {
    const wrapper = mount(DisplayInspectorIcon, {
      props: { selectedElement: baseElement(), isMonochrome: true, mdiIcons }
    });

    await wrapper.get("#sizeW").setValue("60");
    expect(wrapper.emitted("update")).toEqual([[{ w: 60, h: 80 }]]);
  });

  it("keeps the aspect ratio locked when height changes", async () => {
    const wrapper = mount(DisplayInspectorIcon, {
      props: { selectedElement: baseElement(), isMonochrome: true, mdiIcons }
    });

    await wrapper.get("#sizeH").setValue("20");
    expect(wrapper.emitted("update")).toEqual([[{ w: 15, h: 20 }]]);
  });
});
