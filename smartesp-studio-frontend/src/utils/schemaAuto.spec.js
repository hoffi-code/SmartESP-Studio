import { describe, it, expect } from "vitest";
import {
  generateFieldValue,
  getValueByPath,
  isSecretReferenceValue,
  normalizeSlugValue,
  resolveAutoValue,
  resolveFieldValue,
  resolveGenerationSpec,
  validateGeneratedPasswordValue
} from "./schemaAuto";

describe("getValueByPath", () => {
  it("walks a dotted path", () => {
    expect(getValueByPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
  });

  it("returns undefined for a missing branch or bad path", () => {
    expect(getValueByPath({ a: 1 }, "a.b")).toBeUndefined();
    expect(getValueByPath({}, "")).toBeUndefined();
  });
});

describe("normalizeSlugValue", () => {
  it("lowercases, transliterates Polish, and dash-collapses", () => {
    expect(normalizeSlugValue("Salon Łóżko")).toBe("salon-lozko");
    expect(normalizeSlugValue("  a__b  c ")).toBe("a-b-c");
  });

  it("honours the max length", () => {
    expect(normalizeSlugValue("abcdefghij", 4)).toBe("abcd");
  });
});

describe("isSecretReferenceValue", () => {
  it("matches a leading !secret token", () => {
    expect(isSecretReferenceValue("!secret wifi_pw")).toBe(true);
    expect(isSecretReferenceValue("  !secret x")).toBe(true);
    expect(isSecretReferenceValue("not !secret")).toBe(false);
    expect(isSecretReferenceValue(null)).toBe(false);
  });
});

describe("resolveAutoValue", () => {
  it("derives a slug field from another field via autoPath", () => {
    const field = { type: "slug", settings: { autoPath: "esphome.name", maxLength: 24 } };
    expect(resolveAutoValue(field, {}, { esphome: { name: "Living Room" } })).toBe("living-room");
  });

  it("uses fallbackText when the source is empty", () => {
    const field = { type: "slug", settings: { autoPath: "x.y", fallbackText: "Node" } };
    expect(resolveAutoValue(field, {}, {})).toBe("node");
  });

  it("joins source and fallback for an ssid field", () => {
    const field = { type: "ssid", settings: { autoPath: "n", fallbackText: "AP" } };
    expect(resolveAutoValue(field, {}, { n: "Device" })).toBe("Device AP");
  });

  it("returns undefined for unrelated field types", () => {
    expect(resolveAutoValue({ type: "text" }, {}, {})).toBeUndefined();
  });
});

describe("resolveGenerationSpec", () => {
  it("returns an inert spec for non-password fields", () => {
    expect(resolveGenerationSpec({ type: "text" })).toMatchObject({ mode: "none", onEmpty: false });
  });

  it("reads the generator settings for a password field", () => {
    const spec = resolveGenerationSpec({
      type: "password",
      settings: { generator: { mode: "password", onEmpty: true, minLength: 8, length: 20 } }
    });
    expect(spec).toMatchObject({ mode: "password", onEmpty: true, minLength: 8, length: 20 });
  });
});

describe("validateGeneratedPasswordValue", () => {
  const field = {
    type: "password",
    settings: { generator: { mode: "password", onEmpty: true, minLength: 8 } }
  };

  it("passes a !secret reference straight through", () => {
    expect(validateGeneratedPasswordValue(field, "!secret pw")).toBe("");
  });

  it("requires a value and enforces minLength", () => {
    expect(validateGeneratedPasswordValue(field, "")).toBe("Password is required.");
    expect(validateGeneratedPasswordValue(field, "short")).toBe(
      "Password must be at least 8 characters."
    );
    expect(validateGeneratedPasswordValue(field, "longenough")).toBe("");
  });

  it("stays silent when generation is not configured", () => {
    expect(validateGeneratedPasswordValue({ type: "password" }, "")).toBe("");
  });
});

describe("generateFieldValue", () => {
  it("produces a string of the requested length in password mode", () => {
    const value = generateFieldValue({
      type: "password",
      settings: { generator: { mode: "password", length: 16 } }
    });
    expect(value).toHaveLength(16);
    expect(value).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("returns an empty string when no generator is configured", () => {
    expect(generateFieldValue({ type: "password" })).toBe("");
  });
});

describe("resolveFieldValue", () => {
  const fields = [{ key: "name", default: "fallback" }];

  it("keeps a meaningful current value", () => {
    expect(resolveFieldValue("name", { name: "set" }, fields)).toBe("set");
  });

  it("drops to the schema default for blank values", () => {
    expect(resolveFieldValue("name", { name: "  " }, fields)).toBe("fallback");
  });

  it("returns the current value when the key is not in the schema", () => {
    expect(resolveFieldValue("other", { other: "" }, fields)).toBe("");
  });
});
