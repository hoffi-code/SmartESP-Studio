import { describe, expect, it } from "vitest";

import {
  buildEntityStateMap,
  buildSimulationEntities,
  kindForDomain,
  setEntityField,
  setEntityValue
} from "./simulationEntityState";

const idEntry = (id, domain, overrides = {}) => ({
  id,
  idLower: id.toLowerCase(),
  domain,
  componentId: `${domain}.test`,
  scopeId: "component:0",
  ...overrides
});

describe("kindForDomain", () => {
  it("classifies tier 1 domains", () => {
    expect(kindForDomain("sensor")).toBe("numeric");
    expect(kindForDomain("number")).toBe("numeric");
    expect(kindForDomain("text_sensor")).toBe("text");
    expect(kindForDomain("binary_sensor")).toBe("boolean");
    expect(kindForDomain("switch")).toBe("boolean");
  });

  it("classifies tier 2 domains as struct", () => {
    expect(kindForDomain("light")).toBe("struct");
    expect(kindForDomain("cover")).toBe("struct");
    expect(kindForDomain("fan")).toBe("struct");
    expect(kindForDomain("climate")).toBe("struct");
  });

  it("classifies globals separately and everything else as unsupported", () => {
    expect(kindForDomain("globals")).toBe("globals");
    expect(kindForDomain("media_player")).toBe("unsupported");
    expect(kindForDomain("")).toBe("unsupported");
  });
});

describe("buildSimulationEntities", () => {
  it("gives tier 1 entities a domain-appropriate default value", () => {
    const entities = buildSimulationEntities(
      [idEntry("temp", "sensor"), idEntry("relay", "switch"), idEntry("name", "text_sensor")],
      { components: [] }
    );
    expect(entities.find((e) => e.id === "temp")).toMatchObject({ kind: "numeric", value: 0 });
    expect(entities.find((e) => e.id === "relay")).toMatchObject({ kind: "boolean", value: false });
    expect(entities.find((e) => e.id === "name")).toMatchObject({ kind: "text", value: "" });
  });

  it("gives tier 2 entities reduced struct defaults", () => {
    const entities = buildSimulationEntities([idEntry("lamp", "light")], { components: [] });
    expect(entities[0]).toMatchObject({ kind: "struct", value: null, fields: { on: false, brightness: 1 } });
  });

  it("marks unmodelled domains as unsupported without touching a default value", () => {
    const entities = buildSimulationEntities([idEntry("tv", "media_player")], { components: [] });
    expect(entities[0]).toMatchObject({ kind: "unsupported", value: null });
  });

  it("reads a global's initial_value according to its declared type", () => {
    const entities = buildSimulationEntities([idEntry("boot_count", "globals", { scopeId: "tab:Automation:globals" })], {
      components: [],
      automation: { globals: [{ id: "boot_count", type: "int", initial_value: "5" }] }
    });
    expect(entities[0]).toMatchObject({ kind: "numeric", value: 5 });
  });

  it("falls back to a kind-appropriate default when a global has no initial_value", () => {
    const entities = buildSimulationEntities([idEntry("flag", "globals", { scopeId: "tab:Automation:globals" })], {
      components: [],
      automation: { globals: [{ id: "flag", type: "bool" }] }
    });
    expect(entities[0]).toMatchObject({ kind: "boolean", value: false });
  });

  it("carries a sensor's filters array from its component config", () => {
    const entities = buildSimulationEntities([idEntry("temp", "sensor")], {
      components: [{ id: "sensor.adc", config: { id: "temp", filters: [{ type: "offset", config: { value: 1 } }] } }]
    });
    expect(entities[0].filters).toEqual([{ type: "offset", config: { value: 1 } }]);
  });

  it("deduplicates repeated ids and skips entries without an id", () => {
    const entities = buildSimulationEntities(
      [idEntry("temp", "sensor"), idEntry("temp", "sensor"), { domain: "sensor" }],
      { components: [] }
    );
    expect(entities).toHaveLength(1);
  });
});

describe("buildEntityStateMap / setEntityValue / setEntityField", () => {
  it("indexes entities by id", () => {
    const map = buildEntityStateMap([idEntry("temp", "sensor"), idEntry("relay", "switch")], { components: [] });
    expect(Object.keys(map).sort()).toEqual(["relay", "temp"]);
  });

  it("setEntityValue updates a scalar entity in place and is a no-op for an unknown id", () => {
    const map = buildEntityStateMap([idEntry("temp", "sensor")], { components: [] });
    setEntityValue(map, "temp", 21.5);
    expect(map.temp.value).toBe(21.5);
    expect(() => setEntityValue(map, "missing", 1)).not.toThrow();
  });

  it("setEntityField merges into a struct entity and ignores non-struct entities", () => {
    const map = buildEntityStateMap([idEntry("lamp", "light"), idEntry("temp", "sensor")], { components: [] });
    setEntityField(map, "lamp", "brightness", 0.5);
    expect(map.lamp.fields).toEqual({ on: false, brightness: 0.5 });
    setEntityField(map, "temp", "value", 5);
    expect(map.temp.fields).toBeNull();
  });
});
