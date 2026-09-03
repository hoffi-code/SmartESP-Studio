// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import SimulationEntityTable from "./SimulationEntityTable.vue";

const fakeSimulation = (entities) => ({
  entities: ref(entities),
  setValue: vi.fn(),
  setField: vi.fn()
});

describe("SimulationEntityTable", () => {
  it("zeigt eine leere Meldung ohne Entities", () => {
    const wrapper = mount(SimulationEntityTable, { props: { simulation: fakeSimulation([]) } });
    expect(wrapper.text()).toContain("No simulatable entities");
  });

  it("rendert eine unsupported Entity gedimmt ohne Steuerelement", () => {
    const sim = fakeSimulation([{ id: "cam1", domain: "esp32_camera", kind: "unsupported", value: null, fields: null }]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });
    expect(wrapper.find(".sim-entity--dim").exists()).toBe(true);
    expect(wrapper.text()).toContain("not simulated");
  });

  it("boolean-Entity: Klick auf die Toggle-Pille setzt den invertierten Wert", async () => {
    const sim = fakeSimulation([{ id: "relay", domain: "switch", kind: "boolean", value: false, fields: null }]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });
    await wrapper.get("button").trigger("click");
    expect(sim.setValue).toHaveBeenCalledWith("relay", true);
  });

  it("numeric-Entity: Zahlenfeld-Aenderung ruft setValue mit der geparsten Zahl auf", async () => {
    const sim = fakeSimulation([{ id: "temp", domain: "sensor", kind: "numeric", value: 20, fields: null, filters: [] }]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });
    const numberInput = wrapper.find("input[type='number']");
    await numberInput.setValue(23.5);
    expect(sim.setValue).toHaveBeenCalledWith("temp", 23.5);
  });

  it("struct-Entity (light): Toggle setzt das on-Feld, Slider setzt brightness", async () => {
    const sim = fakeSimulation([{ id: "lamp", domain: "light", kind: "struct", value: null, fields: { on: false, brightness: 1 } }]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });

    await wrapper.get("button").trigger("click"); // Toggle
    expect(sim.setField).toHaveBeenCalledWith("lamp", "on", true);

    const slider = wrapper.find("input[type='range']");
    await slider.setValue("0.4");
    expect(sim.setField).toHaveBeenCalledWith("lamp", "brightness", 0.4);
  });

  it("struct-Entity (cover): Chip-Auswahl setzt das state-Feld", async () => {
    const sim = fakeSimulation([{ id: "blinds", domain: "cover", kind: "struct", value: null, fields: { position: 1, state: "open" } }]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });
    const chips = wrapper.findAll(".sim-chip-option");
    const closedChip = chips.find((chip) => chip.text() === "closed");
    await closedChip.trigger("click");
    expect(sim.setField).toHaveBeenCalledWith("blinds", "state", "closed");
  });

  it("text-Entity: rendert Eingabe + Chip mit dem aktuellen Wert", () => {
    const sim = fakeSimulation([{ id: "mode", domain: "select", kind: "text", value: "eco", fields: null }]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });
    expect(wrapper.find("input[type='text']").element.value).toBe("eco");
    expect(wrapper.find(".sim-chip").text()).toBe("eco");
  });

  it("zeigt eine Filter-Badge, wenn die Entity Filter traegt", () => {
    const sim = fakeSimulation([
      { id: "temp", domain: "sensor", kind: "numeric", value: 20, fields: null, filters: [{ type: "offset" }, { type: "clamp" }] }
    ]);
    const wrapper = mount(SimulationEntityTable, { props: { simulation: sim } });
    expect(wrapper.find(".sim-entity__filters-badge").text()).toContain("2");
  });
});
