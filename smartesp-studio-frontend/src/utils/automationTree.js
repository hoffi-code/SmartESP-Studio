// Rekursiver Baum-Lauf ueber Schema-Felder, der Trigger (on_*-Felder, Action-Listen und
// Container wie interval:/deep_sleep:) findet -- extrahiert aus automationOverview.js
// (PR #31), damit simulationAutomation.js dieselbe Erkennung nutzen kann, ohne sie zu
// duplizieren oder das Verhalten der bestehenden Automations-Uebersicht anzutasten.
//
// Anders als automationOverview.js liefert walkAutomationTree die VOLLEN Laufzeit-
// Action-Eintraege ({type, config, fields}), keine Strings -- automationOverview.js macht
// das Stringifizieren (describeAction) selbst nach dem Aufruf, die Simulation braucht die
// vollen Objekte, um Actions tatsaechlich auszufuehren.

export const ACTION_EXTENDS = "base_actions.json";
export const DEFAULT_MAX_DEPTH = 8;

export const isActionList = (field) =>
  field?.type === "list" && field?.item?.extends === ACTION_EXTENDS;

// Trigger mit Nutzlast (on_value_range, on_message, on_boot) tragen die Actions in einem
// then-Unterfeld; der Trigger selbst ist dann eine Liste von Wrapper-Objekten. Container
// wie deep_sleep: oder interval: haben dieselbe Form -- das on_-Praefix trennt sie, sonst
// wuerde der ganze Container als ein Trigger gemeldet statt seiner einzelnen Eintraege.
export const isTriggerKey = (key) => String(key || "").startsWith("on_");

export const isWrappedTrigger = (field) =>
  field?.type === "list" &&
  isTriggerKey(field?.key) &&
  Array.isArray(field?.item?.fields) &&
  field.item.fields.some(isActionList);

const asArray = (value) => (Array.isArray(value) ? value : []);

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const lastNamedSegment = (path) =>
  [...path].reverse().find((part) => typeof part === "string") || "";

const wrappedActions = (item, fields) =>
  fields.filter(isActionList).flatMap((field) => asArray(asObject(item)[field.key]));

/**
 * @param {object[]} fields   Schema-Felder der Quelle
 * @param {object}   value    zugehoeriger Config-Ausschnitt
 * @param {string[]} prefix   Pfad bis hierher (fuers Sprungziel)
 * @param {object[]} out      Sammel-Array: {triggerKey, path, actions} je Fund, actions = volle Eintraege
 */
export const walkAutomationTree = (fields, value, prefix, depth, out, maxDepth = DEFAULT_MAX_DEPTH) => {
  if (depth > maxDepth) return;
  const config = asObject(value);

  for (const field of Array.isArray(fields) ? fields : []) {
    const key = field?.key;
    if (!key) continue;
    const path = [...prefix, key];
    const raw = config[key];

    if (isActionList(field)) {
      const actions = asArray(raw);
      // Ein then: in einem Container (interval[0].then) heisst nach dem Container, sonst
      // stuenden in der Uebersicht lauter gleichnamige "then"-Zeilen.
      const label = key === "then" ? lastNamedSegment(prefix) || key : key;
      if (actions.length) out.push({ triggerKey: label, path, actions });
      continue;
    }

    if (isWrappedTrigger(field)) {
      asArray(raw).forEach((item, index) => {
        const actions = wrappedActions(item, field.item.fields);
        if (!actions.length) return;
        out.push({ triggerKey: key, path: [...path, index], actions });
      });
      continue;
    }

    if (field.type === "object" && Array.isArray(field.fields)) {
      walkAutomationTree(field.fields, raw, path, depth + 1, out, maxDepth);
      continue;
    }

    if (field.type === "list" && Array.isArray(field.item?.fields)) {
      asArray(raw).forEach((item, index) => {
        walkAutomationTree(field.item.fields, item, [...path, index], depth + 1, out, maxDepth);
      });
    }
  }
};
