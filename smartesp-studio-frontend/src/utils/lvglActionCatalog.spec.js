import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the hand-maintained lvgl.* action / condition catalog against the schema
// files it points at -- a missing or mis-keyed file is a silent 404 at runtime.
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../public");
const readJson = (rel) => JSON.parse(readFileSync(resolve(publicDir, rel), "utf-8"));

const actions = readJson("action_list/base_actions.json").actions.filter((a) => a.id.startsWith("lvgl."));
const conditions = readJson("condition_list/base_conditions.json").conditions.filter((c) => c.id.startsWith("lvgl."));

describe("lvgl action catalog", () => {
  it("covers the 64 lvgl.* actions from the 2026.8.2 dump", () => {
    expect(actions).toHaveLength(64);
  });

  it("every entry resolves to a schema file whose id matches", () => {
    for (const entry of actions) {
      expect(entry.schemaUrl, entry.id).toBeTruthy();
      const schema = readJson(entry.schemaUrl);
      expect(schema.id, entry.schemaUrl).toBe(entry.id);
      expect(Array.isArray(schema.fields), entry.id).toBe(true);
      for (const field of schema.fields) {
        expect(field.key, `${entry.id} field`).toBeTruthy();
        expect(field.type, `${entry.id}.${field.key}`).toBeTruthy();
      }
    }
  });

  it("keeps actionDomain / domain consistent", () => {
    for (const entry of actions) {
      expect(entry.domain).toBe("lvgl");
      expect(entry.actionDomain === "lvgl" || entry.actionDomain.startsWith("lvgl.")).toBe(true);
    }
  });

  it("registers the three lvgl conditions with resolvable schemas", () => {
    expect(conditions.map((c) => c.id).sort()).toEqual([
      "lvgl.is_idle",
      "lvgl.is_paused",
      "lvgl.page.is_showing"
    ]);
    for (const entry of conditions) {
      const schema = readJson(entry.schemaUrl);
      expect(schema.id).toBe(entry.id);
      expect(Array.isArray(schema.fields)).toBe(true);
    }
  });
});
