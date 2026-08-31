import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { parseLvglSection } from "./yamlLvglImport";
import { buildLvglYamlLines } from "./schemaLvglYaml";

// Seam 6 gate (plans/... LVGL notes): the actual lvgl: block from the user-reported ESPTaster
// YAML (3 buttons, each with a label+image child, on_click -> homeassistant.action) must survive
// an import -> re-export roundtrip unchanged, using the real widget schemas and action catalog
// shipped under public/ (not test doubles).
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const readJson = (relPath) => JSON.parse(readFileSync(path.join(publicDir, relPath), "utf8"));

const ORIGINAL_LVGL_YAML = `
lvgl:
  displays:
    - main_display
  touchscreens:
    - main_touchscreen
  buffer_size: 25%
  bg_color: 0x000000
  pages:
    - id: main_page
      widgets:
        - button:
            id: lvgl_button_1
            width: 110
            height: 150
            align: TOP_LEFT
            x: 5
            y: 5
            bg_color: 0xC00000
            widgets:
              - label:
                  id: label_1
                  text: "Couch"
                  align: TOP_MID
                  y: 8
                  text_color: 0x3FFFFF
              - image:
                  id: img_1
                  src: icon_couch
                  align: BOTTOM_MID
                  y: -8
                  image_recolor: 0x3FFFFF
                  image_recolor_opa: 100%
            on_click:
              - homeassistant.action:
                  action: switch.toggle
                  data:
                    entity_id: switch.0xa4c138fb72f9917a
        - button:
            id: lvgl_button_2
            width: 110
            height: 150
            align: TOP_RIGHT
            x: -5
            y: 5
            bg_color: 0xC00000
            widgets:
              - label:
                  id: label_2
                  text: "Kaffee"
                  align: TOP_MID
                  y: 8
                  text_color: 0x3FFFFF
              - image:
                  id: img_2
                  src: icon_coffee
                  align: BOTTOM_MID
                  y: -8
                  image_recolor: 0x3FFFFF
                  image_recolor_opa: 100%
            on_click:
              - homeassistant.action:
                  action: switch.toggle
                  data:
                    entity_id: switch.smartplug_no2_smartplug_no2_switch
        - button:
            id: lvgl_button_3
            width: 110
            height: 150
            align: BOTTOM_LEFT
            x: 5
            y: -5
            bg_color: 0xC00000
            widgets:
              - label:
                  id: label_3
                  text: "Wasser"
                  align: TOP_MID
                  y: 8
                  text_color: 0x3FFFFF
              - image:
                  id: img_3
                  src: icon_kettle
                  align: BOTTOM_MID
                  y: -8
                  image_recolor: 0x3FFFFF
                  image_recolor_opa: 100%
            on_click:
              - homeassistant.action:
                  action: switch.toggle
                  data:
                    entity_id: switch.smartplug_no3_smartplug_no3_switch
`;

const widgetSchemas = {
  label: readJson("schemas/components/lvgl/widgets/label.json"),
  button: readJson("schemas/components/lvgl/widgets/button.json"),
  image: readJson("schemas/components/lvgl/widgets/image.json")
};

const actionCatalog = readJson("action_list/base_actions.json").actions;

const schemaContext = {
  loadWidgetSchema: async (type) => widgetSchemas[type] || null,
  loadActionCatalog: async () => actionCatalog,
  loadActionDefinition: async (schemaUrl) => (schemaUrl ? readJson(schemaUrl) : null)
};

describe("LVGL Seam 6 gate — reported ESPTaster button/label/image tree", () => {
  it("imports the reported lvgl block into config.lvgl with no unsupported nodes", async () => {
    const originalDoc = loadYaml(ORIGINAL_LVGL_YAML);
    const lvgl = await parseLvglSection(originalDoc.lvgl, schemaContext);

    expect(lvgl.pages).toHaveLength(1);
    expect(lvgl.pages[0].widgets).toHaveLength(3);

    const collectTypes = (nodes) => nodes.flatMap((node) => [node.type, ...collectTypes(node.children || [])]);
    expect(collectTypes(lvgl.pages[0].widgets)).toEqual(
      Array(3).fill(["button", "label", "image"]).flat()
    );

    const firstButton = lvgl.pages[0].widgets[0];
    expect(firstButton.common).toMatchObject({ id: "lvgl_button_1", x: 5, y: 5, align: "TOP_LEFT" });
    expect(firstButton.props.on_click).toHaveLength(1);
    expect(firstButton.props.on_click[0]).toMatchObject({ type: "homeassistant.action" });
  });

  it("re-exports the imported tree back to the reported lvgl block (roundtrip)", async () => {
    const originalDoc = loadYaml(ORIGINAL_LVGL_YAML);
    const lvgl = await parseLvglSection(originalDoc.lvgl, schemaContext);

    const lines = buildLvglYamlLines(lvgl, widgetSchemas);
    const reExportedDoc = loadYaml(lines.join("\n"));

    expect(reExportedDoc.lvgl).toEqual(originalDoc.lvgl);
  });
});
