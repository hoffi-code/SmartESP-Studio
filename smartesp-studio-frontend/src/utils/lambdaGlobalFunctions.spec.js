import { describe, expect, it } from "vitest";

import { LAMBDA_GLOBAL_FUNCTIONS } from "./lambdaGlobalFunctions";

const KNOWN_CATEGORIES = ["logging", "strings", "math", "time", "core"];

describe("LAMBDA_GLOBAL_FUNCTIONS", () => {
  it("uses only known categories", () => {
    LAMBDA_GLOBAL_FUNCTIONS.forEach((entry) => {
      expect(KNOWN_CATEGORIES).toContain(entry.category);
    });
  });

  it("has globally unique ids", () => {
    const ids = LAMBDA_GLOBAL_FUNCTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty id and insert on every entry", () => {
    LAMBDA_GLOBAL_FUNCTIONS.forEach((entry) => {
      expect(entry.id.trim()).not.toBe("");
      expect(entry.insert.trim()).not.toBe("");
    });
  });

  it("covers every known category", () => {
    const categories = new Set(LAMBDA_GLOBAL_FUNCTIONS.map((entry) => entry.category));
    KNOWN_CATEGORIES.forEach((category) => expect(categories.has(category)).toBe(true));
  });
});
