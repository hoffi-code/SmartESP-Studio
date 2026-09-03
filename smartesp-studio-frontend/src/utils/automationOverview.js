// Sammelt alle im Projekt definierten Trigger samt ihrer Action-Ketten ein, damit sie
// an einer Stelle sichtbar sind. Die Erkennung ist wortgleich zu ListField.vue: ein Feld
// ist genau dann eine Action-Liste, wenn sein item auf base_actions.json extended --
// laufen Uebersicht und Picker hier auseinander, zeigt die Uebersicht Phantome.
//
// Der eigentliche Baum-Lauf steckt in automationTree.js (seit Simulation P5 auch von
// simulationAutomation.js genutzt) -- hier bleibt nur noch das Stringifizieren der
// gefundenen Actions (describeAction) und das Bauen der Uebersichts-Eintraege.

import { walkAutomationTree } from "./automationTree";

const describeAction = (entry) => {
  if (typeof entry === "string") return entry;
  const type = String(entry?.type || "").trim();
  return type || "custom";
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
    walkAutomationTree(fields, source.value, [], 0, found);

    for (const hit of found) {
      entries.push({
        kind: source.kind || "component",
        sourceLabel: source.label || "",
        scopeId: source.scopeId || "",
        triggerKey: hit.triggerKey,
        path: hit.path,
        actions: hit.actions.map(describeAction),
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
