import { describe, expect, it } from "vitest";
import { extractSectionComments, findSectionComments } from "./yamlStructureScan";

describe("extractSectionComments", () => {
  it("captures a comment before a top-level section", () => {
    const yamlText = [
      "esphome:",
      "  name: test",
      "",
      "# --- Hintergrundbeleuchtung als PWM-Ausgang -> HA-Light ---",
      "output:",
      "  - platform: ledc",
      "    pin: GPIO21",
      "    id: backlight_pwm"
    ].join("\n");

    const comments = extractSectionComments(yamlText);
    expect(comments.output).toBe("# --- Hintergrundbeleuchtung als PWM-Ausgang -> HA-Light ---");
  });

  it("captures a comment before a direct field inside a first-level list item", () => {
    const yamlText = [
      "esphome:",
      "  name: test",
      "",
      "touchscreen:",
      "  - platform: xpt2046",
      "    id: main_touchscreen",
      "    threshold: 400",
      "    # Kalibrierwerte sind pro Geraet leicht unterschiedlich.",
      "    # Passe sie an, falls Touch-Punkte spuerbar daneben liegen.",
      "    calibration:",
      "      x_min: 280"
    ].join("\n");

    const comments = extractSectionComments(yamlText);
    expect(comments["touchscreen[0].calibration"]).toBe(
      "# Kalibrierwerte sind pro Geraet leicht unterschiedlich.\n# Passe sie an, falls Touch-Punkte spuerbar daneben liegen."
    );
  });

  it("skips the very first block's leading comment (covered by the file header instead)", () => {
    const yamlText = ["# Board: CYD", "esphome:", "  name: test"].join("\n");
    const comments = extractSectionComments(yamlText);
    expect(comments).toEqual({});
  });

  it("returns an empty map when there are no section comments", () => {
    const yamlText = ["esphome:", "  name: test", "", "output:", "  - platform: ledc", "    id: x"].join("\n");
    expect(extractSectionComments(yamlText)).toEqual({});
  });

  it("attaches a comment preceding a list item to that item as a whole", () => {
    const yamlText = [
      "esphome:",
      "  name: test",
      "",
      "output:",
      "  - platform: ledc",
      "    id: a",
      "  # second output",
      "  - platform: ledc",
      "    id: b"
    ].join("\n");

    const comments = extractSectionComments(yamlText);
    expect(comments["output[1]"]).toBe("# second output");
    expect(comments["output[0]"]).toBeUndefined();
  });
});

describe("findSectionComments", () => {
  it("reports the line-index range of each captured comment", () => {
    const yamlText = ["esphome:", "  name: test", "", "# header for output", "output:", "  - platform: ledc", "    id: x"].join(
      "\n"
    );

    const results = findSectionComments(yamlText);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ path: "output", startIndex: 3, endIndex: 3 });
  });
});
