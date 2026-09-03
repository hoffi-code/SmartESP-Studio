import { describe, expect, it } from "vitest";

import { buildIdRefOptions } from "./schemaIdRefs";

const entry = (id, domain, scopeId = `component:${id}`) => ({ id, idLower: id.toLowerCase(), domain, componentId: id, scopeId });

const idIndex = [
  entry("temp", "sensor"),
  entry("door", "binary_sensor"),
  entry("relay", "switch"),
  entry("mode", "select")
];

describe("buildIdRefOptions", () => {
  it("filtert auf eine einzelne Domain (bestehendes Verhalten)", () => {
    expect(buildIdRefOptions({ idIndex, domain: "sensor" })).toEqual(["temp"]);
  });

  it("filtert auf mehrere Domains, wenn domain ein Array ist (LVGL bind_id)", () => {
    expect(buildIdRefOptions({ idIndex, domain: ["sensor", "binary_sensor", "select"] })).toEqual(["door", "mode", "temp"]);
  });

  it("liefert alle Domains ohne domain-Angabe", () => {
    expect(buildIdRefOptions({ idIndex, domain: "" })).toEqual(["door", "mode", "relay", "temp"]);
  });

  it("liefert alle Domains bei einem leeren Array", () => {
    expect(buildIdRefOptions({ idIndex, domain: [] })).toEqual(["door", "mode", "relay", "temp"]);
  });

  it("respektiert weiterhin den Selbstbezug-Ausschluss bei Mehrfach-Domain", () => {
    const options = buildIdRefOptions({
      idIndex,
      domain: ["sensor", "binary_sensor"],
      contextScopeId: "component:temp"
    });
    expect(options).toEqual(["door"]);
  });
});
