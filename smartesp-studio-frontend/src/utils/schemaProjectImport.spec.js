import { describe, expect, it } from "vitest";

import { mapYamlObjectToSchemaConfig } from "./schemaProjectImport";

describe("mapYamlObjectToSchemaConfig - variable_map fields", () => {
  const fields = [{ key: "variables", type: "variable_map", required: false }];

  it("turns a parsed yaml mapping into an ordered name/type list", () => {
    const result = mapYamlObjectToSchemaConfig({
      yamlValue: { variables: { plug1_on: "bool", plug2_on: "bool" } },
      fields
    });
    expect(result.config.variables).toEqual([
      { name: "plug1_on", type: "bool" },
      { name: "plug2_on", type: "bool" }
    ]);
    expect(result.mappedKeys).toContain("variables");
  });

  it("reports type_mismatch and drops the key when the value isn't a mapping", () => {
    const result = mapYamlObjectToSchemaConfig({
      yamlValue: { variables: ["not", "a", "map"] },
      fields
    });
    expect(result.config.variables).toBeUndefined();
    expect(result.unmappedKeys).toContain("variables");
    expect(result.warnings.some((warning) => warning.code === "type_mismatch")).toBe(true);
  });

  it("leaves the key unmapped when absent, without a warning", () => {
    const result = mapYamlObjectToSchemaConfig({ yamlValue: {}, fields });
    expect(result.config.variables).toBeUndefined();
    expect(result.warnings).toHaveLength(0);
  });
});
