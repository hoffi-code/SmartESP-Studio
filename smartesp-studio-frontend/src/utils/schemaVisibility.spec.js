import { describe, it, expect } from "vitest";
import {
  buildGlobalRegistry,
  isFieldVisible,
  matchesDependency,
  resolveDependentValue
} from "./schemaVisibility";

describe("matchesDependency", () => {
  it("matches when there is no dependency", () => {
    expect(matchesDependency(null, undefined)).toBe(true);
  });

  it("compares against a single value", () => {
    expect(matchesDependency({ value: "wifi" }, "wifi")).toBe(true);
    expect(matchesDependency({ value: "wifi" }, "ethernet")).toBe(false);
  });

  it("checks membership in values", () => {
    expect(matchesDependency({ values: ["a", "b"] }, "b")).toBe(true);
    expect(matchesDependency({ values: ["a", "b"] }, "c")).toBe(false);
  });

  it("supports notValue", () => {
    expect(matchesDependency({ notValue: "none" }, "mqtt")).toBe(true);
    expect(matchesDependency({ notValue: "none" }, "none")).toBe(false);
  });

  it("falls back to a truthiness check", () => {
    expect(matchesDependency({}, "something")).toBe(true);
    expect(matchesDependency({}, "")).toBe(false);
  });
});

describe("resolveDependentValue", () => {
  const fields = [{ key: "mode", default: "auto" }];

  it("prefers the current value map", () => {
    expect(resolveDependentValue("mode", { mode: "manual" }, fields)).toBe("manual");
  });

  it("falls back to the schema default", () => {
    expect(resolveDependentValue("mode", {}, fields)).toBe("auto");
  });

  it("returns undefined when nothing is known", () => {
    expect(resolveDependentValue("missing", {}, fields)).toBeUndefined();
  });
});

describe("isFieldVisible", () => {
  it("hides fields marked hidden", () => {
    expect(isFieldVisible({ hidden: true }, {}, [], {})).toBe(false);
  });

  it("shows fields without dependencies", () => {
    expect(isFieldVisible({ key: "name" }, {}, [], {})).toBe(true);
  });

  it("evaluates a local dependsOn against the value map", () => {
    const field = { key: "static_ip", dependsOn: { key: "use_dhcp", value: false } };
    expect(isFieldVisible(field, { use_dhcp: false }, [], {})).toBe(true);
    expect(isFieldVisible(field, { use_dhcp: true }, [], {})).toBe(false);
  });

  it("evaluates a globalDependsOn against the global store", () => {
    const field = { key: "psram_opt", globalDependsOn: { key: "psram", value: true } };
    expect(isFieldVisible(field, {}, [], { psram: true })).toBe(true);
    expect(isFieldVisible(field, {}, [], { psram: false })).toBe(false);
  });
});

describe("buildGlobalRegistry", () => {
  it("collects set_global markers from top-level fields", () => {
    const registry = buildGlobalRegistry([
      { config: { psram: true }, fields: [{ key: "psram", set_global: "psram" }] }
    ]);
    expect(registry).toEqual({ psram: true });
  });

  it("uses the field default when the value is missing", () => {
    const registry = buildGlobalRegistry([
      { config: {}, fields: [{ key: "variant", default: "esp32", set_global: "board_variant" }] }
    ]);
    expect(registry).toEqual({ board_variant: "esp32" });
  });

  it("walks nested object and list-of-object fields", () => {
    const registry = buildGlobalRegistry([
      {
        config: { wifi: { enabled: true }, sensors: [{ kind: "temp" }] },
        fields: [
          {
            key: "wifi",
            type: "object",
            fields: [{ key: "enabled", set_global: "network:wifi" }]
          },
          {
            key: "sensors",
            type: "list",
            item: { type: "object", fields: [{ key: "kind", set_global: "sensor_kind" }] }
          }
        ]
      }
    ]);
    expect(registry).toEqual({ "network:wifi": true, sensor_kind: "temp" });
  });
});
