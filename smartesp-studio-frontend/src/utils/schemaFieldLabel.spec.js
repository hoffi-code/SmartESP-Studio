import { describe, expect, it } from "vitest";

import { humanizeFieldKey } from "./schemaFieldLabel";

describe("humanizeFieldKey", () => {
  it("capitalises the first word and lowercases the rest", () => {
    expect(humanizeFieldKey("default_font")).toBe("Default font");
    expect(humanizeFieldKey("disp_bg_color")).toBe("Disp bg color");
    expect(humanizeFieldKey("on_value")).toBe("On value");
  });

  it("keeps known acronyms upper-case anywhere in the key", () => {
    expect(humanizeFieldKey("id")).toBe("ID");
    expect(humanizeFieldKey("rgb_order")).toBe("RGB order");
    expect(humanizeFieldKey("cs_pin")).toBe("CS pin");
    expect(humanizeFieldKey("mqtt")).toBe("MQTT");
    expect(humanizeFieldKey("tx_pin")).toBe("TX pin");
  });

  it("handles kebab-case and stray whitespace", () => {
    expect(humanizeFieldKey("some-mixed key")).toBe("Some mixed key");
  });

  it("returns an empty string for empty input", () => {
    expect(humanizeFieldKey("")).toBe("");
    expect(humanizeFieldKey(null)).toBe("");
    expect(humanizeFieldKey("__")).toBe("");
  });
});
