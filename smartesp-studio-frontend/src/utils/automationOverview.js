// Sammelt alle im Projekt definierten Trigger samt ihrer Action-Ketten ein, damit sie
// an einer Stelle sichtbar sind. Die Erkennung ist wortgleich zu ListField.vue: ein Feld
// ist genau dann eine Action-Liste, wenn sein item auf base_actions.json extended --
// laufen Uebersicht und Picker hier auseinander, zeigt die Uebersicht Phantome.

const ACTION_EXTENDS = "base_actions.json";
const MAX_DEPTH = 8;

const isActionList = (field) =>
  field?.type === "list" && field?.item?.extends === ACTION_EXTENDS;

// Trigger mit Nutzlast (on_value_range, on_message, on_boot) tragen die Actions in einem
// then-Unterfeld; der Trigger selbst ist dann eine Liste von Wrapper-Objekten. Container
// wie deep_sleep: oder interval: haben dieselbe Form -- das on_-Praefix trennt sie, sonst
// wuerde der ganze Container als ein Trigger gemeldet statt seiner einzelnen Eintraege.
const isTriggerKey = (key) => String(key || "").startsWith("on_");

const isWrappedTrigger = (field) =>
  field?.type === "list" &&
  isTriggerKey(field?.key) &&
  Array.isArray(field?.item?.fields) &&
  field.item.fields.some(isActionList);

const asArray = (value) => (Array.isArray(value) ? value : []);

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const describeAction = (entry) => {
  if (typeof entry === "string") return entry;
  const type = String(entry?.type || "").trim();
  return type || "custom";
};

const lastNamedSegment = (path) =>
  [...path].reverse().find((part) => typeof part === "string") || "";

const wrappedActions = (item, fields) =>
  fields.filter(isActionList).flatMap((field) => asArray(asObject(item)[field.key]));

/**
 * @param {object[]} fields  Schema-Felder der Quelle
 * @param {object}   value   zugehoeriger Config-Ausschnitt
 * @param {string[]} prefix  Pfad bis hierher (fuers Sprungziel)
 */
const walk = (fields, value, prefix, depth, out) => {
  if (depth > MAX_DEPTH) return;
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
      if (actions.length) out.push({ triggerKey: label, path, actions: actions.map(describeAction) });
      continue;
    }

    if (isWrappedTrigger(field)) {
      asArray(raw).forEach((item, index) => {
        const actions = wrappedActions(item, field.item.fields);
        if (!actions.length) return;
        out.push({
          triggerKey: key,
          path: [...path, index],
          actions: actions.map(describeAction)
        });
      });
      continue;
    }

    if (field.type === "object" && Array.isArray(field.fields)) {
      walk(field.fields, raw, path, depth + 1, out);
      continue;
    }

    if (field.type === "list" && Array.isArray(field.item?.fields)) {
      asArray(raw).forEach((item, index) => {
        walk(field.item.fields, item, [...path, index], depth + 1, out);
      });
    }
  }
};

/**
 * sources: [{ kind, label, scopeId, schema, value, modeLevel }]
 * -> [{ kind, sourceLabel, scopeId, triggerKey, path, actions, origin }]
 *
 * origin hat die Form, die handleYamlLineClick in BuilderView erwartet -- der Sprung aus
 * der Uebersicht laeuft damit ueber denselben Weg wie ein Klick in der YAML-Vorschau.
 */
export const collectAutomationEntries = ({ sources = [] } = {}) => {
  const entries = [];

  for (const source of Array.isArray(sources) ? sources : []) {
    const fields = source?.schema?.fields;
    if (!Array.isArray(fields) || !fields.length) continue;

    const found = [];
    walk(fields, source.value, [], 0, found);

    for (const hit of found) {
      entries.push({
        kind: source.kind || "component",
        sourceLabel: source.label || "",
        scopeId: source.scopeId || "",
        triggerKey: hit.triggerKey,
        path: hit.path,
        actions: hit.actions,
        origin: {
          type: "field",
          scopeId: source.scopeId || "",
          path: hit.path,
          modeLevel: source.modeLevel || ""
        }
      });
    }
  }

  return entries;
};

export const groupAutomationEntries = (entries) => {
  const groups = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = `${entry.kind}:${entry.scopeId}:${entry.sourceLabel}`;
    if (!groups.has(key)) {
      groups.set(key, { key, kind: entry.kind, label: entry.sourceLabel, entries: [] });
    }
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()];
};
