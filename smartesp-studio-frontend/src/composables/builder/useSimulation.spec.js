import { ref } from "vue";
import { describe, expect, it } from "vitest";

import { useSimulation } from "./useSimulation";

const actionListField = (key) => ({ key, type: "list", item: { type: "object", fields: [], extends: "base_actions.json" } });

const setup = ({ idIndex = [], components = [], sources = [], automation = {} } = {}) => {
  const idIndexRef = ref(idIndex);
  const config = ref({ components, automation });
  const automationSources = ref(sources);
  const sim = useSimulation({ idIndex: idIndexRef, config, automationSources });
  sim.ensureInitialized();
  return sim;
};

describe("useSimulation - Grundzustand", () => {
  it("baut die Entities aus idIndex/config auf", () => {
    const sim = setup({ idIndex: [{ id: "relay", domain: "switch", scopeId: "component:0" }] });
    expect(sim.entities.value).toHaveLength(1);
    expect(sim.entityById("relay").value).toBe(false);
  });
});

describe("useSimulation - Trigger-Feuerung ohne Filter", () => {
  it("setValue an einem switch loest den passenden on_-Trigger aus und protokolliert die Kette", () => {
    const sim = setup({
      idIndex: [{ id: "relay", domain: "switch", scopeId: "component:0" }, { id: "lamp", domain: "switch", scopeId: "component:1" }],
      sources: [
        {
          kind: "component",
          label: "Relay",
          scopeId: "component:0",
          schema: { fields: [actionListField("on_turn_on")] },
          value: { on_turn_on: [{ type: "switch.turn_on", config: { id: "lamp" }, fields: [] }] }
        }
      ]
    });

    sim.setValue("relay", true);

    expect(sim.entityById("relay").value).toBe(true);
    expect(sim.entityById("lamp").value).toBe(true);
    const kinds = sim.log.value.map((entry) => entry.kind);
    expect(kinds).toContain("trigger");
    expect(kinds).toContain("executed");
  });

  it("setField an einem struct loest ebenfalls Trigger aus", () => {
    const sim = setup({
      idIndex: [{ id: "blinds", domain: "cover", scopeId: "component:0" }, { id: "relay", domain: "switch", scopeId: "component:1" }],
      sources: [
        {
          kind: "component",
          label: "Blinds",
          scopeId: "component:0",
          schema: { fields: [actionListField("on_open")] },
          value: { on_open: [{ type: "switch.turn_on", config: { id: "relay" }, fields: [] }] }
        }
      ]
    });

    sim.setField("blinds", "state", "open");
    expect(sim.entityById("relay").value).toBe(true);
  });
});

describe("useSimulation - delay pausiert ueber die Uhr", () => {
  it("setzt eine delay-Kette fort, sobald die Uhr den Tick erreicht", () => {
    const sim = setup({
      idIndex: [{ id: "relay", domain: "switch", scopeId: "component:0" }],
      sources: [
        {
          kind: "component",
          label: "Relay",
          scopeId: "component:0",
          schema: { fields: [actionListField("on_turn_on")] },
          value: {
            on_turn_on: [
              { type: "delay", config: { duration: "5s" }, fields: [] },
              { type: "switch.turn_on", config: { id: "relay" }, fields: [] }
            ]
          }
        }
      ]
    });

    sim.setValue("relay", true); // triggert sich selbst -- Kette pausiert am delay
    expect(sim.runs.value).toHaveLength(1);
    expect(sim.runs.value[0].status).toBe("waiting");

    sim.clock.currentTick.value = 5000;
    expect(sim.runs.value).toHaveLength(0);
  });
});

describe("useSimulation - manuelle Action-Punkte", () => {
  it("pausiert bei lambda und setzt mit resumeManual fort", () => {
    const sim = setup({
      idIndex: [{ id: "relay", domain: "switch", scopeId: "component:0" }],
      sources: [
        {
          kind: "component",
          label: "Relay",
          scopeId: "component:0",
          schema: { fields: [actionListField("on_press")] },
          value: {
            on_press: [
              { type: "lambda", config: { value: "id(relay).state" }, fields: [] },
              { type: "switch.turn_on", config: { id: "relay" }, fields: [] }
            ]
          }
        }
      ]
    });

    sim.fireTrigger(sim.triggers.value[0]);
    expect(sim.runs.value).toHaveLength(1);
    expect(sim.runs.value[0].status).toBe("manual");

    sim.resumeManual(sim.runs.value[0].id, true);
    expect(sim.entityById("relay").value).toBe(true);
    expect(sim.runs.value).toHaveLength(0);
  });
});

describe("useSimulation - Filterkette", () => {
  it("laesst einen Wert ohne Filter direkt durch (Passthrough)", () => {
    const sim = setup({ idIndex: [{ id: "temp", domain: "sensor", scopeId: "component:0" }], components: [{ config: {} }] });
    sim.setValue("temp", 21.5);
    expect(sim.entityById("temp").value).toBe(21.5);
  });

  it("wendet die Filterkette der Komponente an (offset)", () => {
    const sim = setup({
      idIndex: [{ id: "temp", domain: "sensor", scopeId: "component:0" }],
      components: [{ config: { filters: [{ type: "offset", config: { value: 2 } }] } }]
    });
    sim.setValue("temp", 20);
    expect(sim.entityById("temp").value).toBe(22);
  });

  it("filter_out verwirft den Wert -- kein Trigger, kein neuer Zustand", () => {
    const sim = setup({
      idIndex: [{ id: "temp", domain: "sensor", scopeId: "component:0" }],
      components: [{ config: { filters: [{ type: "filter_out", config: { values: [0] } }] } }]
    });
    sim.setValue("temp", 0);
    expect(sim.entityById("temp").value).toBe(0); // Default, nie ueberschrieben
    expect(sim.log.value.some((entry) => entry.kind === "filter-drop")).toBe(true);
  });

  it("ein lambda-Filter pausiert manuell und wird ueber resolveManualFilter fortgesetzt", () => {
    const sim = setup({
      idIndex: [{ id: "temp", domain: "sensor", scopeId: "component:0" }],
      components: [{ config: { filters: [{ type: "lambda", config: { value: "return x;" } }] } }]
    });
    sim.setValue("temp", 20);
    expect(sim.manualFilters.value).toHaveLength(1);
    sim.resolveManualFilter(sim.manualFilters.value[0].id, 42);
    expect(sim.entityById("temp").value).toBe(42);
    expect(sim.manualFilters.value).toHaveLength(0);
  });

  it("debounce pausiert (FILTER_PENDING) und publiziert erst, wenn die Uhr die Dauer erreicht", () => {
    const sim = setup({
      idIndex: [{ id: "temp", domain: "sensor", scopeId: "component:0" }],
      components: [{ config: { filters: [{ type: "debounce", config: { value: "3s" } }] } }]
    });
    sim.setValue("temp", 20);
    expect(sim.entityById("temp").value).toBe(0); // noch nicht publiziert

    sim.clock.currentTick.value = 3000;
    expect(sim.entityById("temp").value).toBe(20);
  });

  it("heartbeat plant sich periodisch selbst neu und publiziert bei jeder Faelligkeit", () => {
    const sim = setup({
      idIndex: [{ id: "temp", domain: "sensor", scopeId: "component:0" }],
      components: [{ config: { filters: [{ type: "heartbeat", config: { period: "1s" } }] } }]
    });
    sim.setValue("temp", 10);
    expect(sim.entityById("temp").value).toBe(0); // heartbeat ist standardmaessig nicht optimistic

    sim.clock.currentTick.value = 1000;
    expect(sim.entityById("temp").value).toBe(10);

    sim.setValue("temp", 15); // neuer Rohwert vor der naechsten Faelligkeit
    sim.clock.currentTick.value = 2000;
    expect(sim.entityById("temp").value).toBe(15);
  });
});

describe("useSimulation - interval:", () => {
  it("feuert die interval-Kette periodisch ueber die Uhr", () => {
    const sim = setup({
      idIndex: [{ id: "relay", domain: "switch", scopeId: "component:0" }],
      automation: { interval: [{ interval: "2s", then: [{ type: "switch.toggle", config: { id: "relay" }, fields: [] }] }] },
      sources: [
        {
          kind: "section",
          label: "interval",
          scopeId: "tab:Automation:interval",
          schema: {
            fields: [
              {
                key: "interval",
                type: "list",
                item: { type: "object", fields: [{ key: "interval", type: "duration" }, actionListField("then")] }
              }
            ]
          },
          value: { interval: [{ interval: "2s", then: [{ type: "switch.toggle", config: { id: "relay" }, fields: [] }] }] }
        }
      ]
    });

    expect(sim.entityById("relay").value).toBe(false);
    sim.clock.currentTick.value = 2000;
    expect(sim.entityById("relay").value).toBe(true);
    sim.clock.currentTick.value = 4000;
    expect(sim.entityById("relay").value).toBe(false);
  });
});

describe("useSimulation - resetSimulation", () => {
  it("setzt Entities, Uhr und Log zurueck", () => {
    const sim = setup({ idIndex: [{ id: "relay", domain: "switch", scopeId: "component:0" }] });
    sim.setValue("relay", true);
    sim.clock.currentTick.value = 500;
    sim.resetSimulation();
    expect(sim.entityById("relay").value).toBe(false);
    expect(sim.clock.currentTick.value).toBe(0);
    expect(sim.log.value).toEqual([]);
  });
});
