#!/usr/bin/env node
// Seed schema-namespaced field hints/labels into src/i18n/locales/{en,de}/schema.json.
// Catalog shape: { idRef, assetRef, ns: { "<normSchemaId>": { "<key>": { label?, hint? } } } }
//
//   node scripts/seed-hints.mjs --all                 # every public/schemas schema
//   node scripts/seed-hints.mjs --ids sensor.template,busses.spi
//   node scripts/seed-hints.mjs --all --dry-run       # report, write nothing
//   node scripts/seed-hints.mjs --all --force         # overwrite derivable hints too
//
// Per key, the hint prose is picked in this order:
//   1. ESPHome ref docs scoped to this component id (sensor.template / template.sensor / sensor / template)
//   2. LVGL doc-bullet prose (for lvgl.* schemas)
//   3. the pre-existing flat catalog hint (schema.fields.<key>.hint) -- so nothing is lost
// then reduced to one sentence. Labels come from real `field.label` values in the schema JSON.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectFieldKeys,
  collectFieldLabels,
  extractScopedDocs,
  firstSentence,
  mergeNs,
  normSchemaNs,
  parseLvglMdBullets
} from "../src/utils/seedHints.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "..");
const REPO = path.resolve(FRONTEND, "..");

const REF_DIR = path.join(REPO, "docs", "esphome-schema-reference", "2026.8.2");
const LVGL_MD = path.join(REPO, "LVGL_Docs", "esphome", "lvgl.md");
const SCHEMAS_DIR = path.join(FRONTEND, "public", "schemas");
const BASE_DIR = path.join(SCHEMAS_DIR, "components", "base_component");
const CATALOG_EN = path.join(FRONTEND, "src", "i18n", "locales", "en", "schema.json");
const CATALOG_DE = path.join(FRONTEND, "src", "i18n", "locales", "de", "schema.json");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : "";
};
const dryRun = has("--dry-run");
const force = has("--force");
const all = has("--all");
const onlyIds = new Set(valueOf("--ids").split(",").map((s) => s.trim()).filter(Boolean));
if (!all && !onlyIds.size) {
  console.error("Nothing to do: pass --all or --ids <schema.id,...>.");
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// --- gather every public/schemas file ---
const schemaFiles = [];
const walkDir = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full);
    else if (entry.name.endsWith(".json")) schemaFiles.push(full);
  }
};
walkDir(SCHEMAS_DIR);

// --- resolve schema-level `extends` (own fields win, recurse into base_component/) ---
const baseCache = new Map();
const loadBase = (name) => {
  if (!baseCache.has(name)) {
    const file = path.join(BASE_DIR, name.endsWith(".json") ? name : `${name}.json`);
    baseCache.set(name, fs.existsSync(file) ? readJson(file) : null);
  }
  return baseCache.get(name);
};
const mergeFieldsKeepFirst = (primary = [], secondary = []) => {
  const seen = new Set();
  const out = [];
  for (const field of [...primary, ...secondary]) {
    const key = typeof field?.key === "string" ? field.key : null;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(field);
  }
  return out;
};
// A field-level `extends` naming a base_component file ("base_sensor.json" / "foo"),
// as opposed to a catalog id like "core.positive_time_period_milliseconds".
const isFileExtends = (ext) =>
  typeof ext === "string" && (/\.json$/i.test(ext) || !ext.includes("."));
const resolveFields = (fields, guard) =>
  (Array.isArray(fields) ? fields : []).map((field) => {
    if (!field || typeof field !== "object") return field;
    let own = { ...field };
    if (field.extends && isFileExtends(field.extends) && !guard.has(field.extends)) {
      const g2 = new Set(guard);
      g2.add(field.extends);
      const base = loadBase(field.extends);
      if (base) {
        const baseR = resolveExtends(base, g2);
        own.fields = mergeFieldsKeepFirst(resolveFields(field.fields, g2), baseR.fields || []);
      }
    } else if (Array.isArray(field.fields)) {
      own.fields = resolveFields(field.fields, guard);
    }
    if (field.item && typeof field.item === "object" && Array.isArray(field.item.fields)) {
      own.item = { ...field.item, fields: resolveFields(field.item.fields, guard) };
    }
    return own;
  });
const resolveExtends = (schema, guard = new Set()) => {
  if (!schema || typeof schema !== "object") return schema || {};
  let baseFields = [];
  if (schema.extends && !guard.has(schema.extends)) {
    guard.add(schema.extends);
    const base = loadBase(schema.extends);
    if (base) baseFields = resolveExtends(base, guard).fields || [];
  }
  const own = resolveFields(schema.fields || [], guard);
  return { ...schema, fields: mergeFieldsKeepFirst(own, baseFields) };
};

// --- ESPHome ref prose, scoped by component id ---
const scopedDocs = {};
let refCount = 0;
for (const file of fs.readdirSync(REF_DIR).filter((f) => f.endsWith(".json"))) {
  try {
    const { scoped } = extractScopedDocs(readJson(path.join(REF_DIR, file)));
    for (const [comp, entries] of Object.entries(scoped)) {
      scopedDocs[comp] ||= {};
      for (const [k, v] of Object.entries(entries)) if (!scopedDocs[comp][k]) scopedDocs[comp][k] = v;
    }
    refCount += 1;
  } catch (error) {
    console.error(`skip ref ${file}: ${error.message}`);
  }
}
const lvglBullets = fs.existsSync(LVGL_MD) ? parseLvglMdBullets(fs.readFileSync(LVGL_MD, "utf8")) : {};

const oldEn = readJson(CATALOG_EN);

// Keys whose meaning is the same in every component -- a curated generic hint is
// used wherever no component-scoped prose exists. Polysemous keys (mode/type/value/
// format/channel/address/pin/...) are deliberately absent: scoped prose or nothing.
const UNIVERSAL_HINTS = {
  id: "Identifier used to reference this component elsewhere in the configuration.",
  name: "Display name shown in the frontend (e.g. Home Assistant).",
  internal: "Mark this component as internal so it is not exposed to the frontend.",
  icon: "Icon shown for this entity in the frontend.",
  device_class: "Device class of this entity (controls icon and unit in the frontend).",
  entity_category: "Category of the entity (config or diagnostic).",
  disabled_by_default: "If true, the entity is not added to the frontend until the user enables it.",
  update_interval: "How often this component is polled / updated.",
  accuracy_decimals: "Number of decimal places consumers of this value should use.",
  force_update: "Emit a state-changed event on every update even if the value is unchanged.",
  unit_of_measurement: "Unit shown next to the value in the frontend.",
  filters: "List of filters applied to the value before it is published.",
  state_class: "State class of the sensor (measurement, total, total_increasing).",
  expire_after: "Time after which the value is marked expired / unknown if no update arrives.",
  web_server_sorting_weight: "Sorting weight for this entity in the built-in web server.",
  optimistic: "Optimistic mode: a command immediately updates the reported state without confirmation.",
  assumed_state: "The real state is not known; the frontend shows separate on/off controls."
};
const oldFlatHint = (key) => UNIVERSAL_HINTS[key] || null;

// Keys polysemous enough that the flat catalog hint is likely wrong in most schemas.
// Where no component-scoped prose is found for one of these, an explicit "" is written
// so the (context-agnostic) flat fallback is suppressed -- no hint beats a wrong one.
const POLYSEMOUS = new Set([
  "mode", "type", "value", "format", "channel", "source", "action", "state",
  "level", "target", "dir", "direction", "operation", "resolution", "method"
]);

// --- derive ns.<id>.<key>.{label,hint} for every schema ---
const incomingNs = {};
let schemaCount = 0;
let hintCount = 0;
let labelCount = 0;

// Context-specific prose only -- a wrong-but-confident hint is worse than none.
const proseFor = (schemaId, domain, platform, widgetType, key) => {
  const candidates = [
    scopedDocs[schemaId],
    domain && platform ? scopedDocs[`${platform}.${domain}`] : null,
    domain && platform ? scopedDocs[`${domain}.${platform}`] : null,
    widgetType ? scopedDocs[`${domain}.${widgetType}`] : null,
    widgetType ? scopedDocs[widgetType] : null,
    platform ? scopedDocs[platform] : null,
    domain ? scopedDocs[domain] : null
  ];
  for (const bucket of candidates) {
    if (bucket && bucket[key]) return bucket[key];
  }
  if (schemaId.startsWith("lvgl") && lvglBullets[key]) return lvglBullets[key];
  return null;
};

for (const file of schemaFiles) {
  let raw;
  try {
    raw = readJson(file);
  } catch {
    continue;
  }
  const id = typeof raw?.id === "string" ? raw.id : "";
  if (!id) continue; // data lists (timezones) etc.
  if (!all && !onlyIds.has(id)) continue;
  if (BASE_DIR === path.dirname(file) && !all && !onlyIds.has(id)) continue;

  const resolved = resolveExtends(raw);
  const keys = collectFieldKeys(resolved);
  const labels = collectFieldLabels(resolved);
  const domain = typeof raw.domain === "string" ? raw.domain : "";
  const platform = typeof raw.platform === "string" ? raw.platform : "";
  const widgetType = typeof raw.widgetType === "string" ? raw.widgetType : "";
  const nsId = normSchemaNs(id);
  incomingNs[nsId] ||= {};

  for (const key of keys) {
    const entry = {};
    if (labels[key]) {
      entry.label = labels[key];
      labelCount += 1;
    }
    const prose = proseFor(id, domain, platform, widgetType, key);
    const hint =
      (prose && firstSentence(prose)) || (UNIVERSAL_HINTS[key] ? oldFlatHint(key) : null);
    if (hint) {
      entry.hint = hint;
      hintCount += 1;
    } else if (POLYSEMOUS.has(key)) {
      entry.hint = ""; // suppress the flat-tier fallback for this ambiguous key
    }
    if (entry.label || entry.hint !== undefined) incomingNs[nsId][key] = entry;
  }
  if (!Object.keys(incomingNs[nsId]).length) delete incomingNs[nsId];
  schemaCount += 1;
}

// --- merge into the en catalog. The flat `fields` tier is kept as a context-agnostic
//     fallback (SchemaField tries ns.<id> first, then fields.<key>); ns entries with a
//     blank hint deliberately shadow it for polysemous keys. ---
const existingEnNs = all ? {} : oldEn.ns || {};
const { ns: enNs, stats } = mergeNs(existingEnNs, incomingNs, { force });
const nextEn = { idRef: oldEn.idRef, assetRef: oldEn.assetRef, fields: oldEn.fields || {}, ns: enNs };
const nextEnText = `${JSON.stringify(nextEn, null, 2)}\n`;
const prevEnText = fs.readFileSync(CATALOG_EN, "utf8");

// --- de: re-key the existing flat de hints into every ns.<id> that has the key ---
const oldDe = readJson(CATALOG_DE);
const deFlat = {};
for (const [k, v] of Object.entries(oldDe.fields || {})) {
  if (v && typeof v.hint === "string" && v.hint.trim()) deFlat[k] = { hint: v.hint };
  if (v && typeof v.label === "string" && v.label.trim()) deFlat[k] = { ...(deFlat[k] || {}), label: v.label };
}
const deNs = {};
for (const [nsId, entries] of Object.entries(enNs)) {
  for (const [key, val] of Object.entries(entries)) {
    if (!deFlat[key] || val.hint === "") continue; // don't un-suppress a polysemous blank
    (deNs[nsId] ||= {})[key] = { ...deFlat[key] };
  }
}
const nextDe = { idRef: oldDe.idRef, assetRef: oldDe.assetRef, fields: oldDe.fields || {}, ns: deNs };
const nextDeText = `${JSON.stringify(nextDe, null, 2)}\n`;
const prevDeText = fs.readFileSync(CATALOG_DE, "utf8");

console.error(
  `schemas: ${schemaCount} | ref files: ${refCount} | derived ${hintCount} hints, ${labelCount} labels | ` +
    `en ns: +${stats.addedHint} hints, +${stats.addedLabel} labels, replaced ${stats.replacedHint}, kept ${stats.keptHint} | ` +
    `de ns entries: ${Object.values(deNs).reduce((n, e) => n + Object.keys(e).length, 0)}`
);

if (dryRun) {
  console.error(
    `--dry-run: en ${nextEnText === prevEnText ? "unchanged" : "would change"} ` +
      `(${(nextEnText.length / 1024) | 0} KB), de ${nextDeText === prevDeText ? "unchanged" : "would change"}.`
  );
  process.exit(0);
}

if (nextEnText !== prevEnText) {
  fs.writeFileSync(CATALOG_EN, nextEnText);
  console.error(`wrote ${CATALOG_EN} (${(nextEnText.length / 1024) | 0} KB)`);
}
if (nextDeText !== prevDeText) {
  fs.writeFileSync(CATALOG_DE, nextDeText);
  console.error(`wrote ${CATALOG_DE}`);
}
