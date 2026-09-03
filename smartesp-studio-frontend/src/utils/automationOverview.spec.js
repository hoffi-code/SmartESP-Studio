import { describe, expect, it } from "vitest";

import { collectAutomationEntries, groupAutomationEntries } from "./automationOverview";

const actionList = (key, extra = {}) => ({
  key,
  type: "list",
  item: { type: "object", fields: [], extends: "base_actions.json" },
  ...extra
});

const wrappedTrigger = (key, payload = []) => ({
  key,
  type: "list",
  item: { type: "object", fields: [...payload, actionList("then")] }
});

const source = (overrides = {}) => ({
  kind: "component",
  label: "Wohnzimmer",
  scopeId: "component:3",
  ...overrides
});

describe("collectAutomationEntries", () => {
  it("returns nothing without sources or fields", () => {
    expect(collectAutomationEntries()).toEqual([]);
    expect(collectAutomationEntries({ sources: [source({ schema: { fields: [] }, value: {} })] })).toEqual([]);
  });

  it("skips triggers whose action list is empty", () => {
    const entries = collectAutomationEntries({
      sources: [source({ schema: { fields: [actionList("on_press")] }, value: { on_press: [] } })]
    });
    expect(entries).toEqual([]);
  });

  it("picks up a flat trigger with its action types", () => {
    const entries = collectAutomationEntries({
      sources: [
        source({
          schema: { fields: [actionList("on_press")] },
          value: { on_press: [{ type: "switch.toggle" }, { type: "delay" }] }
        })
      ]
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "component",
      sourceLabel: "Wohnzimmer",
      triggerKey: "on_press",
      path: ["on_press"],
      actions: ["switch.toggle", "delay"]
    });
  });

  it("reads the actions out of a wrapped trigger and keeps the item index in the path", () => {
    const entries = collectAutomationEntries({
      sources: [
        source({
          schema: { fields: [wrappedTrigger("on_value_range", [{ key: "above", type: "number" }])] },
          value: {
            on_value_range: [
              { above: 25, then: [{ type: "logger.log" }] },
              { below: 5, then: [] }
            ]
          }
        })
      ]
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      triggerKey: "on_value_range",
      path: ["on_value_range", 0],
      actions: ["logger.log"]
    });
  });

  it("finds triggers nested in object and list fields", () => {
    const entries = collectAutomationEntries({
      sources: [
        source({
          schema: {
            fields: [
              { key: "ota", type: "object", fields: [actionList("on_begin")] },
              { key: "deep_sleep", type: "list", item: { type: "object", fields: [actionList("on_wake")] } }
            ]
          },
          value: {
            ota: { on_begin: [{ type: "logger.log" }] },
            deep_sleep: [{ on_wake: [{ type: "delay" }] }]
          }
        })
      ]
    });
    expect(entries.map((entry) => entry.path)).toEqual([
      ["ota", "on_begin"],
      ["deep_sleep", 0, "on_wake"]
    ]);
  });

  // interval:/script: sind formgleich zu einem Wrapper-Trigger; ohne das on_-Kriterium
  // wuerde der ganze Container als ein einziger Trigger gemeldet.
  it("names a container's then list after the container", () => {
    const entries = collectAutomationEntries({
      sources: [
        source({
          kind: "section",
          label: "interval",
          schema: {
            fields: [
              {
                key: "interval",
                type: "list",
                item: { type: "object", fields: [{ key: "interval", type: "duration" }, actionList("then")] }
              }
            ]
          },
          value: { interval: [{ interval: "5s", then: [{ type: "logger.log" }] }] }
        })
      ]
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      triggerKey: "interval",
      path: ["interval", 0, "then"],
      actions: ["logger.log"]
    });
  });

  it("carries an origin that matches the yaml-preview jump target", () => {
    const [entry] = collectAutomationEntries({
      sources: [
        source({
          scopeId: "tab:System:logger",
          modeLevel: "Advanced",
          schema: { fields: [actionList("on_message")] },
          value: { on_message: [{ type: "delay" }] }
        })
      ]
    });
    expect(entry.origin).toEqual({
      type: "field",
      scopeId: "tab:System:logger",
      path: ["on_message"],
      modeLevel: "Advanced"
    });
  });

  it("labels a bare action entry that has no type", () => {
    const [entry] = collectAutomationEntries({
      sources: [source({ schema: { fields: [actionList("on_press")] }, value: { on_press: [{}] } })]
    });
    expect(entry.actions).toEqual(["custom"]);
  });
});

describe("groupAutomationEntries", () => {
  it("groups by source and keeps the entry order", () => {
    const entries = collectAutomationEntries({
      sources: [
        source({ schema: { fields: [actionList("on_press")] }, value: { on_press: [{ type: "delay" }] } }),
        source({
          kind: "section",
          label: "logger",
          scopeId: "tab:System:logger",
          schema: { fields: [actionList("on_message")] },
          value: { on_message: [{ type: "logger.log" }] }
        })
      ]
    });
    const groups = groupAutomationEntries(entries);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.label)).toEqual(["Wohnzimmer", "logger"]);
    expect(groups[1].entries[0].triggerKey).toBe("on_message");
  });
});
