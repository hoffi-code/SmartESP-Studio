import { describe, expect, it } from "vitest";

import {
  buildDisplayElementIdErrors,
  buildDuplicateErrors,
  buildGpioUsageIndex,
  buildIdIndex,
  buildIdRefErrors,
  buildValidationErrors,
  buildValueRegistry,
  isArrayLikeSchemaField,
  isObjectArrayLikeField
} from "./builderValidationRules";

const idField = (key, overrides = {}) => ({ key, type: "id", ...overrides });
const idRefField = (key, domain, overrides = {}) => ({ key, type: "id_ref", domain, ...overrides });

describe("isArrayLikeSchemaField / isObjectArrayLikeField", () => {
  it("recognizes list-shaped fields", () => {
    expect(isArrayLikeSchemaField({ type: "list" })).toBe(true);
    expect(isArrayLikeSchemaField({ type: "fixed_list" })).toBe(true);
    expect(isArrayLikeSchemaField({ type: "generated_list" })).toBe(true);
    expect(isArrayLikeSchemaField({ type: "text" })).toBe(false);
  });

  it("requires an object item shape with fields and an array value", () => {
    const field = { type: "list", item: { type: "object", fields: [{ key: "a" }] } };
    expect(isObjectArrayLikeField(field, [])).toBeTruthy();
    expect(isObjectArrayLikeField(field, undefined)).toBe(false);
    expect(isObjectArrayLikeField({ type: "list", item: { type: "text" } }, [])).toBe(false);
  });
});

describe("buildValueRegistry", () => {
  it("counts matching field values across entries, case-insensitively", () => {
    const entries = [
      { fields: [idField("id")], config: { id: "sensor_a" } },
      { fields: [idField("id")], config: { id: "SENSOR_A" } },
      { fields: [idField("id")], config: { id: "sensor_b" } }
    ];

    const counts = buildValueRegistry(entries, (field, value) => field.type === "id" && Boolean(value));
    expect(counts).toEqual({ sensor_a: 2, sensor_b: 1 });
  });
});

describe("buildIdIndex", () => {
  it("flattens id fields with component/domain context", () => {
    const entries = [
      { componentId: "sensor/dht", domain: "sensor", fields: [idField("id")], config: { id: "temp1" } }
    ];
    const idx = buildIdIndex(entries);
    expect(idx).toEqual([
      { id: "temp1", idLower: "temp1", domain: "sensor", componentId: "sensor/dht", scopeId: "" }
    ]);
  });

  it("recurses into nested objects and object-array items", () => {
    const entries = [
      {
        componentId: "display/main",
        domain: "display",
        fields: [
          { key: "nested", type: "object", fields: [idField("id")] },
          { key: "items", type: "list", item: { type: "object", fields: [idField("id")] } }
        ],
        config: {
          nested: { id: "nested_id" },
          items: [{ id: "item_id" }]
        }
      }
    ];
    const idx = buildIdIndex(entries);
    expect(idx.map((entry) => entry.id).sort()).toEqual(["item_id", "nested_id"]);
  });
});

describe("buildDuplicateErrors", () => {
  it("flags ids and names that are used more than once", () => {
    const entries = [
      { label: "Sensor A", fields: [idField("id"), { key: "name", type: "text" }], config: { id: "dup", name: "dup-name" } },
      { label: "Sensor B", fields: [idField("id"), { key: "name", type: "text" }], config: { id: "dup", name: "dup-name" } }
    ];
    const errors = buildDuplicateErrors(entries, { dup: 2 }, { "dup-name": 2 });
    expect(errors).toHaveLength(4);
    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining(["ID already used", "Name already used"])
    );
  });

  it("does not flag unique values", () => {
    const entries = [{ label: "Sensor A", fields: [idField("id")], config: { id: "unique" } }];
    expect(buildDuplicateErrors(entries, { unique: 1 }, {})).toEqual([]);
  });
});

describe("buildIdRefErrors", () => {
  const idIndex = [
    { id: "temp1", idLower: "temp1", domain: "sensor", componentId: "sensor/a", scopeId: "" }
  ];

  it("accepts a value that matches an available option", () => {
    const entries = [
      { label: "Automation", componentId: "automation/x", fields: [idRefField("target", "sensor")], config: { target: "temp1" } }
    ];
    expect(buildIdRefErrors(entries, idIndex)).toEqual([]);
  });

  it("reports an error when the value has no matching identifier", () => {
    const entries = [
      { label: "Automation", componentId: "automation/x", fields: [idRefField("target", "sensor")], config: { target: "missing" } }
    ];
    const errors = buildIdRefErrors(entries, idIndex);
    expect(errors).toEqual([
      { path: "Automation.target", message: "No matching identifiers available", scopeId: "" }
    ]);
  });

  it("reports an error when no options exist at all and the field is required", () => {
    const entries = [
      { label: "Automation", componentId: "automation/x", fields: [idRefField("target", "nonexistent-domain", { required: true })], config: {} }
    ];
    const errors = buildIdRefErrors(entries, idIndex);
    expect(errors).toEqual([
      { path: "Automation.target", message: "No matching identifiers available", scopeId: "" }
    ]);
  });
});

describe("buildDisplayElementIdErrors", () => {
  const idIndex = [
    { id: "temp1", idLower: "temp1", domain: "sensor", componentId: "", scopeId: "" }
  ];

  const displayEntry = (elements) => ({
    domain: "display",
    componentId: "display/main",
    scopeId: "",
    config: { _display_builder: { elements } }
  });

  it("requires a source id for a dynamic text element", () => {
    const entries = [displayEntry([{ type: "text", textMode: "dynamic", dynamicDomain: "sensor" }])];
    const errors = buildDisplayElementIdErrors(entries, idIndex, [], [], []);
    expect(errors).toEqual([
      {
        path: "component._display_builder.elements.0.dynamicId",
        message: "Please select a source ID",
        scopeId: ""
      }
    ]);
  });

  it("passes when the dynamic text element has a valid source id", () => {
    const entries = [
      displayEntry([{ type: "text", textMode: "dynamic", dynamicDomain: "sensor", dynamicId: "temp1" }])
    ];
    expect(buildDisplayElementIdErrors(entries, idIndex, [], [], [])).toEqual([]);
  });

  it("requires a graph id and a selected sensor", () => {
    const entries = [displayEntry([{ type: "graph" }])];
    const errors = buildDisplayElementIdErrors(entries, idIndex, [], [], []);
    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining(["Please provide a graph ID", "Please select a sensor ID"])
    );
  });

  it("requires an image file to be selected from the available options", () => {
    const entries = [displayEntry([{ type: "image" }])];
    const errors = buildDisplayElementIdErrors(entries, idIndex, ["photo.png"], [], []);
    expect(errors).toEqual([
      {
        path: "component._display_builder.elements.0.image",
        message: "Please select an image file",
        scopeId: ""
      }
    ]);
  });

  it("ignores components outside the display domain", () => {
    const entries = [{ domain: "sensor", config: {} }];
    expect(buildDisplayElementIdErrors(entries, idIndex, [], [], [])).toEqual([]);
  });
});

describe("buildValidationErrors", () => {
  it("rejects a base64_44 password field that is not correctly formatted", () => {
    const entries = [
      {
        label: "API",
        fields: [{ key: "psk", type: "password", settings: { format: "base64_44" } }],
        config: { psk: "too-short" }
      }
    ];
    const errors = buildValidationErrors(entries);
    expect(errors).toEqual([
      { path: "API.psk", message: "Key must be base64 (44 chars, ending with =).", scopeId: "" }
    ]);
  });

  it("accepts a !secret reference for a base64_44 password field", () => {
    const entries = [
      {
        label: "API",
        fields: [{ key: "psk", type: "password", settings: { format: "base64_44" } }],
        config: { psk: "!secret api_key" }
      }
    ];
    expect(buildValidationErrors(entries)).toEqual([]);
  });

  it("requires exactly one BLE RSSI identity field", () => {
    const entries = [{ componentId: "sensor/ble_rssi", fields: [], config: {} }];
    const errors = buildValidationErrors(entries);
    expect(errors).toEqual([
      {
        path: "schema.mac_address",
        message: "Set exactly one identity: mac_address, irk, service_uuid or ibeacon_uuid.",
        scopeId: ""
      }
    ]);
  });

  it("flags more than one root_map component sharing a domain", () => {
    const entries = [
      { label: "A", renderAs: "root_map", domain: "sensor", fields: [], config: {} },
      { label: "B", renderAs: "root_map", domain: "sensor", fields: [], config: {} }
    ];
    const errors = buildValidationErrors(entries);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toBe("Only one root-map component can emit domain 'sensor'.");
  });
});

describe("buildGpioUsageIndex", () => {
  it("counts gpio pin usage across components and extra configs", () => {
    const components = [{ id: "sensor/dht" }, { id: "sensor/other" }];
    const schemas = {
      "sensor/dht": { fields: [{ key: "pin", type: "gpio" }] },
      "sensor/other": { fields: [{ key: "pin", type: "gpio" }] }
    };
    const configs = [
      { config: { pin: "GPIO4" } },
      { config: { pin: "4" } }
    ];
    const withComponentIdFromEntry = (entry) => entry.id;

    // Inline components carry their config directly for this test fixture.
    const componentsWithConfig = [
      { ...components[0], config: configs[0].config },
      { ...components[1], config: configs[1].config }
    ];

    const usage = buildGpioUsageIndex(componentsWithConfig, schemas, [], withComponentIdFromEntry);
    expect(usage).toEqual({ "4": 2 });
  });

  it("falls back to the default componentIdFromEntry when none is provided", () => {
    const components = [{ id: "sensor/dht", config: { pin: "GPIO5" } }];
    const schemas = { "sensor/dht": { fields: [{ key: "pin", type: "gpio" }] } };
    expect(buildGpioUsageIndex(components, schemas)).toEqual({ "5": 1 });
  });
});
