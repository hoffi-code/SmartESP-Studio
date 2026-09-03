// Treibt Action-Ketten (simulationExecutor.js) ueber mehrere Uhr-Ticks hinweg an und
// sammelt Log-Eintraege. Reine Funktionen auf einem "run"-Objekt -- useSimulation.js haelt
// die laufenden runs + das Log als Vue-refs, delegiert die Logik hierher (Muster wie
// useBuilderValidation.js -> builderValidationRules.js).
//
// Ein run: { id, gen, meta, status: "running"|"waiting"|"manual"|"done", untilTick,
//            pendingAction, manualReason }. meta ist frei (Trigger-Herkunft fuers Log/UI,
//            z.B. { sourceLabel, triggerKey }), wird 1:1 durchgereicht.

import { runActionChain } from "./simulationExecutor";

let nextRunId = 1;

const advanceRun = (run, resumeValue) => {
  const entries = [];
  let step = run.gen.next(resumeValue);

  while (!step.done) {
    const { value } = step;
    if (value.type === "wait") {
      run.status = "waiting";
      run.untilTick = value.untilTick;
      run.pendingAction = value.action;
      return entries;
    }
    if (value.type === "manual") {
      run.status = "manual";
      run.manualReason = value.reason;
      run.pendingAction = value.action;
      return entries;
    }
    entries.push({ type: value.type, action: value.action });
    step = run.gen.next();
  }

  run.status = "done";
  run.pendingAction = null;
  return entries;
};

// Startet eine neue Action-Kette und treibt sie synchron bis zur ersten Pause bzw. zum Ende.
export const startActionChain = (actions, ctx, meta = {}) => {
  const run = { id: nextRunId++, gen: runActionChain(actions, ctx), meta, status: "running" };
  const entries = advanceRun(run);
  return { run, entries };
};

// Setzt einen an einer manuellen Stelle (lambda-Action/-Bedingung) pausierten Lauf mit dem
// vom Nutzer gelieferten Ergebnis fort.
export const resumeManualRun = (run, value) => (run.status === "manual" ? advanceRun(run, value) : []);

// Setzt einen an delay pausierten Lauf fort -- wird vom Treiber aufgerufen, sobald die Uhr
// den geplanten Tick erreicht. Kein Wert an die Kette zurueckzugeben, delay liefert nichts.
export const resumeWaitingRun = (run) => (run.status === "waiting" ? advanceRun(run) : []);

// Ordnet gesammelte Trigger (simulationAutomation.js) einer geaenderten Entity zu: gleiche
// scopeId (der Trigger sitzt auf genau der Komponente, die die Entity definiert), kein
// Container-/Zeit-Trigger (interval:) und nicht manuell (Lambda/on_time -- die brauchen den
// "Manuell ausloesen"-Button statt automatisch bei jeder Wertaenderung zu feuern).
export const triggersForEntity = (triggers, entity) => {
  if (!entity) return [];
  return (triggers || []).filter(
    (trigger) => trigger.scopeId === entity.scopeId && trigger.triggerKey !== "interval" && !trigger.manual
  );
};

// interval:-Trigger sind zeitgetrieben statt entity-getrieben -- eigener Filter fuers
// Verdrahten mit der virtuellen Uhr (ein scheduleAt pro Intervall-Eintrag).
export const intervalTriggers = (triggers) => (triggers || []).filter((trigger) => trigger.triggerKey === "interval");
