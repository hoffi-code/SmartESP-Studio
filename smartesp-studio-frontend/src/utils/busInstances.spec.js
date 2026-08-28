import { describe, it, expect } from "vitest";
import {
  createBusInstance,
  isMultiInstanceBusIdDomain,
  isMultiInstanceBusKey,
  makeUniqueBusId,
  normalizeBusConfigValue,
  normalizeBusInstances
} from "./busInstances";

describe("isMultiInstanceBusKey / isMultiInstanceBusIdDomain", () => {
  it("recognises the multi-instance bus keys", () => {
    expect(isMultiInstanceBusKey("i2c")).toBe(true);
    expect(isMultiInstanceBusKey("spi")).toBe(true);
    expect(isMultiInstanceBusKey("wifi")).toBe(false);
  });

  it("maps i2s to the i2s_audio id domain", () => {
    expect(isMultiInstanceBusIdDomain("i2s_audio")).toBe(true);
    expect(isMultiInstanceBusIdDomain("i2s")).toBe(false);
  });
});

describe("normalizeBusInstances", () => {
  it("keeps object entries from an array and drops the enabled flag", () => {
    const result = normalizeBusInstances([
      { enabled: true, id: "bus_a", sda: "GPIO21" },
      "nope",
      { id: "bus_b" }
    ]);
    expect(result).toEqual([{ id: "bus_a", sda: "GPIO21" }, { id: "bus_b" }]);
  });

  it("treats enabled:false as no instances", () => {
    expect(normalizeBusInstances({ enabled: false, sda: "GPIO21" })).toEqual([]);
  });

  it("returns a single instance when explicitly enabled", () => {
    expect(normalizeBusInstances({ enabled: true })).toEqual([{}]);
  });

  it("returns a single instance when a real value is configured", () => {
    expect(normalizeBusInstances({ sda: "GPIO21" })).toEqual([{ sda: "GPIO21" }]);
  });

  it("ignores empty strings and underscore-prefixed keys when deciding", () => {
    expect(normalizeBusInstances({ sda: "  ", _touched: true })).toEqual([]);
  });

  it("returns [] for non-object input", () => {
    expect(normalizeBusInstances("i2c")).toEqual([]);
    expect(normalizeBusInstances(null)).toEqual([]);
  });
});

describe("normalizeBusConfigValue", () => {
  it("normalises multi-instance keys to an array", () => {
    expect(normalizeBusConfigValue("i2c", { sda: "GPIO21" })).toEqual([{ sda: "GPIO21" }]);
  });

  it("returns a shallow clone for single-instance keys", () => {
    const value = { baud_rate: 115200 };
    const result = normalizeBusConfigValue("logger", value);
    expect(result).toEqual(value);
    expect(result).not.toBe(value);
  });
});

describe("makeUniqueBusId", () => {
  const schema = { fields: [{ key: "id", default: "bus_i2c" }] };

  it("uses the schema id default when free", () => {
    expect(makeUniqueBusId({ key: "i2c", schema, existingIds: [] })).toBe("bus_i2c");
  });

  it("falls back to <key>_id without a schema default", () => {
    expect(makeUniqueBusId({ key: "spi", schema: {}, existingIds: [] })).toBe("spi_id");
  });

  it("suffixes to avoid collisions, case-insensitively", () => {
    expect(
      makeUniqueBusId({ key: "i2c", schema, existingIds: ["BUS_I2C", "bus_i2c_2"] })
    ).toBe("bus_i2c_3");
  });
});

describe("createBusInstance", () => {
  it("returns an object carrying only the generated id", () => {
    expect(createBusInstance({ key: "spi", schema: {}, existingIds: [] })).toEqual({
      id: "spi_id"
    });
  });
});
