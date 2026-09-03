// Wertet ESPHome-Bedingungen (base_conditions.json) gegen den simulierten EntityState aus.
// Deckt die Logik-Kombinatoren (and/or/not/for) und die generischen Domain-Zustandspruefungen
// ab (binary_sensor/switch/light.is_on|is_off, cover.is_open|is_closed, wifi/api.connected).
//
// lambda-Bedingungen liefern CONDITION_MANUAL -- es gibt im Projekt bewusst keinen
// C++-Interpreter (siehe lambdaLint.js). Ein Logik-Kombinator, der ein manuelles Kind
// enthaelt, ist selbst manuell, AUSSER das Ergebnis steht schon durch Kurzschluss fest
// (or mit einem wahren Kind, and mit einem falschen) -- dann zaehlt das echte Ergebnis mehr
// als die Unsicherheit im uebersprungenen Zweig.

import { parseDuration } from "./simulationDuration";

export const CONDITION_MANUAL = { manual: true };

const asArray = (value) => (Array.isArray(value) ? value : []);
const isManual = (result) => result === CONDITION_MANUAL;

const isEntityTruthy = (entityState, id) => {
  const entity = entityState?.[id];
  if (!entity) return false;
  if (entity.kind === "struct") return Boolean(entity.fields?.on);
  return Boolean(entity.value);
};

const DOMAIN_CONDITIONS = {
  "binary_sensor.is_on": (config, entityState) => isEntityTruthy(entityState, config.id),
  "binary_sensor.is_off": (config, entityState) => !isEntityTruthy(entityState, config.id),
  "switch.is_on": (config, entityState) => isEntityTruthy(entityState, config.id),
  "switch.is_off": (config, entityState) => !isEntityTruthy(entityState, config.id),
  "light.is_on": (config, entityState) => isEntityTruthy(entityState, config.id),
  "light.is_off": (config, entityState) => !isEntityTruthy(entityState, config.id),
  "cover.is_open": (config, entityState) => entityState?.[config.id]?.fields?.state === "open",
  "cover.is_closed": (config, entityState) => entityState?.[config.id]?.fields?.state === "closed",
  // Ohne echtes Geraet (Teil 1 der Simulation) gibt es keine WLAN-/API-Verbindung zu
  // pruefen -- "immer verbunden" ist die ehrlichste Annahme, damit davon abhaengige Ketten
  // nicht grundlos blockieren.
  "wifi.connected": () => true,
  "api.connected": () => true
};

// ctx: { clock (optional useVirtualClock), state (optional, pro for-Bedingungs-Instanz) }.
export const evaluateCondition = (entry, entityState, ctx = {}) => {
  const type = entry?.type;
  const config = entry?.config || {};

  if (type === "lambda") return CONDITION_MANUAL;
  if (type === "and") return evaluateAll(config.conditions, entityState, ctx);
  if (type === "or") return evaluateAny(config.conditions, entityState, ctx);
  if (type === "not") {
    const inner = evaluateCondition(asArray(config.conditions)[0], entityState, ctx);
    return isManual(inner) ? CONDITION_MANUAL : !inner;
  }
  if (type === "for") return evaluateForCondition(config, entityState, ctx);

  const handler = DOMAIN_CONDITIONS[type];
  // Unbekannte/nicht modellierte Bedingungen (z.B. lvgl.*) sind wie lambda ein manueller
  // Fallback statt eines stillschweigenden "false".
  return handler ? handler(config, entityState) : CONDITION_MANUAL;
};

// Exportiert fuer simulationExecutor.js: if/while/for tragen ihre Bedingung(en) als eine
// Liste unter "condition:" -- implizites AND, wie "and:"/"or:" die Bedingung selbst.
export const evaluateConditionList = (list, entityState, ctx) => evaluateAll(list, entityState, ctx);

const evaluateAll = (list, entityState, ctx) => {
  let sawManual = false;
  for (const child of asArray(list)) {
    const result = evaluateCondition(child, entityState, ctx);
    if (isManual(result)) {
      sawManual = true;
      continue;
    }
    if (!result) return false; // Kurzschluss: AND ist damit sicher falsch
  }
  return sawManual ? CONDITION_MANUAL : true;
};

const evaluateAny = (list, entityState, ctx) => {
  let sawManual = false;
  for (const child of asArray(list)) {
    const result = evaluateCondition(child, entityState, ctx);
    if (isManual(result)) {
      sawManual = true;
      continue;
    }
    if (result) return true; // Kurzschluss: OR ist damit sicher wahr
  }
  return sawManual ? CONDITION_MANUAL : false;
};

// "for" braucht Zeit: die innere Bedingung muss durchgehend seit >= time wahr sein.
// ctx.state haelt "seit wann wahr" pro Bedingungs-INSTANZ (wie das runtimeState der
// zeitbasierten Filter). Ohne ctx.clock/ctx.state ist keine Dauer messbar -- dann zaehlt
// nur der aktuelle Zustand, dokumentierte Naeherung statt eines manuellen Fallbacks (die
// inneren Bedingungen sind ja durchaus auswertbar).
const evaluateForCondition = (config, entityState, ctx) => {
  const inner = evaluateAll(config.condition, entityState, ctx);
  if (isManual(inner)) return CONDITION_MANUAL;
  if (!ctx.clock || !ctx.state) return inner;

  const now = ctx.clock.currentTick.value;
  if (!inner) {
    ctx.state.since = undefined;
    return false;
  }
  if (ctx.state.since === undefined) ctx.state.since = now;
  return now - ctx.state.since >= parseDuration(config.time);
};
