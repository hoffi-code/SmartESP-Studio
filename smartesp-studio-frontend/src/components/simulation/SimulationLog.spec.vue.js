// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import SimulationLog from "./SimulationLog.vue";

const fakeSimulation = ({ log = [], runs = [], manualFilters = [] } = {}) => ({
  log: ref(log),
  runs: ref(runs),
  manualFilters: ref(manualFilters),
  resumeManual: vi.fn(),
  resolveManualFilter: vi.fn()
});

describe("SimulationLog", () => {
  it("zeigt eine leere Meldung ohne Eintraege", () => {
    const wrapper = mount(SimulationLog, { props: { simulation: fakeSimulation() } });
    expect(wrapper.text()).toContain("No events yet");
  });

  it("rendert Eintraege neueste zuerst mit passendem Chip", () => {
    const sim = fakeSimulation({
      log: [
        { id: 1, tick: 0, kind: "trigger", sourceLabel: "Relay", triggerKey: "on_press" },
        { id: 2, tick: 500, kind: "executed", sourceLabel: "Relay", triggerKey: "on_press", text: "switch.turn_on" }
      ]
    });
    const wrapper = mount(SimulationLog, { props: { simulation: sim } });
    const rows = wrapper.findAll(".sim-log__row");
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("executed");
    expect(rows[1].text()).toContain("Trigger");
  });

  it("bietet Wahr/Falsch-Buttons fuer eine manuelle Bedingung eines aktiven Laufs", async () => {
    const sim = fakeSimulation({
      log: [{ id: 1, tick: 0, kind: "manual", text: "condition", sourceLabel: "Relay", triggerKey: "on_press", runId: 7 }],
      runs: [{ id: 7, status: "manual" }]
    });
    const wrapper = mount(SimulationLog, { props: { simulation: sim } });
    const buttons = wrapper.findAll(".sim-btn");
    const trueButton = buttons.find((btn) => btn.text() === "True");
    await trueButton.trigger("click");
    expect(sim.resumeManual).toHaveBeenCalledWith(7, true);
  });

  it("bietet ein Texteingabefeld fuer eine manuelle Lambda-Action und ruft resumeManual auf", async () => {
    const sim = fakeSimulation({
      log: [{ id: 1, tick: 0, kind: "manual", text: "lambda", sourceLabel: "Relay", triggerKey: "on_press", runId: 9 }],
      runs: [{ id: 9, status: "manual" }]
    });
    const wrapper = mount(SimulationLog, { props: { simulation: sim } });
    await wrapper.get(".sim-manual-input").setValue("42");
    await wrapper.get(".sim-btn").trigger("click");
    expect(sim.resumeManual).toHaveBeenCalledWith(9, "42");
  });

  it("bietet ein Eingabefeld fuer einen manuellen Lambda-Filter und ruft resolveManualFilter auf", async () => {
    const sim = fakeSimulation({
      log: [{ id: 1, tick: 0, kind: "manual", text: "lambda-filter", sourceLabel: "temp", manualFilterId: 3 }],
      manualFilters: [{ id: 3, entityId: "temp" }]
    });
    const wrapper = mount(SimulationLog, { props: { simulation: sim } });
    await wrapper.get(".sim-manual-input").setValue("22.5");
    await wrapper.get(".sim-btn").trigger("click");
    expect(sim.resolveManualFilter).toHaveBeenCalledWith(3, 22.5);
  });

  it("zeigt keine Resolve-Steuerung mehr, wenn der Lauf nicht mehr manuell ist", () => {
    const sim = fakeSimulation({
      log: [{ id: 1, tick: 0, kind: "manual", text: "condition", sourceLabel: "Relay", runId: 7 }],
      runs: [{ id: 7, status: "done" }]
    });
    const wrapper = mount(SimulationLog, { props: { simulation: sim } });
    expect(wrapper.find(".sim-log__manual").exists()).toBe(false);
  });
});
