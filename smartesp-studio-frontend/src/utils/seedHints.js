// Pure helpers for scripts/seed-hints.mjs -- turn ESPHome / LVGL doc prose into the
// short one-liners that feed src/i18n/locales/en/schema.json ("fields.<key>.hint").
// Kept here (not under scripts/) so it runs under vitest.

const MIN_HINT_LENGTH = 12;
const MAX_HINT_LENGTH = 200;

// "**int**: ...", "**boolean**: ...", "**[ID](url)**: ..." leading type annotations.
const LEADING_TYPE_RE = /^\*\*[^*]+\*\*\s*:\s*/;

export const firstSentence = (raw) => {
  let text = String(raw || "");
  if (!text.trim()) return null;

  // markdown links -> their label
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // bold / italic markers
  text = text.replace(/\*\*/g, "").replace(/\*(?=\S)([^*]+)\*/g, "$1").replace(/`/g, "");
  text = text.trim();
  // drop a leading type/kind annotation:
  //   "**int**:"  "Pin:"  "icon:"  "dict:"  "string or Area Configuration:"  "list of strings:"
  text = text.replace(LEADING_TYPE_RE, "");
  text = text.replace(
    /^(int|integer|boolean|bool|string|str|float|number|list|enum|time|id|pin|icon|dict|mapping|schema|templatable|color|action|automation|trigger|effect)\b[^:]{0,40}:\s*/i,
    ""
  );
  // "See also" / "Defaults to" tails
  text = text.split(/\*?See also:?/i)[0];
  // first line only
  text = text.split(/\r?\n/)[0];

  const trimmed = text.trim();
  // cut at the first sentence boundary: a period followed by space + capital, or end
  const match = trimmed.match(/^.*?[.!?](?=\s|$)/);
  let sentence = (match ? match[0] : trimmed).trim();

  // a stray "Defaults to ..." can still be the whole first sentence-ish chunk
  sentence = sentence.replace(/\s*Defaults to .*$/i, "").trim();
  sentence = sentence.replace(/\s+/g, " ");

  if (sentence.length < MIN_HINT_LENGTH) return null;
  if (sentence.length > MAX_HINT_LENGTH) {
    sentence = `${sentence.slice(0, MAX_HINT_LENGTH - 1).trimEnd()}…`;
  }
  return sentence;
};

// Lines like "- default_font ( Optional , ID ): The ID of the font ...".
// Sub-config-vars are sometimes jammed onto the same line; we only take the parent.
const LVGL_BULLET_RE = /^-\s+([a-z0-9_]+)\s+\(\s*(?:Required|Optional)[^)]*\)\s*:\s*(.+)$/;

export const parseLvglMdBullets = (mdText) => {
  const out = {};
  String(mdText || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(LVGL_BULLET_RE);
      if (!m) return;
      const key = m[1];
      if (out[key]) return; // first definition wins
      out[key] = m[2].trim();
    });
  return out;
};

// Walk an ESPHome schema-reference component JSON, collecting `config_vars.<key>.docs`
// from every nested schema (CONFIG_SCHEMA, WIDGET_TYPES.<t>.schema, extras.schema, ...).
export const extractEsphomeDocs = (componentJson) => {
  const out = {};
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.config_vars && typeof node.config_vars === "object") {
      for (const [key, def] of Object.entries(node.config_vars)) {
        if (out[key]) continue;
        const docs = def && typeof def === "object" ? def.docs : "";
        if (typeof docs === "string" && docs.trim()) out[key] = docs;
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value);
    }
  };
  visit(componentJson);
  return out;
};

// Schema id -> i18n key segment. Must match schemaFieldLabel.normSchemaNs.
export const normSchemaNs = (id) => String(id || "").trim().replace(/[./]+/g, "_");

// Component-id pattern in the ESPHome reference: "sensor", "sensor.template",
// "binary_sensor.gpio", "lvgl.widget.bar" (dotted, lowercase, up to 3 segments).
const COMP_ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,3}$/;

// Walk an ESPHome schema-reference file, collecting `config_vars.<key>.docs` both
// per owning component id and flat (first-wins). The component id is a dotted
// key anywhere in the tree ("template.sensor") or a top-level single-segment key
// ("sensor" in sensor.json); structural keys (schemas/schema/config_vars/...) are
// never treated as component ids.
export const extractScopedDocs = (refJson) => {
  const scoped = {};
  const flat = {};
  const visit = (node, compId, depth) => {
    if (!node || typeof node !== "object") return;
    if (node.config_vars && typeof node.config_vars === "object") {
      for (const [key, def] of Object.entries(node.config_vars)) {
        const docs = def && typeof def === "object" ? def.docs : "";
        if (typeof docs !== "string" || !docs.trim()) continue;
        if (compId) {
          (scoped[compId] ||= {});
          if (!scoped[compId][key]) scoped[compId][key] = docs;
        }
        if (!flat[key]) flat[key] = docs;
      }
    }
    for (const [k, value] of Object.entries(node)) {
      if (!value || typeof value !== "object") continue;
      const dotted = k.includes(".") && COMP_ID_RE.test(k);
      const topLevel = depth === 0 && COMP_ID_RE.test(k);
      visit(value, dotted || topLevel ? k : compId, depth + 1);
    }
  };
  visit(refJson, "", 0);
  return { scoped, flat };
};

// All field keys of a resolved schema, including nested object / list-item fields.
export const collectFieldKeys = (schema) => {
  const keys = new Set();
  const walk = (fields) => {
    (Array.isArray(fields) ? fields : []).forEach((field) => {
      if (field?.key) keys.add(field.key);
      if (Array.isArray(field?.fields)) walk(field.fields);
      if (Array.isArray(field?.item?.fields)) walk(field.item.fields);
      if (Array.isArray(field?.item)) walk(field.item);
    });
  };
  walk(schema?.fields);
  return keys;
};

// Real `field.label` values of a resolved schema (skips filter-catalog `label`s and
// generated_list `count.label` -- those are not schema.fields entries).
export const collectFieldLabels = (schema) => {
  const out = {};
  const walk = (fields) => {
    (Array.isArray(fields) ? fields : []).forEach((field) => {
      if (field?.key && typeof field.label === "string" && field.label.trim()) {
        out[field.key] = field.label.trim();
      }
      if (Array.isArray(field?.fields)) walk(field.fields);
      if (Array.isArray(field?.item?.fields)) walk(field.item.fields);
    });
  };
  walk(schema?.fields);
  return out;
};

// Nested { <normId>: { <key>: { label?, hint? } } } merge. Existing non-empty values
// win unless `force`; sorted output.
export const mergeNs = (existingNs, incomingNs, { force = false } = {}) => {
  const out = {};
  for (const [ns, entries] of Object.entries(existingNs || {})) {
    out[ns] = {};
    for (const [key, val] of Object.entries(entries || {})) out[ns][key] = { ...val };
  }
  const stats = { addedHint: 0, keptHint: 0, replacedHint: 0, addedLabel: 0 };
  for (const [ns, entries] of Object.entries(incomingNs || {})) {
    out[ns] ||= {};
    for (const [key, incoming] of Object.entries(entries || {})) {
      const cur = out[ns][key] || {};
      const next = { ...cur };
      if (incoming.label && !cur.label) {
        next.label = incoming.label;
        stats.addedLabel += 1;
      }
      // An explicit "" hint is a deliberate "no hint here" that overrides the flat tier.
      if (incoming.hint !== undefined) {
        if (cur.hint && cur.hint.trim()) {
          if (force && cur.hint !== incoming.hint) {
            next.hint = incoming.hint;
            stats.replacedHint += 1;
          } else {
            stats.keptHint += 1;
          }
        } else {
          next.hint = incoming.hint;
          stats.addedHint += 1;
        }
      }
      if (next.label || next.hint !== undefined) out[ns][key] = next;
    }
  }
  const sorted = {};
  for (const ns of Object.keys(out).sort((a, b) => a.localeCompare(b))) {
    const inner = {};
    for (const key of Object.keys(out[ns]).sort((a, b) => a.localeCompare(b))) {
      inner[key] = out[ns][key];
    }
    if (Object.keys(inner).length) sorted[ns] = inner;
  }
  return { ns: sorted, stats };
};

// Merge freshly derived hints into the existing en/schema.json `fields` map.
// Existing entries win unless `force`; only `hint` is touched (labels stay runtime-humanised).
export const mergeHints = (existingFields, incoming, { force = false } = {}) => {
  const fields = {};
  for (const [key, value] of Object.entries(existingFields || {})) {
    fields[key] = { ...value };
  }
  const stats = { added: 0, kept: 0, replaced: 0, skippedNoText: 0 };

  for (const [key, hint] of Object.entries(incoming || {})) {
    if (!hint) {
      stats.skippedNoText += 1;
      continue;
    }
    const current = fields[key];
    if (current && typeof current.hint === "string" && current.hint.trim()) {
      if (force && current.hint !== hint) {
        fields[key] = { ...current, hint };
        stats.replaced += 1;
      } else {
        stats.kept += 1;
      }
      continue;
    }
    fields[key] = { ...(current || {}), hint };
    stats.added += 1;
  }

  const sorted = {};
  for (const key of Object.keys(fields).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = fields[key];
  }
  return { fields: sorted, stats };
};
