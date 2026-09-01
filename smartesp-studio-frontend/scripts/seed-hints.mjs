#!/usr/bin/env node
// Seed short field hints into src/i18n/locales/en/schema.json ("fields.<key>.hint")
// from the ESPHome schema reference and the LVGL doc dump.
//
//   node scripts/seed-hints.mjs --all                 # every reference component
//   node scripts/seed-hints.mjs --ids light,sensor,font
//   node scripts/seed-hints.mjs --all --dry-run       # show diff, write nothing
//   node scripts/seed-hints.mjs --all --force          # overwrite derivable hints too
//
// Hand-authored hints and any `field.hint` set in a schema JSON always win unless --force.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractEsphomeDocs, firstSentence, mergeHints, parseLvglMdBullets } from "../src/utils/seedHints.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "..");
const REPO = path.resolve(FRONTEND, "..");

const REF_DIR = path.join(REPO, "docs", "esphome-schema-reference", "2026.8.2");
const LVGL_MD = path.join(REPO, "LVGL_Docs", "esphome", "lvgl.md");
const CATALOG_EN = path.join(FRONTEND, "src", "i18n", "locales", "en", "schema.json");

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : "";
};

const dryRun = has("--dry-run");
const force = has("--force");
const all = has("--all");
const ids = valueOf("--ids").split(",").map((s) => s.trim()).filter(Boolean);

if (!all && !ids.length) {
  console.error("Nothing to do: pass --all or --ids <a,b,c>.");
  process.exit(1);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// --- gather doc prose, keyed by field key (first non-empty wins) ---
const incomingRaw = {};
const addRaw = (map) => {
  for (const [key, text] of Object.entries(map)) {
    if (!incomingRaw[key] && text) incomingRaw[key] = text;
  }
};

// LVGL bullets first so LVGL wording wins for shared keys (bg_color, align, ...).
if (fs.existsSync(LVGL_MD)) {
  addRaw(parseLvglMdBullets(fs.readFileSync(LVGL_MD, "utf8")));
}

const refFiles = all
  ? fs.readdirSync(REF_DIR).filter((f) => f.endsWith(".json"))
  : ids.map((id) => `${id}.json`).filter((f) => fs.existsSync(path.join(REF_DIR, f)));

let refComponents = 0;
for (const file of refFiles) {
  try {
    addRaw(extractEsphomeDocs(readJson(path.join(REF_DIR, file))));
    refComponents += 1;
  } catch (error) {
    console.error(`skip ${file}: ${error.message}`);
  }
}

// --- transform to one-liners ---
const incoming = {};
let dropped = 0;
for (const [key, raw] of Object.entries(incomingRaw)) {
  const hint = firstSentence(raw);
  if (hint) incoming[key] = hint;
  else dropped += 1;
}

// --- merge into the catalog ---
const catalog = readJson(CATALOG_EN);
const { fields, stats } = mergeHints(catalog.fields || {}, incoming, { force });
const next = { ...catalog, fields };
const nextText = `${JSON.stringify(next, null, 2)}\n`;
const prevText = fs.readFileSync(CATALOG_EN, "utf8");

console.error(
  `sources: ${refComponents} ref components + LVGL md | derived ${Object.keys(incoming).length} hints ` +
    `(${dropped} unusable) | added ${stats.added}, replaced ${stats.replaced}, kept ${stats.kept}`
);

if (nextText === prevText) {
  console.error("schema.json already up to date.");
  process.exit(0);
}

if (dryRun) {
  console.error(`--dry-run: ${CATALOG_EN} would change (${stats.added + stats.replaced} entries).`);
  process.exit(0);
}

fs.writeFileSync(CATALOG_EN, nextText);
console.error(`wrote ${CATALOG_EN}`);
