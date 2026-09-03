// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import SimulationPanel from "./SimulationPanel.vue";

const fakeSimulation = ({ running = false, speedFactor = 1, currentTick = 0, triggers = [], runs = [] } = {}) => ({
  entities: ref([]),
  log: ref([]),
  runs: ref(runs),
  manualFilters: ref([]),
  triggers: ref(triggers),
  clock: {
    running: ref(running),
    speedFactor: ref(speedFactor),
    currentTick: ref(currentTick),
    play: vi.fn(),
    pause: vi.fn(),
    setSpeed: vi.fn()
  },
  setValue: vi.fn(),
  setField: vi.fn(),
  resumeManual: vi.fn(),
  resolveManualFilter: vi.fn(),
  fireTrigger: vi.fn(),
  resetSimulation: vi.fn(),
  ensureInitialized: vi.fn()
});

describe("SimulationPanel", () => {
  it("initialisiert die Simulation beim Mounten", () => {
    const sim = fakeSimulation();
    mount(SimulationPanel, { props: { simulation: sim } });
    expect(sim.ensureInitialized).toHaveBeenCalled();
  });

  it("Uhr-Toggle ruft play() auf, wenn sie pausiert ist", async () => {
    const sim = fakeSimulation({ running: false });
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    await wrapper.get(".sim-clock__toggle").trigger("click");
    expect(sim.clock.play).toHaveBeenCalled();
  });

  it("Uhr-Toggle ruft pause() auf, wenn sie laeuft", async () => {
    const sim = fakeSimulation({ running: true });
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    await wrapper.get(".sim-clock__toggle").trigger("click");
    expect(sim.clock.pause).toHaveBeenCalled();
  });

  it("Geschwindigkeits-Buttons rufen setSpeed mit dem gewaehlten Faktor auf", async () => {
    const sim = fakeSimulation();
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    const speedButtons = wrapper.findAll(".sim-clock__speed-btn");
    const fiveX = speedButtons.find((btn) => btn.text() === "5x");
    await fiveX.trigger("click");
    expect(sim.clock.setSpeed).toHaveBeenCalledWith(5);
  });

  it("Zuruecksetzen-Button ruft resetSimulation auf", async () => {
    const sim = fakeSimulation();
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    await wrapper.get(".sim-clock__reset").trigger("click");
    expect(sim.resetSimulation).toHaveBeenCalled();
  });

  it("zeigt die Zeit im mm:ss-Format", () => {
    const sim = fakeSimulation({ currentTick: 65000 });
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    expect(wrapper.get(".sim-clock__time").text()).toBe("01:05");
  });

  it("rendert einen Trigger-Chip mit Ausloese-Button", async () => {
    const trigger = { sourceLabel: "Relay", triggerKey: "on_press", manual: false, actions: [] };
    const sim = fakeSimulation({ triggers: [trigger] });
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    expect(wrapper.text()).toContain("on_press");
    await wrapper.get(".sim-trigger-chip__fire").trigger("click");
    expect(sim.fireTrigger).toHaveBeenCalledWith(trigger);
  });

  it("zeigt aktive wartende Ketten mit ihrem faelligen Tick", () => {
    const sim = fakeSimulation({
      runs: [{ id: 1, status: "waiting", untilTick: 5000, meta: { sourceLabel: "Relay", triggerKey: "on_press" } }]
    });
    const wrapper = mount(SimulationPanel, { props: { simulation: sim } });
    expect(wrapper.text()).toContain("5000");
  });
});
