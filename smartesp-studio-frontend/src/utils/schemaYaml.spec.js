import { describe, it, expect } from "vitest";
import { formatYamlValue } from "./schemaYaml";

describe("formatYamlValue", () => {
  it("renders primitives", () => {
    expect(formatYamlValue(null)).toBe("null");
    expect(formatYamlValue(true)).toBe("true");
    expect(formatYamlValue(false)).toBe("false");
    expect(formatYamlValue(42)).toBe("42");
    expect(formatYamlValue(3.5)).toBe("3.5");
  });

  it("passes !secret references through untouched", () => {
    expect(formatYamlValue("!secret wifi_password", "password")).toBe("!secret wifi_password");
  });

  it("leaves lambda / id / slug values unquoted", () => {
    expect(formatYamlValue("id(foo).state", "lambda")).toBe("id(foo).state");
    expect(formatYamlValue("my_sensor", "id")).toBe("my_sensor");
    expect(formatYamlValue("living-room", "slug")).toBe("living-room");
  });

  it("quotes and escapes text-like fields", () => {
    expect(formatYamlValue("hello", "text")).toBe('"hello"');
    expect(formatYamlValue('say "hi"', "text")).toBe('"say \\"hi\\""');
    expect(formatYamlValue("mdi:home", "icon")).toBe('"mdi:home"');
  });

  it("honours suppressQuotes from an object field type", () => {
    expect(formatYamlValue("keep me", { type: "text", suppressQuotes: true })).toBe("keep me");
  });

  it("returns other strings unchanged", () => {
    expect(formatYamlValue("plain", "number")).toBe("plain");
    expect(formatYamlValue("plain")).toBe("plain");
  });
});
