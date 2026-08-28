import { describe, it, expect } from "vitest";
import {
  MODE_LEVELS,
  fieldModeLevel,
  isModeLevelVisible,
  maxModeLevel,
  modeLevelRank,
  normalizeModeLevel
} from "./schemaModeLevel";

describe("normalizeModeLevel", () => {
  it("accepts the canonical names case-insensitively", () => {
    expect(normalizeModeLevel("advanced")).toBe("Advanced");
    expect(normalizeModeLevel("NORMAL")).toBe("Normal");
  });

  it("strips a trailing 'mode' word", () => {
    expect(normalizeModeLevel("Advanced mode")).toBe("Advanced");
  });

  it("falls back for unknown or non-string input", () => {
    expect(normalizeModeLevel("wat")).toBe("Simple");
    expect(normalizeModeLevel(undefined)).toBe("Simple");
    expect(normalizeModeLevel("", "Normal")).toBe("Normal");
    expect(normalizeModeLevel("x", "bogus")).toBe("Simple");
  });
});

describe("modeLevelRank", () => {
  it("orders Simple < Normal < Advanced", () => {
    expect(modeLevelRank("Simple")).toBeLessThan(modeLevelRank("Normal"));
    expect(modeLevelRank("Normal")).toBeLessThan(modeLevelRank("Advanced"));
  });
});

describe("maxModeLevel", () => {
  it("returns the highest level among its arguments", () => {
    expect(maxModeLevel("Simple", "Advanced", "Normal")).toBe("Advanced");
    expect(maxModeLevel("Simple", "Normal")).toBe("Normal");
    expect(maxModeLevel()).toBe("Simple");
  });
});

describe("fieldModeLevel", () => {
  it("reads the field's lvl, defaulting to Simple", () => {
    expect(fieldModeLevel({ lvl: "Advanced" })).toBe("Advanced");
    expect(fieldModeLevel({})).toBe("Simple");
    expect(fieldModeLevel(null)).toBe("Simple");
  });
});

describe("isModeLevelVisible", () => {
  it("shows a field when its level is at or below the active level", () => {
    expect(isModeLevelVisible("Normal", "Advanced")).toBe(true);
    expect(isModeLevelVisible("Advanced", "Normal")).toBe(false);
    expect(isModeLevelVisible("Simple", "Simple")).toBe(true);
  });
});

it("MODE_LEVELS is frozen", () => {
  expect(Object.isFrozen(MODE_LEVELS)).toBe(true);
});
