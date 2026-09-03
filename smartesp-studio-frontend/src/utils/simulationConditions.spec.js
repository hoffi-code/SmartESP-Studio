import { describe, expect, it } from "vitest";

import { useVirtualClock } from "../composables/builder/useVirtualClock";
import { CONDITION_MANUAL, evaluateCondition } from "./simulationConditions";

const condition = (type, config = {}) => ({ type, config });

const entityState = {
  door: { kind: "boolean", value: true },
  relay: { kind: "boolean", value: false },
  lamp: { kind: "struct", fields: { on: true } },
  blinds: { kind: "struct", fields: { state: "open" } }
};

describe("evaluateCondition - domain conditions", () => {
  it("evaluates binary_sensor/switch/light is_on and is_off against the entity state", () => {
    expect(evaluateCondition(condition("binary_sensor.is_on", { id: "door" }), entityState)).toBe(true);
    expect(evaluateCondition(condition("binary_sensor.is_off", { id: "door" }), entityState)).toBe(false);
    expect(evaluateCondition(condition("switch.is_on", { id: "relay" }), entityState)).toBe(false);
    expect(evaluateCondition(condition("light.is_on", { id: "lamp" }), entityState)).toBe(true);
  });

  it("reads a struct entity's on flag through the light/light-like handlers", () => {
    expect(evaluateCondition(condition("light.is_off", { id: "lamp" }), entityState)).toBe(false);
  });

  it("evaluates cover state from the struct's state field", () => {
    expect(evaluateCondition(condition("cover.is_open", { id: "blinds" }), entityState)).toBe(true);
    expect(evaluateCondition(condition("cover.is_closed", { id: "blinds" }), entityState)).toBe(false);
  });

  it("treats an unknown entity as falsy rather than throwing", () => {
    expect(evaluateCondition(condition("switch.is_on", { id: "missing" }), entityState)).toBe(false);
  });

  it("wifi/api connected default to true without a real device", () => {
    expect(evaluateCondition(condition("wifi.connected"), entityState)).toBe(true);
    expect(evaluateCondition(condition("api.connected"), entityState)).toBe(true);
  });

  it("falls back to CONDITION_MANUAL for an unmodelled condition type (e.g. lvgl.*)", () => {
    expect(evaluateCondition(condition("lvgl.is_idle"), entityState)).toBe(CONDITION_MANUAL);
  });

  it("lambda is never evaluated -- returns the manual fallback marker", () => {
    expect(evaluateCondition(condition("lambda", { value: "return true;" }), entityState)).toBe(CONDITION_MANUAL);
  });
});

describe("evaluateCondition - and/or/not", () => {
  it("and requires every child to be true, short-circuiting on the first false", () => {
    const both = condition("and", {
      conditions: [condition("binary_sensor.is_on", { id: "door" }), condition("switch.is_on", { id: "relay" })]
    });
    expect(evaluateCondition(both, entityState)).toBe(false);
  });

  it("or is true once any child is true", () => {
    const either = condition("or", {
      conditions: [condition("switch.is_on", { id: "relay" }), condition("binary_sensor.is_on", { id: "door" })]
    });
    expect(evaluateCondition(either, entityState)).toBe(true);
  });

  it("not inverts the single nested condition", () => {
    expect(evaluateCondition(condition("not", { conditions: [condition("switch.is_on", { id: "relay" })] }), entityState)).toBe(
      true
    );
  });

  it("and/or become manual only when the manual child could still change the outcome", () => {
    const andWithManual = condition("and", {
      conditions: [condition("binary_sensor.is_on", { id: "door" }), condition("lambda", { value: "x" })]
    });
    expect(evaluateCondition(andWithManual, entityState)).toBe(CONDITION_MANUAL);

    // short-circuit: the false child alone already decides AND, the manual sibling is moot
    const andShortCircuits = condition("and", {
      conditions: [condition("switch.is_on", { id: "relay" }), condition("lambda", { value: "x" })]
    });
    expect(evaluateCondition(andShortCircuits, entityState)).toBe(false);

    // short-circuit: the true child alone already decides OR
    const orShortCircuits = condition("or", {
      conditions: [condition("binary_sensor.is_on", { id: "door" }), condition("lambda", { value: "x" })]
    });
    expect(evaluateCondition(orShortCircuits, entityState)).toBe(true);
  });

  it("not propagates a manual inner result", () => {
    expect(evaluateCondition(condition("not", { conditions: [condition("lambda", {})] }), entityState)).toBe(CONDITION_MANUAL);
  });
});

describe("evaluateCondition - for", () => {
  it("without a clock/state, approximates as the current instantaneous result", () => {
    expect(evaluateCondition(condition("for", { time: "5s", condition: [condition("binary_sensor.is_on", { id: "door" })] }), entityState)).toBe(
      true
    );
  });

  it("with a clock, only becomes true once the inner condition has held for the full duration", () => {
    const clock = useVirtualClock();
    const state = {};
    const forCondition = condition("for", { time: "5s", condition: [condition("switch.is_on", { id: "relay" })] });

    // relay starts off -- condition is false the whole time, never becomes true
    expect(evaluateCondition(forCondition, entityState, { clock, state })).toBe(false);

    // flip relay on and re-check across ticks
    const onState = { ...entityState, relay: { kind: "boolean", value: true } };
    expect(evaluateCondition(forCondition, onState, { clock, state })).toBe(false); // just became true, 0s elapsed
    clock.currentTick.value = 4000;
    expect(evaluateCondition(forCondition, onState, { clock, state })).toBe(false); // 4s < 5s
    clock.currentTick.value = 5000;
    expect(evaluateCondition(forCondition, onState, { clock, state })).toBe(true); // 5s elapsed
  });

  it("resets the held-since marker once the inner condition turns false again", () => {
    const clock = useVirtualClock();
    const state = {};
    const forCondition = condition("for", { time: "5s", condition: [condition("switch.is_on", { id: "relay" })] });
    const onState = { relay: { kind: "boolean", value: true } };
    const offState = { relay: { kind: "boolean", value: false } };

    evaluateCondition(forCondition, onState, { clock, state });
    clock.currentTick.value = 3000;
    evaluateCondition(forCondition, offState, { clock, state }); // interrupted before 5s
    clock.currentTick.value = 6000;
    expect(evaluateCondition(forCondition, onState, { clock, state })).toBe(false); // just re-armed, needs another 5s
  });

  it("a manual inner condition makes the whole for-condition manual", () => {
    const forCondition = condition("for", { time: "5s", condition: [condition("lambda", {})] });
    expect(evaluateCondition(forCondition, entityState, { clock: useVirtualClock(), state: {} })).toBe(CONDITION_MANUAL);
  });
});
