// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorGraph from "./DisplayInspectorGraph.vue";

const baseElement = () => ({
  type: "graph",
  x: 0,
  y: 0,
  w: 200,
  h: 100,
  graphId: "graph_1",
  duration: "24h",
  sensor: "sensor.temp",
  useTraces: false,
  legendEnabled: false
});

const dynamicIds = [{ id: "sensor.temp", label: "Temperature", domain: "sensor" }];

describe("DisplayInspectorGraph", () => {
  it("shows the single-sensor select when not using traces", () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: { selectedElement: baseElement(), dynamicIds }
    });

    expect(wrapper.find("#graphSensor").exists()).toBe(true);
    expect(wrapper.find(".display-trace-list").exists()).toBe(false);
  });

  it("shows the trace list instead of the single-line controls when useTraces is on", () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: { selectedElement: { ...baseElement(), useTraces: true, traces: [] }, dynamicIds }
    });

    expect(wrapper.find("#graphSensor").exists()).toBe(false);
    expect(wrapper.find(".display-trace-list").exists()).toBe(true);
    expect(wrapper.text()).toContain("No traces added.");
  });

  it("adds a trace via the Add trace button", async () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: { selectedElement: { ...baseElement(), useTraces: true, traces: [] }, dynamicIds }
    });

    await wrapper.get("button.secondary.compact").trigger("click");
    expect(wrapper.emitted("update")[0][0].traces).toHaveLength(1);
  });

  it("flags a missing graph ID as invalid", () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: { selectedElement: { ...baseElement(), graphId: "" }, dynamicIds }
    });

    expect(wrapper.get("#graphId").classes()).toContain("field-error");
  });

  it("does not lock aspect ratio on width/height changes", async () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: { selectedElement: baseElement(), dynamicIds }
    });

    await wrapper.get("#sizeW").setValue("300");
    expect(wrapper.emitted("update")).toEqual([[{ w: 300 }]]);
  });

  it("renders the legend panel only once the legend checkbox is enabled", () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: { selectedElement: baseElement(), dynamicIds }
    });
    expect(wrapper.find(".display-legend").exists()).toBe(false);

    const withLegend = mount(DisplayInspectorGraph, {
      props: { selectedElement: { ...baseElement(), legendEnabled: true }, dynamicIds }
    });
    expect(withLegend.find(".display-legend").exists()).toBe(true);
  });

  it("applies default legend fonts the first time the legend is toggled on", async () => {
    const wrapper = mount(DisplayInspectorGraph, {
      props: {
        selectedElement: baseElement(),
        dynamicIds,
        localFonts: [{ file: "Roboto-Regular.ttf", label: "Roboto Regular" }]
      }
    });

    await wrapper.get("#graphLegend").setValue(true);
    const patch = wrapper.emitted("update")[0][0];
    expect(patch.legendEnabled).toBe(true);
    expect(patch.legendNameFontFile).toBe("Roboto-Regular.ttf");
    expect(patch.legendValueFontFile).toBe("Roboto-Regular.ttf");
  });
});
