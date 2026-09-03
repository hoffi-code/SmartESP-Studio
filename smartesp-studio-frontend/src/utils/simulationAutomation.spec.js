import { describe, expect, it } from "vitest";

import { collectSimulationTriggers } from "./simulationAutomation";

const actionListField = (key, extra = {}) => ({
  key,
  type: "list",
  item: { type: "object", fields: [], extends: "base_actions.json" },
  ...extra
});

const source = (overrides = {}) => ({
  kind: "component",
  label: "Wohnzimmer",
  scopeId: "component:0",
  ...overrides
});

describe("collectSimulationTriggers", () => {
  it("carries the full action objects, not strings", () => {
    const entries = collectSimulationTriggers({
      sources: [
        source({
          schema: { fields: [actionListField("on_press")] },
          value: { on_press: [{ type: "switch.toggle", config: { id: "relay" }, fields: [] }] }
        })
      ]
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].actions).toEqual([{ type: "switch.toggle", config: { id: "relay" }, fields: [] }]);
    expect(entries[0].manual).toBe(false);
  });

  it("finds container triggers (interval:) and names them after the container", () => {
    const entries = collectSimulationTriggers({
      sources: [
        source({
          kind: "section",
          label: "interval",
          schema: {
            fields: [
              {
                key: "interval",
                type: "list",
                item: { type: "object", fields: [{ key: "interval", type: "duration" }, actionListField("then")] }
              }
            ]
          },
          value: { interval: [{ interval: "5s", then: [{ type: "logger.log", config: {}, fields: [] }] }] }
        })
      ]
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ triggerKey: "interval", path: ["interval", 0, "then"] });
  });

  it("flags on_time as not automatically triggerable", () => {
    const entries = collectSimulationTriggers({
      sources: [
        source({
          schema: { fields: [actionListField("on_time")] },
          value: { on_time: [{ type: "logger.log", config: {}, fields: [] }] }
        })
      ]
    });
    expect(entries[0].manual).toBe(true);
  });

  it("returns nothing without sources or matching fields", () => {
    expect(collectSimulationTriggers()).toEqual([]);
    expect(collectSimulationTriggers({ sources: [source({ schema: { fields: [] }, value: {} })] })).toEqual([]);
  });
});
