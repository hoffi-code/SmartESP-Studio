import { describe, expect, it } from "vitest";

import { buildSchemaYaml } from "./schemaYaml";

// Die Action-Emission war bisher nur indirekt ueber useBuilderYamlPreview abgedeckt.
// wrapThen und die Leerfall-Regeln hatten keinen eigenen Test -- genau die Formen, die
// die neu verdrahteten Trigger (wifi, mqtt, logger, deep_sleep, remote_receiver) nutzen.
//
// Was hier NICHT geprueft werden kann: die Lambda- und die if/then-Form. Fuer die braucht
// renderYamlObject die geladenen Action-Definitionen (Feldtypen aus public/actions/**);
// ohne die faellt er auf eine generische Ausgabe zurueck. Das gehoert auf die Ebene von
// buildComponentsYamlDocumentLines und bleibt offen.

const actionList = (key, extra = {}) => ({
  key,
  type: "list",
  required: false,
  item: { type: "object", fields: [], extends: "base_actions.json" },
  ...extra
});

const render = (fields, value) => buildSchemaYaml(value, fields, 0).join("\n");

describe("action list emission", () => {
  it("collapses a single-key action onto one line", () => {
    const yaml = render([actionList("on_press")], {
      on_press: [{ type: "switch.toggle", config: { id: "relay" } }]
    });
    expect(yaml).toBe(['on_press:', '  - switch.toggle: "relay"'].join("\n"));
  });

  // wrapThen schiebt eine "- then:"-Ebene ein; ESPHome erlaubt beide Formen, der
  // Generator schreibt konsistent die verschachtelte.
  it("wraps the list in a then block when the field asks for it", () => {
    const yaml = render([actionList("on_turn_on", { wrapThen: true })], {
      on_turn_on: [{ type: "delay", config: { delay: "1s" } }]
    });
    expect(yaml).toBe(["on_turn_on:", "  - then:", '      - delay: "1s"'].join("\n"));
  });

  it("keeps several actions in order inside one trigger", () => {
    const yaml = render([actionList("on_press")], {
      on_press: [
        { type: "delay", config: { delay: "1s" } },
        { type: "switch.turn_off", config: { id: "relay" } }
      ]
    });
    expect(yaml.split("\n")).toEqual([
      "on_press:",
      '  - delay: "1s"',
      '  - switch.turn_off: "relay"'
    ]);
  });

  it("omits an empty optional action list entirely", () => {
    expect(render([actionList("on_press")], { on_press: [] })).toBe("");
    expect(render([actionList("on_press")], {})).toBe("");
  });

  // Ein required then: muss auch leer stehen bleiben, sonst faellt der Wrapper-Eintrag
  // beim Export weg und die Konfiguration wird still ungueltig.
  it("emits a bare key for a required but empty action list", () => {
    expect(render([actionList("then", { required: true })], { then: [] })).toBe("then:");
  });
});
