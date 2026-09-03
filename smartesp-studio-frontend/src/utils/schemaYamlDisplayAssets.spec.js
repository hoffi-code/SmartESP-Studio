import { describe, expect, it } from "vitest";

import { buildComponentsYaml } from "./schemaYaml";

// Charakterisierung der font:/image:-Bloecke, die der Display-Builder aus den
// Canvas-Elementen ableitet. Deckt die Anfuehrungszeichen im generierten YAML ab.

const displaySchema = {
  domain: "display",
  fields: [{ key: "id", type: "id" }]
};

const buildYaml = (elements) =>
  buildComponentsYaml(
    [{ id: "display/ssd1306_i2c", config: { id: "oled", _display_builder: { elements } } }],
    { "display/ssd1306_i2c": displaySchema }
  ).join("\n");

describe("display asset blocks", () => {
  it("quotes a Google font family", () => {
    const yaml = buildYaml([
      {
        type: "text",
        x: 0,
        y: 0,
        w: 40,
        h: 16,
        text: "Hi",
        fontSource: "google",
        fontFamily: "Roboto Mono",
        fontVariant: "regular"
      }
    ]);
    expect(yaml).toContain("type: gfonts");
    expect(yaml).toContain('family: "Roboto Mono"');
    expect(yaml).toContain("size: 16");
  });

  it("quotes a local font path", () => {
    const yaml = buildYaml([
      { type: "text", x: 0, y: 0, w: 40, h: 12, text: "Hi", fontSource: "local", fontFile: "roboto.ttf" }
    ]);
    expect(yaml).toContain('- file: "esp_assets/fonts/roboto.ttf"');
  });

  it("quotes the image path and keeps the resize", () => {
    const yaml = buildYaml([{ type: "image", x: 0, y: 0, w: 32, h: 24, image: "logo.png" }]);
    expect(yaml).toContain('- file: "esp_assets/images/logo.png"');
    expect(yaml).toContain("resize: 32x24");
  });

  it("emits nothing extra without display elements", () => {
    const yaml = buildYaml([]);
    expect(yaml).not.toContain("font:");
    expect(yaml).not.toContain("image:");
  });
});
