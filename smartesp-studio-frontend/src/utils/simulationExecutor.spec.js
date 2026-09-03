import { describe, expect, it } from "vitest";

import { evaluateConditionList, CONDITION_MANUAL } from "./simulationConditions";
import { runActionChain } from "./simulationExecutor";
import { useVirtualClock } from "../composables/builder/useVirtualClock";

const action = (type, config = {}) => ({ type, config, fields: [] });

const baseCtx = (entityState, overrides = {}) => ({
  entityState,
  evaluateConditionList,
  ...overrides
});

// Fuehrt einen Generator komplett aus (keine manuellen/wait-Punkte erwartet) und sammelt
// die Yields ein -- Kurzform fuer die vielen einfachen Faelle unten.
const run = (actions, ctx) => {
  const results = [];
  for (const step of runActionChain(actions, ctx)) results.push(step);
  return results;
};

describe("runActionChain - einfache Zustandsaenderungen", () => {
  it("switch.turn_on/off/toggle", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const ctx = baseCtx(entityState);
    expect(run([action("switch.turn_on", { id: "relay" })], ctx)).toEqual([
      { type: "executed", action: action("switch.turn_on", { id: "relay" }) }
    ]);
    expect(entityState.relay.value).toBe(true);
    run([action("switch.toggle", { id: "relay" })], ctx);
    expect(entityState.relay.value).toBe(false);
    run([action("switch.turn_off", { id: "relay" })], ctx);
    expect(entityState.relay.value).toBe(false);
  });

  it("light.turn_on setzt on + brightness, light.toggle kippt on", () => {
    const entityState = { lamp: { kind: "struct", fields: { on: false, brightness: 1 } } };
    const ctx = baseCtx(entityState);
    run([action("light.turn_on", { id: "lamp", brightness: 0.5 })], ctx);
    expect(entityState.lamp.fields).toEqual({ on: true, brightness: 0.5 });
    run([action("light.toggle", { id: "lamp" })], ctx);
    expect(entityState.lamp.fields.on).toBe(false);
  });

  it("cover.open/close setzen position+state, cover.stop ist ein echtes No-Op", () => {
    const entityState = { blinds: { kind: "struct", fields: { position: 1, state: "open" } } };
    const ctx = baseCtx(entityState);
    run([action("cover.close", { id: "blinds" })], ctx);
    expect(entityState.blinds.fields).toEqual({ position: 0, state: "closed" });
    const steps = run([action("cover.stop", { id: "blinds" })], ctx);
    expect(entityState.blinds.fields).toEqual({ position: 0, state: "closed" });
    expect(steps).toEqual([{ type: "executed", action: action("cover.stop", { id: "blinds" }) }]);
  });

  it("valve.open/close teilen sich die struct-Form von cover", () => {
    const entityState = { tap: { kind: "struct", fields: { position: 1, state: "open" } } };
    const ctx = baseCtx(entityState);
    run([action("valve.close", { id: "tap" })], ctx);
    expect(entityState.tap.fields).toEqual({ position: 0, state: "closed" });
  });

  it("fan.turn_on/off", () => {
    const entityState = { fan1: { kind: "struct", fields: { on: false, speed: 0 } } };
    const ctx = baseCtx(entityState);
    run([action("fan.turn_on", { id: "fan1", speed: 3 })], ctx);
    expect(entityState.fan1.fields).toEqual({ on: true, speed: 3 });
    run([action("fan.turn_off", { id: "fan1" })], ctx);
    expect(entityState.fan1.fields.on).toBe(false);
  });

  it("number.set und select.set", () => {
    const entityState = {
      num: { kind: "numeric", value: 0 },
      mode: { kind: "text", value: "" }
    };
    const ctx = baseCtx(entityState);
    run([action("number.set", { id: "num", value: 42 })], ctx);
    expect(entityState.num.value).toBe(42);
    run([action("select.set", { id: "mode", option: "eco" })], ctx);
    expect(entityState.mode.value).toBe("eco");
  });

  it("lock.lock/unlock", () => {
    const entityState = { door: { kind: "boolean", value: false } };
    const ctx = baseCtx(entityState);
    run([action("lock.lock", { id: "door" })], ctx);
    expect(entityState.door.value).toBe(true);
    run([action("lock.unlock", { id: "door" })], ctx);
    expect(entityState.door.value).toBe(false);
  });

  it("globals.set respektiert die deklarierte Kind (boolean/numeric/text)", () => {
    const entityState = {
      flag: { kind: "boolean", value: false },
      counter: { kind: "numeric", value: 0 },
      label: { kind: "text", value: "" }
    };
    const ctx = baseCtx(entityState);
    run([action("globals.set", { id: "flag", value: "true" })], ctx);
    run([action("globals.set", { id: "counter", value: "7" })], ctx);
    run([action("globals.set", { id: "label", value: "hi" })], ctx);
    expect(entityState.flag.value).toBe(true);
    expect(entityState.counter.value).toBe(7);
    expect(entityState.label.value).toBe("hi");
  });

  it("climate.control mergt nur die gesetzten Felder", () => {
    const entityState = {
      thermo: { kind: "struct", fields: { mode: "off", target_temperature: 20, current_temperature: 20 } }
    };
    const ctx = baseCtx(entityState);
    run([action("climate.control", { id: "thermo", target_temperature: 22 })], ctx);
    expect(entityState.thermo.fields).toEqual({ mode: "off", target_temperature: 22, current_temperature: 20 });
  });

  it("component.update/suspend/resume sind No-Ops, aber liefern executed", () => {
    const steps = run([action("component.update", { id: "sensor1" })], baseCtx({}));
    expect(steps).toEqual([{ type: "executed", action: action("component.update", { id: "sensor1" }) }]);
  });
});

describe("runActionChain - nicht modellierte Actions", () => {
  it("loggt als skipped und laesst die Kette weiterlaufen", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const ctx = baseCtx(entityState);
    const steps = run([action("logger.log", { format: "hi" }), action("switch.turn_on", { id: "relay" })], ctx);
    expect(steps).toEqual([
      { type: "skipped", action: action("logger.log", { format: "hi" }) },
      { type: "executed", action: action("switch.turn_on", { id: "relay" }) }
    ]);
    expect(entityState.relay.value).toBe(true);
  });
});

describe("runActionChain - delay", () => {
  it("pausiert und liefert untilTick relativ zur aktuellen Uhr-Zeit", () => {
    const clock = useVirtualClock();
    clock.currentTick.value = 1000;
    const gen = runActionChain([action("delay", { duration: "5s" })], baseCtx({}, { clock }));
    const step = gen.next();
    expect(step.value).toEqual({ type: "wait", untilTick: 6000, action: action("delay", { duration: "5s" }) });
    expect(gen.next().done).toBe(true);
  });

  it("ohne Uhr rechnet delay ab Tick 0", () => {
    const gen = runActionChain([action("delay", { duration: "2s" })], baseCtx({}));
    expect(gen.next().value).toEqual({ type: "wait", untilTick: 2000, action: action("delay", { duration: "2s" }) });
  });
});

describe("runActionChain - lambda", () => {
  it("pausiert manuell und liefert den per next() gelieferten Wert nicht an die Kette zurueck (Action, kein Ergebnis)", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const gen = runActionChain(
      [action("lambda", { value: "id(relay).state" }), action("switch.turn_on", { id: "relay" })],
      baseCtx(entityState)
    );
    expect(gen.next().value).toEqual({ type: "manual", reason: "lambda", action: action("lambda", { value: "id(relay).state" }) });
    expect(gen.next().value).toEqual({ type: "executed", action: action("switch.turn_on", { id: "relay" }) });
    expect(entityState.relay.value).toBe(true);
  });
});

describe("runActionChain - if", () => {
  it("nimmt then, wenn die Bedingung automatisch wahr ist", () => {
    const entityState = { door: { kind: "boolean", value: true }, relay: { kind: "boolean", value: false } };
    const ifAction = action("if", {
      condition: [{ type: "binary_sensor.is_on", config: { id: "door" } }],
      then: [action("switch.turn_on", { id: "relay" })],
      else: [action("switch.turn_off", { id: "relay" })]
    });
    run([ifAction], baseCtx(entityState));
    expect(entityState.relay.value).toBe(true);
  });

  it("nimmt else, wenn die Bedingung automatisch falsch ist", () => {
    const entityState = { door: { kind: "boolean", value: false }, relay: { kind: "boolean", value: true } };
    const ifAction = action("if", {
      condition: [{ type: "binary_sensor.is_on", config: { id: "door" } }],
      then: [action("switch.turn_on", { id: "relay" })],
      else: [action("switch.turn_off", { id: "relay" })]
    });
    run([ifAction], baseCtx(entityState));
    expect(entityState.relay.value).toBe(false);
  });

  it("pausiert manuell bei einer nicht auswertbaren Bedingung und nutzt den per next() gelieferten Wert", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const ifAction = action("if", {
      condition: [{ type: "lambda", config: { value: "x" } }],
      then: [action("switch.turn_on", { id: "relay" })],
      else: [action("switch.turn_off", { id: "relay" })]
    });
    const gen = runActionChain([ifAction], baseCtx(entityState));
    const first = gen.next();
    expect(first.value).toEqual({ type: "manual", reason: "condition", action: ifAction });
    expect(gen.next(true).value).toEqual({ type: "executed", action: action("switch.turn_on", { id: "relay" }) });
    expect(entityState.relay.value).toBe(true);
    expect(gen.next().done).toBe(true);
  });
});

describe("runActionChain - while", () => {
  it("wiederholt then, bis die Bedingung falsch wird", () => {
    const entityState = { counter: { kind: "numeric", value: 0 } };
    const whileAction = action("while", {
      condition: [{ type: "for-test-placeholder" }],
      then: [action("number.set", { id: "counter", value: 0 })]
    });
    // Bedingung direkt am entityState hochzaehlen lassen, via eigener evaluateConditionList
    let calls = 0;
    const ctx = {
      entityState,
      evaluateConditionList: () => {
        calls += 1;
        entityState.counter.value = calls;
        return calls <= 3;
      }
    };
    const steps = run([whileAction], ctx);
    // 3 Iterationen a 1 Action = 3 executed-Yields, 4. Bedingungspruefung bricht ab
    expect(steps.filter((s) => s.type === "executed")).toHaveLength(3);
    expect(calls).toBe(4);
  });

  it("bricht nach MAX_LOOP_ITERATIONS ab, wenn sich die Bedingung nie aendert", () => {
    const ctx = { entityState: {}, evaluateConditionList: () => true };
    const whileAction = action("while", { condition: [], then: [] });
    const steps = run([whileAction], ctx);
    expect(steps).toEqual([]);
  });

  it("pausiert manuell, wenn die Bedingung CONDITION_MANUAL liefert, und stoppt sobald next() false liefert", () => {
    const entityState = {};
    let evaluations = 0;
    const ctx = {
      entityState,
      evaluateConditionList: () => {
        evaluations += 1;
        return CONDITION_MANUAL;
      }
    };
    const whileAction = action("while", { condition: [], then: [action("component.update", {})] });
    const gen = runActionChain([whileAction], ctx);
    const first = gen.next();
    expect(first.value).toEqual({ type: "manual", reason: "condition", action: whileAction });
    const second = gen.next(true); // erste Iteration laeuft
    expect(second.value).toEqual({ type: "executed", action: action("component.update", {}) });
    const third = gen.next(); // erneute Bedingungspruefung -> wieder manual
    expect(third.value).toEqual({ type: "manual", reason: "condition", action: whileAction });
    const fourth = gen.next(false); // jetzt abbrechen
    expect(fourth.done).toBe(true);
    expect(evaluations).toBe(2);
  });
});

describe("runActionChain - repeat", () => {
  it("fuehrt then count-mal aus und reicht scopeVars.iteration durch", () => {
    const entityState = { counter: { kind: "numeric", value: 0 } };
    const seen = [];
    const ctx = {
      entityState,
      evaluateConditionList,
      scopeVars: {}
    };
    // then-Actions selbst lesen kein scopeVars (kein Lambda-Interpreter) -- wir pruefen die
    // Iterationszahl indirekt ueber die Anzahl ausgefuehrter Actions.
    const repeatAction = action("repeat", { count: 3, then: [action("number.set", { id: "counter", value: 1 })] });
    const steps = run([repeatAction], ctx);
    expect(steps.filter((s) => s.type === "executed")).toHaveLength(3);
    expect(entityState.counter.value).toBe(1);
    void seen;
  });

  it("count 0 fuehrt nichts aus", () => {
    const ctx = baseCtx({});
    const steps = run([action("repeat", { count: 0, then: [action("component.update", {})] })], ctx);
    expect(steps).toEqual([]);
  });
});

describe("runActionChain - script.execute/stop", () => {
  it("script.execute loest die Actions des referenzierten Skripts aus", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const ctx = baseCtx(entityState, { scripts: { my_script: [action("switch.turn_on", { id: "relay" })] } });
    const steps = run([action("script.execute", { id: "my_script" })], ctx);
    expect(steps).toEqual([{ type: "executed", action: action("switch.turn_on", { id: "relay" }) }]);
    expect(entityState.relay.value).toBe(true);
  });

  it("script.execute ohne bekanntes Skript wird als skipped geloggt", () => {
    const ctx = baseCtx({}, { scripts: {} });
    const steps = run([action("script.execute", { id: "unknown" })], ctx);
    expect(steps).toEqual([{ type: "skipped", action: action("script.execute", { id: "unknown" }) }]);
  });

  it("script.stop ist immer skipped -- kein Generator-Tracking in dieser Runde", () => {
    const steps = run([action("script.stop", { id: "my_script" })], baseCtx({}));
    expect(steps).toEqual([{ type: "skipped", action: action("script.stop", { id: "my_script" }) }]);
  });
});
