import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { extractLeadingHeaderComment, importYamlToProjectConfig } from "./yamlProjectImport";

describe("extractLeadingHeaderComment", () => {
  it("captures a leading comment block before the first key", () => {
    const text = ["# Board: CYD", "# Definition: manifest.yaml", "", "esphome:", "  name: test"].join("\n");
    expect(extractLeadingHeaderComment(text)).toBe("# Board: CYD\n# Definition: manifest.yaml");
  });

  it("returns an empty string when the file has no leading comments", () => {
    const text = ["esphome:", "  name: test"].join("\n");
    expect(extractLeadingHeaderComment(text)).toBe("");
  });

  it("returns an empty string for only-blank-lines before the first key", () => {
    const text = ["", "", "esphome:", "  name: test"].join("\n");
    expect(extractLeadingHeaderComment(text)).toBe("");
  });

  it("does not capture comments that appear after the first key", () => {
    const text = ["esphome:", "  # not a header comment", "  name: test"].join("\n");
    expect(extractLeadingHeaderComment(text)).toBe("");
  });
});

describe("importYamlToProjectConfig - image: component + header comment", () => {
  const imageFileSchema = {
    id: "image.file",
    domain: "image",
    platform: "file",
    fields: [
      { key: "id", type: "id", required: true },
      { key: "file", type: "text", required: true },
      { key: "type", type: "select", required: true, options: ["BINARY", "GRAYSCALE", "RGB565", "RGB"] }
    ]
  };

  const componentCatalog = {
    categories: [
      {
        title: "Image Components",
        slug: "image-components",
        items: [
          {
            name: "File",
            path: "components/image/file",
            id: "image/file",
            schemaPath: "components/image/file.json"
          }
        ],
        subcategories: []
      }
    ]
  };

  const loadComponentSchema = async (componentId, schemaPath) => {
    if (componentId === "image/file" && schemaPath === "components/image/file.json") {
      return imageFileSchema;
    }
    return null;
  };

  it("imports an image/file component and preserves the leading header comment", async () => {
    const yamlText = [
      "# Board: ESP32-2432S028R CYD (Sunton (JCZN))",
      "# Definition: definitions/boards/jczn_2432s028r/manifest.yaml",
      "",
      "image:",
      "  - platform: file",
      "    id: icon_couch",
      '    file: "mdi:sofa"',
      "    type: BINARY"
    ].join("\n");

    const result = await importYamlToProjectConfig({
      yamlText,
      sourceName: "sample.yaml",
      componentCatalog,
      loadComponentSchema: (component) => loadComponentSchema(component.componentId, component.schemaPath)
    });

    expect(result.ok).toBe(true);
    expect(result.headerCommentLineCount).toBe(2);
    expect(result.projectData.headerComment).toBe(
      "# Board: ESP32-2432S028R CYD (Sunton (JCZN))\n# Definition: definitions/boards/jczn_2432s028r/manifest.yaml"
    );

    const imageSection = result.sections.find((section) => section.key === "image");
    expect(imageSection.status).toBe("component");

    const imageComponent = result.components.find((component) => component.domain === "image");
    expect(imageComponent.status).toBe("matched");
    expect(imageComponent.componentId).toBe("image/file");

    expect(result.projectData.components).toHaveLength(1);
    expect(result.projectData.components[0].id).toBe("image/file");
  });

  it("leaves headerComment empty when the source file has no leading comments", async () => {
    const yamlText = ["image:", "  - platform: file", "    id: icon_couch", '    file: "mdi:sofa"', "    type: BINARY"].join(
      "\n"
    );

    const result = await importYamlToProjectConfig({
      yamlText,
      componentCatalog,
      loadComponentSchema: (component) => loadComponentSchema(component.componentId, component.schemaPath)
    });

    expect(result.headerCommentLineCount).toBe(0);
    expect(result.projectData.headerComment).toBe("");
  });

  it("captures domain- and field-level section comments alongside the file header", async () => {
    const yamlText = [
      "# Board: CYD",
      "",
      "esphome:",
      "  name: test",
      "",
      "# --- Icons fuer die LVGL-Buttons ---",
      "image:",
      "  - platform: file",
      "    id: icon_couch",
      '    file: "mdi:sofa"',
      "    type: BINARY"
    ].join("\n");

    const result = await importYamlToProjectConfig({
      yamlText,
      componentCatalog,
      loadComponentSchema: (component) => loadComponentSchema(component.componentId, component.schemaPath)
    });

    expect(result.headerCommentLineCount).toBe(1);
    expect(result.projectData.headerComment).toBe("# Board: CYD");
    expect(result.projectData.fieldComments).toEqual({
      image: "# --- Icons fuer die LVGL-Buttons ---"
    });
  });
});

describe("importYamlToProjectConfig - lvgl", () => {
  const labelSchema = { fields: [{ key: "id", type: "id" }, { key: "text", type: "text" }] };
  const buttonSchema = {
    fields: [
      { key: "id", type: "id" },
      { key: "width", type: "number" },
      {
        key: "on_click",
        type: "list",
        item: { type: "object", fields: [], extends: "base_actions.json" }
      }
    ]
  };
  const homeassistantActionDefinition = { fields: [{ key: "action", type: "text", required: true }] };

  const imageSchema = { fields: [{ key: "id", type: "id" }, { key: "src", type: "id_ref", domain: "image" }] };

  const loadGeneralSchema = async (path) => {
    if (path === "components/lvgl/widgets/label.json") return labelSchema;
    if (path === "components/lvgl/widgets/button.json") return buttonSchema;
    if (path === "components/lvgl/widgets/image.json") return imageSchema;
    return null;
  };
  const loadActionCatalog = async () => [{ id: "homeassistant.action", schemaUrl: "actions/homeassistant/action.json" }];
  const loadActionDefinition = async () => homeassistantActionDefinition;

  it("imports the lvgl root config, a label widget, and a button widget with its on_click action", async () => {
    const yamlText = [
      "esphome:",
      "  name: test",
      "",
      "lvgl:",
      "  displays:",
      "    - main_display",
      "  buffer_size: 25%",
      "  bg_color: 0x000000",
      "  pages:",
      "    - id: main_page",
      "      widgets:",
      "        - label:",
      "            id: label_1",
      '            text: "Couch"',
      "        - button:",
      "            id: btn_1",
      "            width: 110",
      "            on_click:",
      "              - homeassistant.action:",
      "                  action: switch.toggle"
    ].join("\n");

    const result = await importYamlToProjectConfig({
      yamlText,
      loadGeneralSchema,
      loadActionCatalog,
      loadActionDefinition
    });

    expect(result.ok).toBe(true);
    const lvglSection = result.sections.find((section) => section.key === "lvgl");
    expect(lvglSection.status).toBe("recognized");

    expect(result.projectData.lvgl.displays).toEqual(["main_display"]);
    expect(result.projectData.lvgl.pages).toHaveLength(1);
    const [labelNode, buttonNode] = result.projectData.lvgl.pages[0].widgets;
    expect(labelNode.type).toBe("label");
    expect(labelNode.props.text).toBe("Couch");
    expect(buttonNode.type).toBe("button");
    expect(buttonNode.common.id).toBe("btn_1");
    expect(buttonNode.props.on_click).toHaveLength(1);
    expect(buttonNode.props.on_click[0]).toMatchObject({
      type: "homeassistant.action",
      config: { action: "switch.toggle" }
    });
  });

  it("imports a button with nested label+image children, matching the reported real-world shape", async () => {
    const yamlText = [
      "esphome:",
      "  name: test",
      "",
      "lvgl:",
      "  pages:",
      "    - id: main_page",
      "      widgets:",
      "        - button:",
      "            id: lvgl_button_1",
      "            width: 110",
      "            widgets:",
      "              - label:",
      "                  id: label_1",
      '                  text: "Couch"',
      "              - image:",
      "                  id: img_1",
      "                  src: icon_couch",
      "            on_click:",
      "              - homeassistant.action:",
      "                  action: switch.toggle"
    ].join("\n");

    const result = await importYamlToProjectConfig({
      yamlText,
      loadGeneralSchema,
      loadActionCatalog,
      loadActionDefinition
    });

    const [buttonNode] = result.projectData.lvgl.pages[0].widgets;
    expect(buttonNode.type).toBe("button");
    expect(buttonNode.children).toHaveLength(2);
    const [labelChild, imageChild] = buttonNode.children;
    expect(labelChild).toMatchObject({ type: "label", props: { text: "Couch" } });
    expect(imageChild).toMatchObject({ type: "image", props: { src: "icon_couch" } });
    expect(buttonNode.props.on_click[0]).toMatchObject({ type: "homeassistant.action", config: { action: "switch.toggle" } });
  });

  it("keeps an unrecognized widget type as an unsupported raw-YAML node when no schema loader is given", async () => {
    const yamlText = [
      "esphome:",
      "  name: test",
      "",
      "lvgl:",
      "  pages:",
      "    - id: main_page",
      "      widgets:",
      "        - label:",
      "            id: label_1"
    ].join("\n");

    const result = await importYamlToProjectConfig({ yamlText });
    const [labelNode] = result.projectData.lvgl.pages[0].widgets;
    expect(labelNode.type).toBe("unsupported");
    expect(labelNode.originalType).toBe("label");
  });

  it("leaves projectData.lvgl at its default when the source file has no lvgl section", async () => {
    const yamlText = ["esphome:", "  name: test"].join("\n");
    const result = await importYamlToProjectConfig({ yamlText });
    expect(result.projectData.lvgl).toBeNull();
  });
});

describe("importYamlToProjectConfig - yaml fields", () => {
  const apiSchema = {
    fields: [
      { key: "enabled", type: "boolean" },
      { key: "encryption", type: "object", fields: [{ key: "key", type: "text" }] },
      { key: "actions", type: "yaml" }
    ]
  };
  const loadGeneralSchema = async (path) => (path === "general/protocols/api.json" ? apiSchema : null);

  // Regression: yaml-Felder waren write-only. Der Wert kommt geparst an, fiel durch die
  // Primitiv-Pruefung und landete als type_mismatch bei den verworfenen Keys -- api.actions
  // wurde im Import-Dialog rot markiert und ging verloren. Verglichen wird strukturell
  // (reparsed), nicht als exakter String -- js-yamls dump() formatiert nicht zwangslaeufig
  // byteidentisch zum Original (Quoting/Block-Stil), inhaltlich muss es aber gleich bleiben.
  it("imports api.actions into the raw yaml field", async () => {
    const yamlText = [
      "esphome:",
      "  name: esptaster",
      "",
      "api:",
      "  encryption:",
      '    key: "abc="',
      "  actions:",
      "    - action: sync_button_states",
      "      variables:",
      "        plug1_on: bool",
      "        plug2_on: bool",
      "      then:",
      "        - lambda: |-",
      "            id(smartplug_no1_state).publish_state(plug1_on);",
      "            id(smartplug_no2_state).publish_state(plug2_on);"
    ].join("\n");

    const result = await importYamlToProjectConfig({ yamlText, loadGeneralSchema });

    const imported = result.projectData.protocolsCore.api.actions;
    expect(typeof imported).toBe("string");
    expect(load(imported)).toEqual([
      {
        action: "sync_button_states",
        variables: { plug1_on: "bool", plug2_on: "bool" },
        then: [
          {
            lambda:
              "id(smartplug_no1_state).publish_state(plug1_on);\n" +
              "id(smartplug_no2_state).publish_state(plug2_on);"
          }
        ]
      }
    ]);

    const apiSection = result.sections.find((section) => section.key === "api");
    expect(apiSection.droppedKeys || []).not.toContain("api.actions");
  });

  it("skips an empty yaml field instead of storing an empty string", async () => {
    const yamlText = ["esphome:", "  name: t", "", "api:", "  actions:"].join("\n");
    const result = await importYamlToProjectConfig({ yamlText, loadGeneralSchema });
    expect(result.projectData.protocolsCore.api.actions).toBeUndefined();
  });
});
