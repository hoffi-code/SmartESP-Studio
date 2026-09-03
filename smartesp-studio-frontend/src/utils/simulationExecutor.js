// Fuehrt eine ESPHome-Action-Kette ({type, config, fields}-Eintraege, kanonische Form aus
// schemaYaml.js renderActionEntries) gegen den simulierten EntityState aus. Ein Generator,
// kein simples Array-forEach -- delay muss die Kette ueber mehrere Uhr-Ticks pausieren
// koennen, eine Lambda-Action braucht menschliches Eingreifen (kein C++-Interpreter im
// Projekt). yield gibt die Kontrolle an den Treiber ab (simulationDriver.js) und liefert
// bei einem manuellen Punkt per generator.next(wert) den vom Nutzer gelieferten Wert
// zurueck -- z.B. das Ergebnis einer Bedingung, die nicht automatisch auswertbar war.
//
// Vier yield-Arten:
//   {type:"executed", action}          -- Zustandsaenderung ausgefuehrt oder legitimes No-Op
//                                          (cover.stop, component.update, ...)
//   {type:"skipped", action}           -- Actiontyp nicht modelliert (Logger/UART/MQTT/HTTP/
//                                          Audio/OTA/WiFi/GPIO/IR/chip-spezifisch, ...):
//                                          Kette laeuft weiter, nur ein Log-Eintrag
//   {type:"wait", untilTick, action}   -- delay: Treiber plant per Uhr die Fortsetzung
//   {type:"manual", reason, action}    -- lambda-Action oder eine Bedingung, die
//                                          CONDITION_MANUAL geliefert hat

import { CONDITION_MANUAL } from "./simulationConditions";
import { parseDuration } from "./simulationDuration";

const MAX_LOOP_ITERATIONS = 1000; // Sicherheitsnetz gegen eine while-Bedingung, die sich
// waehrend synchroner Ausfuehrung nie aendert (kein delay dazwischen, das die Schleife
// natuerlich unterbricht).

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isTruthy = (value) => value === true || value === "true" || value === "ON" || value === 1;

const scalarEntity = (entityState, id) => {
  const entity = entityState?.[id];
  return entity && entity.kind !== "struct" ? entity : null;
};

const structEntity = (entityState, id) => {
  const entity = entityState?.[id];
  return entity && entity.kind === "struct" ? entity : null;
};

const setScalar = (entityState, id, value) => {
  const entity = scalarEntity(entityState, id);
  if (entity) entity.value = value;
};

const mergeStructFields = (entityState, id, patch) => {
  const entity = structEntity(entityState, id);
  if (entity) entity.fields = { ...(entity.fields || {}), ...patch };
};

// Reine Zustandsaenderungen an einer id() -- Actions, die sich ohne Hardware sinnvoll
// nachbilden lassen. Alles ausserhalb dieser Liste ist entweder Kontrollfluss (weiter unten
// gesondert behandelt) oder wird als "skipped" geloggt.
const SIMPLE_ACTIONS = {
  "switch.turn_on": (config, ctx) => setScalar(ctx.entityState, config.id, true),
  "switch.turn_off": (config, ctx) => setScalar(ctx.entityState, config.id, false),
  "switch.toggle": (config, ctx) => {
    const entity = scalarEntity(ctx.entityState, config.id);
    if (entity) entity.value = !entity.value;
  },
  "lock.lock": (config, ctx) => setScalar(ctx.entityState, config.id, true),
  "lock.unlock": (config, ctx) => setScalar(ctx.entityState, config.id, false),

  "light.turn_on": (config, ctx) => {
    const patch = { on: true };
    if (config.brightness !== undefined) patch.brightness = toNumber(config.brightness, 1);
    mergeStructFields(ctx.entityState, config.id, patch);
  },
  "light.turn_off": (config, ctx) => mergeStructFields(ctx.entityState, config.id, { on: false }),
  "light.toggle": (config, ctx) => {
    const entity = structEntity(ctx.entityState, config.id);
    if (entity) entity.fields = { ...entity.fields, on: !entity.fields?.on };
  },

  "cover.open": (config, ctx) => mergeStructFields(ctx.entityState, config.id, { state: "open", position: 1 }),
  "cover.close": (config, ctx) => mergeStructFields(ctx.entityState, config.id, { state: "closed", position: 0 }),
  "cover.stop": () => {}, // Position bleibt wie sie ist -- absichtlich kein State-Wechsel

  "valve.open": (config, ctx) => mergeStructFields(ctx.entityState, config.id, { state: "open", position: 1 }),
  "valve.close": (config, ctx) => mergeStructFields(ctx.entityState, config.id, { state: "closed", position: 0 }),

  "fan.turn_on": (config, ctx) => {
    const patch = { on: true };
    if (config.speed !== undefined) patch.speed = toNumber(config.speed);
    mergeStructFields(ctx.entityState, config.id, patch);
  },
  "fan.turn_off": (config, ctx) => mergeStructFields(ctx.entityState, config.id, { on: false }),

  "number.set": (config, ctx) => setScalar(ctx.entityState, config.id, toNumber(config.value)),
  "select.set": (config, ctx) => setScalar(ctx.entityState, config.id, String(config.option ?? "")),

  "globals.set": (config, ctx) => {
    const entity = ctx.entityState?.[config.id];
    if (!entity) return;
    if (entity.kind === "boolean") entity.value = isTruthy(config.value);
    else if (entity.kind === "numeric") entity.value = toNumber(config.value);
    else entity.value = String(config.value ?? "");
  },

  "climate.control": (config, ctx) => {
    const patch = {};
    if (config.mode !== undefined) patch.mode = String(config.mode);
    if (config.target_temperature !== undefined) patch.target_temperature = toNumber(config.target_temperature);
    mergeStructFields(ctx.entityState, config.id, patch);
  },

  "component.update": () => {},
  "component.suspend": () => {},
  "component.resume": () => {}
};

// ctx: { entityState, evaluateConditionList(list, entityState, conditionCtx),
//        conditionCtx (optional, fuer for-Bedingungen), clock (optional useVirtualClock),
//        scripts (optional {[scriptId]: actions[]}), maxDepth }
export function* runActionChain(actions, ctx, depth = 0) {
  const maxDepth = ctx.maxDepth ?? 8;
  if (depth > maxDepth) return;

  for (const action of Array.isArray(actions) ? actions : []) {
    const type = String(action?.type || "");
    const config = action?.config || {};

    if (type === "delay") {
      const now = ctx.clock ? ctx.clock.currentTick.value : 0;
      yield { type: "wait", untilTick: now + parseDuration(config.duration), action };
      continue;
    }

    if (type === "lambda") {
      yield { type: "manual", reason: "lambda", action };
      continue;
    }

    if (type === "if") {
      let result = ctx.evaluateConditionList(config.condition, ctx.entityState, ctx.conditionCtx);
      if (result === CONDITION_MANUAL) result = yield { type: "manual", reason: "condition", action };
      yield* runActionChain(result ? config.then : config.else, ctx, depth + 1);
      continue;
    }

    if (type === "while") {
      for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration += 1) {
        let result = ctx.evaluateConditionList(config.condition, ctx.entityState, ctx.conditionCtx);
        if (result === CONDITION_MANUAL) result = yield { type: "manual", reason: "condition", action };
        if (!result) break;
        yield* runActionChain(config.then, ctx, depth + 1);
      }
      continue;
    }

    if (type === "repeat") {
      const count = Math.max(0, Math.round(toNumber(config.count, 0)));
      for (let iteration = 0; iteration < count; iteration += 1) {
        yield* runActionChain(config.then, { ...ctx, scopeVars: { ...ctx.scopeVars, iteration } }, depth + 1);
      }
      continue;
    }

    if (type === "script.execute") {
      const scriptActions = ctx.scripts?.[config.id];
      if (scriptActions) {
        yield* runActionChain(scriptActions, ctx, depth + 1);
      } else {
        yield { type: "skipped", action };
      }
      continue;
    }

    if (type === "script.stop") {
      // Kein Tracking laufender Skript-Generatoren je id in dieser Runde -- ein Abbruch
      // waere nur Attrappe. Ehrlich als "nicht simuliert" loggen statt es vorzugaukeln.
      yield { type: "skipped", action };
      continue;
    }

    const handler = SIMPLE_ACTIONS[type];
    if (handler) {
      handler(config, ctx);
      yield { type: "executed", action };
      continue;
    }

    // Alles IO-/Hardware-nahe (Logger/UART/MQTT/HTTP/Audio/OTA/WiFi/GPIO/IR/chip-
    // spezifisch, ...): kein Zustand zu aendern, aber die Kette darf nicht abbrechen --
    // sonst wuerde z.B. "logger.log" gefolgt von "switch.turn_on" den Switch nie schalten.
    yield { type: "skipped", action };
  }
}
