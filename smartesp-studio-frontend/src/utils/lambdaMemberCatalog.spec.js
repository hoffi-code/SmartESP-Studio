import { describe, expect, it } from "vitest";

import { LAMBDA_MEMBER_CATALOG } from "./lambdaMemberCatalog";

// Die 17 Kern-Entity-Domains, fuer die ESPHome eine oeffentliche Lambda-API hat.
// Bus-/Hardware-Domains (i2c, spi, uart, output, time, touchscreen, lvgl, display, ...)
// sind bewusst ausgeklammert -- siehe plans/plane-eine-vollst-ndige-lambda-lucky-quill.md.
const CORE_ENTITY_DOMAINS = [
  "sensor",
  "binary_sensor",
  "text_sensor",
  "switch",
  "light",
  "cover",
  "climate",
  "fan",
  "lock",
  "number",
  "select",
  "text",
  "valve",
  "datetime",
  "button",
  "alarm_control_panel",
  "event"
];

describe("LAMBDA_MEMBER_CATALOG", () => {
  it("covers exactly the 17 core entity domains, nothing else", () => {
    expect(Object.keys(LAMBDA_MEMBER_CATALOG).sort()).toEqual([...CORE_ENTITY_DOMAINS].sort());
  });

  it("gives every domain at least one member", () => {
    CORE_ENTITY_DOMAINS.forEach((domain) => {
      expect(LAMBDA_MEMBER_CATALOG[domain].length).toBeGreaterThan(0);
    });
  });

  it("has a non-empty id and insert on every entry", () => {
    Object.values(LAMBDA_MEMBER_CATALOG)
      .flat()
      .forEach((entry) => {
        expect(entry.id.trim()).not.toBe("");
        expect(entry.insert.trim()).not.toBe("");
      });
  });

  it("keeps ids unique within each domain", () => {
    Object.entries(LAMBDA_MEMBER_CATALOG).forEach(([domain, entries]) => {
      const ids = entries.map((entry) => entry.id);
      expect(new Set(ids).size, `duplicate id in ${domain}`).toBe(ids.length);
    });
  });

  it("gives every low-confidence domain at least its safe state read", () => {
    ["lock", "datetime", "alarm_control_panel"].forEach((domain) => {
      expect(LAMBDA_MEMBER_CATALOG[domain].some((entry) => entry.id === "state")).toBe(true);
    });
  });
});
