// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import BuilderComponentRequirementsNotice from "./BuilderComponentRequirementsNotice.vue";

describe("BuilderComponentRequirementsNotice", () => {
  it("renders nothing when no requirement labels are set", () => {
    const wrapper = mount(BuilderComponentRequirementsNotice);
    expect(wrapper.find(".component-bus-note").exists()).toBe(false);
  });

  it("shows the bus requirement and emits focus-bus on click", async () => {
    const wrapper = mount(BuilderComponentRequirementsNotice, {
      props: { activeComponentBusLabels: "I2C" }
    });

    expect(wrapper.text()).toContain("I2C is configured correctly");

    await wrapper.find(".preview-callout-link").trigger("click");
    expect(wrapper.emitted("focus-bus")).toHaveLength(1);
  });

  it("shows multiple requirement sections together", () => {
    const wrapper = mount(BuilderComponentRequirementsNotice, {
      props: {
        activeComponentBusLabels: "I2C",
        activeComponentProtocolLabels: "MQTT",
        activeComponentSystemLabels: "",
        activeComponentNetworkLabels: "",
        activeComponentComponentLabels: "sensor"
      }
    });

    const text = wrapper.text();
    expect(text).toContain("I2C is configured correctly");
    expect(text).toContain("MQTT is configured correctly");
    expect(text).toContain("sensor components are configured correctly");
  });
});
