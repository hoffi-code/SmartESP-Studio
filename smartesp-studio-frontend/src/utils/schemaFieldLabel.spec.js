import { describe, expect, it } from "vitest";

import {
  fieldHintI18nKey,
  fieldLabelI18nKey,
  fieldLabelI18nKeyFlat,
  humanizeFieldKey,
  normSchemaNs
} from "./schemaFieldLabel";

describe("schema-namespaced i18n keys", () => {
  it("normalises a schema id into a key segment", () => {
    expect(normSchemaNs("sensor.template")).toBe("sensor_template");
    expect(normSchemaNs("lvgl.widget.bar")).toBe("lvgl_widget_bar");
    expect(normSchemaNs("general/protocols/api")).toBe("general_protocols_api");
    expect(normSchemaNs("")).toBe("");
    expect(normSchemaNs(null)).toBe("");
  });

  it("builds namespaced label/hint keys per schema", () => {
    expect(fieldLabelI18nKey("mode", "busses.spi")).toBe("schema.ns.busses_spi.mode.label");
    expect(fieldHintI18nKey("mode", "switch.template")).toBe("schema.ns.switch_template.mode.hint");
    expect(fieldLabelI18nKeyFlat("mode")).toBe("schema.fields.mode.label");
  });
});

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
