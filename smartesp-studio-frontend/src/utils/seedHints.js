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
