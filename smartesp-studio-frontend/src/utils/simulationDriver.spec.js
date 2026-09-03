import { describe, expect, it } from "vitest";

import { evaluateConditionList } from "./simulationConditions";
import {
  intervalTriggers,
  resumeManualRun,
  resumeWaitingRun,
  startActionChain,
  triggersForEntity
} from "./simulationDriver";
import { useVirtualClock } from "../composables/builder/useVirtualClock";

const action = (type, config = {}) => ({ type, config, fields: [] });
const baseCtx = (entityState, overrides = {}) => ({ entityState, evaluateConditionList, ...overrides });

describe("startActionChain", () => {
  it("treibt eine reine Kette bis zum Ende und sammelt executed/skipped-Eintraege", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const { run, entries } = startActionChain(
      [action("logger.log", {}), action("switch.turn_on", { id: "relay" })],
      baseCtx(entityState),
      { sourceLabel: "Wohnzimmer", triggerKey: "on_press" }
    );
    expect(run.status).toBe("done");
    expect(run.meta).toEqual({ sourceLabel: "Wohnzimmer", triggerKey: "on_press" });
    expect(entries).toEqual([
      { type: "skipped", action: action("logger.log", {}) },
      { type: "executed", action: action("switch.turn_on", { id: "relay" }) }
    ]);
    expect(entityState.relay.value).toBe(true);
  });

  it("pausiert bei delay und merkt sich untilTick", () => {
    const clock = useVirtualClock();
    clock.currentTick.value = 100;
    const { run, entries } = startActionChain([action("delay", { duration: "2s" })], baseCtx({}, { clock }));
    expect(run.status).toBe("waiting");
    expect(run.untilTick).toBe(2100);
    expect(entries).toEqual([]);
  });

  it("pausiert bei lambda und merkt sich den Grund", () => {
    const { run, entries } = startActionChain([action("lambda", { value: "x" })], baseCtx({}));
    expect(run.status).toBe("manual");
    expect(run.manualReason).toBe("lambda");
    expect(entries).toEqual([]);
  });
});

describe("resumeWaitingRun", () => {
  it("setzt einen wartenden Lauf fort und laeuft bis zur naechsten Pause bzw. zum Ende", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const { run } = startActionChain(
      [action("delay", { duration: "1s" }), action("switch.turn_on", { id: "relay" })],
      baseCtx(entityState)
    );
    expect(run.status).toBe("waiting");
    const entries = resumeWaitingRun(run);
    expect(run.status).toBe("done");
    expect(entries).toEqual([{ type: "executed", action: action("switch.turn_on", { id: "relay" }) }]);
    expect(entityState.relay.value).toBe(true);
  });

  it("ist ein No-Op auf einem Lauf, der nicht wartet", () => {
    const { run } = startActionChain([action("component.update", {})], baseCtx({}));
    expect(run.status).toBe("done");
    expect(resumeWaitingRun(run)).toEqual([]);
  });

  it("spielt mit der virtuellen Uhr zusammen: scheduleAt/drainDue loesen die Fortsetzung aus", () => {
    const clock = useVirtualClock();
    const entityState = { relay: { kind: "boolean", value: false } };
    const { run } = startActionChain(
      [action("delay", { duration: "5s" }), action("switch.turn_on", { id: "relay" })],
      baseCtx(entityState, { clock })
    );
    clock.scheduleAt(run.untilTick, "action-resume", { runId: run.id });

    clock.currentTick.value = 3000;
    expect(clock.drainDue()).toEqual([]); // noch nicht faellig
    expect(entityState.relay.value).toBe(false);

    clock.currentTick.value = 5000;
    const due = clock.drainDue();
    expect(due).toHaveLength(1);
    expect(due[0].payload).toEqual({ runId: run.id });
    resumeWaitingRun(run);
    expect(entityState.relay.value).toBe(true);
  });
});

describe("resumeManualRun", () => {
  it("setzt einen manuell pausierten Lauf mit dem gelieferten Wert fort", () => {
    const entityState = { relay: { kind: "boolean", value: false } };
    const ifAction = action("if", {
      condition: [{ type: "lambda", config: {} }],
      then: [action("switch.turn_on", { id: "relay" })],
      else: [action("switch.turn_off", { id: "relay" })]
    });
    const { run } = startActionChain([ifAction], baseCtx(entityState));
    expect(run.status).toBe("manual");
    const entries = resumeManualRun(run, true);
    expect(entries).toEqual([{ type: "executed", action: action("switch.turn_on", { id: "relay" }) }]);
    expect(run.status).toBe("done");
    expect(entityState.relay.value).toBe(true);
  });

  it("ist ein No-Op auf einem Lauf, der nicht manuell pausiert", () => {
    const { run } = startActionChain([action("component.update", {})], baseCtx({}));
    expect(resumeManualRun(run, true)).toEqual([]);
  });
});

describe("triggersForEntity", () => {
  const triggers = [
    { scopeId: "component:0", triggerKey: "on_press", manual: false },
    { scopeId: "component:0", triggerKey: "on_time", manual: true },
    { scopeId: "component:1", triggerKey: "on_value", manual: false },
    { scopeId: "component:0", triggerKey: "interval", manual: false }
  ];

  it("liefert nur automatische Trigger derselben scopeId, ohne interval", () => {
    const entity = { scopeId: "component:0" };
    expect(triggersForEntity(triggers, entity)).toEqual([{ scopeId: "component:0", triggerKey: "on_press", manual: false }]);
  });

  it("liefert nichts ohne Entity", () => {
    expect(triggersForEntity(triggers, null)).toEqual([]);
  });
});

describe("intervalTriggers", () => {
  it("filtert auf interval:-Eintraege", () => {
    const triggers = [
      { triggerKey: "interval", scopeId: "component:0" },
      { triggerKey: "on_press", scopeId: "component:0" }
    ];
    expect(intervalTriggers(triggers)).toEqual([{ triggerKey: "interval", scopeId: "component:0" }]);
  });
});
