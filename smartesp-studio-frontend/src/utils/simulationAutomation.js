// Sammelt Trigger-Ketten fuer die Simulations-Engine ein -- gleiche Baum-Erkennung wie die
// Automations-Uebersicht (PR #31, automationOverview.js), aber mit den VOLLEN Laufzeit-
// Action-Eintraegen ({type, config, fields}) statt Type-Strings, damit simulationExecutor.js
// (P6) sie tatsaechlich ausfuehren kann.
//
// on_time-Trigger sind im kuratierten Schema ohne Cron-Felder (seconds/minutes/hours/
// days_of_week fehlen) -- ohne Datenbasis lassen sie sich nicht automatisch feuern, bekommen
// deshalb wie ein Lambda-Konstrukt manual:true (P7 zeigt dafuer einen manuellen Ausloeser).

import { DEFAULT_MAX_DEPTH, walkAutomationTree } from "./automationTree";

const NOT_AUTOMATIC_TRIGGER_KEYS = new Set(["on_time"]);

/**
 * sources: [{ kind, label, scopeId, schema, value, modeLevel }] -- dieselbe Form wie
 * automationOverview.js' collectAutomationEntries erwartet (BuilderView.vue liefert schon
 * automationSources.value in genau dieser Form).
 */
export const collectSimulationTriggers = ({ sources = [] } = {}) => {
  const entries = [];

  for (const source of Array.isArray(sources) ? sources : []) {
    const fields = source?.schema?.fields;
    if (!Array.isArray(fields) || !fields.length) continue;

    const found = [];
    walkAutomationTree(fields, source.value, [], 0, found, DEFAULT_MAX_DEPTH);

    for (const hit of found) {
      entries.push({
        kind: source.kind || "component",
        sourceLabel: source.label || "",
        scopeId: source.scopeId || "",
        triggerKey: hit.triggerKey,
        path: hit.path,
        actions: hit.actions,
        manual: NOT_AUTOMATIC_TRIGGER_KEYS.has(hit.triggerKey),
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
