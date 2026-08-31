import { describe, it, expect } from "vitest";
import {
  createTemplatableValue,
  getTemplatableInnerValue,
  getTemplatableMode,
  isTemplatableField,
  isTemplatableValue,
  wrapTemplatableValueForField
} from "./schemaTemplatable";

const templatableField = { templatable: true };
const plainField = {};

describe("isTemplatableValue", () => {
  it("only accepts the marker object", () => {
    expect(isTemplatableValue(createTemplatableValue("lambda", "x"))).toBe(true);
    expect(isTemplatableValue({ value: "x" })).toBe(false);
    expect(isTemplatableValue("x")).toBe(false);
    expect(isTemplatableValue(["__templatable"])).toBe(false);
    expect(isTemplatableValue(null)).toBe(false);
  });
});

describe("getTemplatableMode", () => {
  it("is literal for non-templatable fields regardless of value", () => {
    expect(getTemplatableMode(createTemplatableValue("lambda", "x"), plainField)).toBe("literal");
  });

  it("reports lambda only for a wrapped lambda value on a templatable field", () => {
    expect(getTemplatableMode(createTemplatableValue("lambda", "x"), templatableField)).toBe("lambda");
    expect(getTemplatableMode(createTemplatableValue("literal", "x"), templatableField)).toBe("literal");
    expect(getTemplatableMode("x", templatableField)).toBe("literal");
  });
});

describe("getTemplatableInnerValue", () => {
  it("unwraps a marker value on a templatable field", () => {
    expect(getTemplatableInnerValue(createTemplatableValue("lambda", 42), templatableField)).toBe(42);
  });

  it("passes plain values and non-templatable fields through", () => {
    expect(getTemplatableInnerValue("raw", templatableField)).toBe("raw");
    expect(getTemplatableInnerValue(createTemplatableValue("lambda", 42), plainField)).toEqual(
      createTemplatableValue("lambda", 42)
    );
  });
});

describe("createTemplatableValue", () => {
  it("normalises the mode to literal unless it is exactly 'lambda'", () => {
    expect(createTemplatableValue("lambda", 1).mode).toBe("lambda");
    expect(createTemplatableValue("weird", 1).mode).toBe("literal");
  });
});

describe("wrapTemplatableValueForField", () => {
  it("returns the value untouched for non-templatable fields", () => {
    expect(wrapTemplatableValueForField(plainField, "x")).toBe("x");
  });

  it("wraps, preferring an explicit lambda mode", () => {
    const wrapped = wrapTemplatableValueForField(templatableField, "id(x).state", "lambda");
    expect(isTemplatableValue(wrapped)).toBe(true);
    expect(wrapped).toMatchObject({ mode: "lambda", value: "id(x).state" });
  });

  it("keeps the inner value when re-wrapping an already wrapped value", () => {
    const once = wrapTemplatableValueForField(templatableField, "v", "lambda");
    const twice = wrapTemplatableValueForField(templatableField, once, "literal");
    expect(twice.value).toBe("v");
  });
});

it("isTemplatableField checks the flag strictly", () => {
  expect(isTemplatableField({ templatable: true })).toBe(true);
  expect(isTemplatableField({ templatable: "yes" })).toBe(false);
  expect(isTemplatableField(null)).toBe(false);
});
