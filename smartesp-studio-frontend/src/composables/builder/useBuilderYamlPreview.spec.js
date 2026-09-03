import { ref } from "vue";
import { describe, expect, it } from "vitest";

import { useBuilderYamlPreview } from "./useBuilderYamlPreview";

const textField = (key, overrides = {}) => ({ key, type: "text", ...overrides });

// Builds a minimal-but-representative set of inputs mirroring what BuilderView passes
// today, so this doubles as a characterization test for the extraction: any change to
// the preview wiring (section order, scope ids, generated-comment placement) should show
// up here without needing the full BuilderView + backend running.
const buildHarness = (overrides = {}) => {
  const config = ref({
    esphomeCore: { name: "kitchen_sensor" },
    substitutions: {},
    platformCore: {},
    networkCore: {},
    protocolsCore: {},
    systemCore: {},
    automationCore: {},
    bussesCore: {},
    components: []
  });

  return useBuilderYamlPreview({
    config,
    substitutionsCoreSchema: ref({ fields: [] }),
    esphomeCoreSchema: ref({ fields: [textField("name")] }),
    platformCoreConfig: ref({}),
    platformDetailSchema: ref({ fields: [] }),
    networkCoreConfig: ref({}),
    networkDetailSchema: ref({ fields: [] }),
    networkCoreSchema: ref({ fields: [] }),
    protocolsCoreConfig: ref({}),
    protocolsSchemas: ref({}),
    protocolDefinitions: [],
    enabledProtocolKeys: ref([]),
    otherSchemas: ref({}),
    systemConfig: ref({}),
    automationSchemas: ref({}),
    automationCoreConfig: ref({}),
    automationDefinitions: [],
    generatedAutomation: ref({}),
    bussesCoreConfig: ref({}),
    bussesSchemas: ref({}),
    bussesDefinitions: [],
    resolveBusEnabled: () => false,
    getBusInstances: () => [],
    componentSchemas: ref({}),
    componentSchemaStatus: ref({}),
    componentIdFromEntry: (entry) => (typeof entry === "string" ? entry : entry?.id || ""),
    parseComponentId: () => ({ domain: "", platform: "" }),
    mdiSubstitutions: ref({}),
    globalStore: ref({}),
    hubDomainsInUse: ref(new Set()),
    substitutionsCoreScopeId: "tab:Core:substitutions",
    esphomeCoreScopeId: "tab:Core:esphome",
    platformDetailScopeId: "tab:Platform:detail",
    networkDetailScopeId: "tab:Network:detail",
    networkOtaScopeId: "tab:Network:ota",
    networkWebServerScopeId: "tab:Network:web_server",
    ...overrides
  });
};

describe("useBuilderYamlPreview", () => {
  it("renders only the esphome core section for a minimal config", () => {
    const { yamlPreview } = buildHarness();
    expect(yamlPreview.value).toBe('esphome:\n  name: "kitchen_sensor"');
  });

  it("prepends an imported header comment before the rest of the document", () => {
    const harness = buildHarness({
      config: ref({
        headerComment: "# Board: CYD\n# Definition: manifest.yaml",
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: []
      })
    });
    expect(harness.yamlPreview.value).toBe(
      '# Board: CYD\n# Definition: manifest.yaml\n\n\nesphome:\n  name: "kitchen_sensor"'
    );
  });

  it("omits the header block entirely when there is no header comment", () => {
    const { yamlPreview } = buildHarness();
    expect(yamlPreview.value.startsWith("#")).toBe(false);
  });

  it("groups the core section under the Core preview tab", () => {
    const { previewTabs } = buildHarness();
    const tabs = previewTabs.value;
    expect(tabs.map((tab) => tab.key)).toEqual(["core"]);
    expect(tabs[0].content).toBe('esphome:\n  name: "kitchen_sensor"');
  });

  it("emits an esp32 platform block plus framework type when set", () => {
    const harness = buildHarness({
      platformCoreConfig: ref({ platform: "esp32", framework: "esp-idf" }),
      platformDetailSchema: ref({ fields: [textField("board")] })
    });
    expect(harness.yamlPreview.value).toContain("esp32:\n  framework:\n    type: esp-idf");
  });

  it("emits the wifi network block with the default OTA section", () => {
    const harness = buildHarness({
      networkCoreConfig: ref({ transport: "wifi", ssid: "my-network" }),
      networkCoreSchema: ref({ fields: [{ key: "ota", type: "object", fields: [] }] }),
      networkDetailSchema: ref({ fields: [textField("ssid")] })
    });
    const text = harness.yamlPreview.value;
    expect(text).toContain('wifi:\n  ssid: "my-network"');
    expect(text).toContain("ota:\n  - platform: esphome");
  });

  it("emits a bus block for each configured instance (busses are multi-instance by default)", () => {
    const harness = buildHarness({
      bussesSchemas: ref({ i2c: { fields: [textField("sda"), textField("scl")] } }),
      bussesDefinitions: [{ key: "i2c" }],
      resolveBusEnabled: (key) => key === "i2c",
      getBusInstances: (key) => (key === "i2c" ? [{ sda: "GPIO21", scl: "GPIO22" }] : [])
    });
    expect(harness.yamlPreview.value).toBe(
      'esphome:\n  name: "kitchen_sensor"\n\ni2c:\n  - sda: "GPIO21"\n    scl: "GPIO22"'
    );
    expect(harness.previewTabs.value.map((tab) => tab.key)).toEqual(["core", "busses"]);
  });

  it("produces an empty document when nothing is configured", () => {
    const harness = buildHarness({ esphomeCoreSchema: ref({ fields: [] }) });
    expect(harness.yamlPreview.value).toBe("");
    expect(harness.previewTabs.value).toEqual([]);
  });

  it("prepends a domain-level section comment before a bus block", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [],
        fieldComments: { i2c: "# --- I2C bus for the display ---" }
      }),
      bussesSchemas: ref({ i2c: { fields: [textField("sda"), textField("scl")] } }),
      bussesDefinitions: [{ key: "i2c" }],
      resolveBusEnabled: (key) => key === "i2c",
      getBusInstances: (key) => (key === "i2c" ? [{ sda: "GPIO21", scl: "GPIO22" }] : [])
    });
    expect(harness.yamlPreview.value).toBe(
      'esphome:\n  name: "kitchen_sensor"\n\n# --- I2C bus for the display ---\ni2c:\n  - sda: "GPIO21"\n    scl: "GPIO22"'
    );
  });

  // Protokolle, System und Automation hatten bisher keinen pushBlockHeaderComment-Aufruf --
  // die Kommentare wurden gespeichert, aber nie gerendert.
  it("prepends section comments for protocol, system and automation blocks", () => {
    const baseConfig = {
      esphomeCore: { name: "kitchen_sensor" },
      substitutions: {},
      platformCore: {},
      networkCore: {},
      protocolsCore: { api: { password: "geheim" } },
      systemCore: {},
      automationCore: {},
      bussesCore: {},
      components: [],
      system: { logger: { enabled: true, level: "DEBUG" } },
      automation: { interval: [{ interval: "5s" }] },
      fieldComments: {
        api: "# --- API ---",
        logger: "# --- Logger ---",
        interval: "# --- Interval ---"
      }
    };
    const harness = buildHarness({
      config: ref(baseConfig),
      protocolsCoreConfig: ref(baseConfig.protocolsCore),
      protocolsSchemas: ref({ api: { fields: [textField("password")] } }),
      protocolDefinitions: [{ key: "api" }],
      enabledProtocolKeys: ref(["api"]),
      otherSchemas: ref({ logger: { fields: [textField("level")] } }),
      systemConfig: ref(baseConfig.system),
      automationSchemas: ref({ interval: { fields: [{ key: "interval", type: "list", item: { type: "object", fields: [textField("interval")] } }] } }),
      automationCoreConfig: ref(baseConfig.automation),
      automationDefinitions: [{ key: "interval" }]
    });

    const yaml = harness.yamlPreview.value;
    expect(yaml).toContain("# --- API ---\napi:");
    expect(yaml).toContain("# --- Logger ---\nlogger:");
    expect(yaml).toContain("# --- Interval ---\ninterval:");
  });

  it("emits an lvgl block with a label widget once its schema is loaded", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [],
        lvgl: {
          pages: [
            {
              id: "main_page",
              widgets: [
                { uiId: "w1", type: "label", common: { id: "label_1" }, props: { text: "Couch" }, children: [] }
              ]
            }
          ]
        }
      }),
      lvglWidgetSchemas: ref({
        label: { fields: [{ key: "id", type: "id" }, { key: "text", type: "text" }] }
      })
    });
    const text = harness.yamlPreview.value;
    expect(text).toContain("lvgl:");
    expect(text).toContain("pages:");
    expect(text).toContain("- label:");
    expect(text).toContain('text: "Couch"');
  });

  it("groups image/font blocks under an Assets tab, keeping Display for display: only", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [
          { id: "image/file", catalogKey: "image/file", config: { id: "logo", file: "logo.png", type: "BINARY" } },
          { id: "display/ili9xxx", catalogKey: "display/ili9xxx", config: { id: "main_display", model: "ILI9341" } }
        ]
      }),
      componentSchemas: ref({
        "image/file": { id: "image.file", domain: "image", platform: "file", fields: [textField("id"), textField("file"), textField("type")] },
        "display/ili9xxx": { id: "display.ili9xxx", domain: "display", platform: "ili9xxx", fields: [textField("id"), textField("model")] }
      }),
      componentSchemaStatus: ref({ "image/file": "ready", "display/ili9xxx": "ready" })
    });
    const byKey = Object.fromEntries(harness.previewTabs.value.map((tab) => [tab.key, tab]));
    expect(byKey.assets).toBeTruthy();
    expect(byKey.assets.content).toContain("image:");
    expect(byKey.assets.content).not.toContain("display:");
    expect(byKey.display).toBeTruthy();
    expect(byKey.display.content).toContain("display:");
    expect(byKey.display.content).not.toContain("image:");
  });

  it("emits a standalone font/font component as a top-level font: list with a nested file mapping", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [
          {
            id: "font/font",
            catalogKey: "font/font",
            config: { id: "roboto", file: { type: "gfonts", family: "Roboto", weight: "regular" }, size: 20 }
          }
        ]
      }),
      componentSchemas: ref({
        "font/font": {
          id: "font.font",
          domain: "font",
          fields: [
            textField("id"),
            {
              key: "file",
              type: "object",
              fields: [textField("type"), textField("family"), textField("weight")]
            },
            { key: "size", type: "number" }
          ]
        }
      }),
      componentSchemaStatus: ref({ "font/font": "ready" })
    });
    const assets = harness.previewTabs.value.find((tab) => tab.key === "assets");
    expect(assets).toBeTruthy();
    expect(assets.content).toContain("font:");
    expect(assets.content).toMatch(/-\s+id:\s+"?roboto"?/);
    expect(assets.content).toMatch(/file:\s*\n\s+type:\s+"?gfonts"?\s*\n\s+family:\s+"?Roboto"?/);
    expect(assets.content).toContain("size: 20");
  });

  it("emits a single top-level font:/image: key even with several standalone components", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [
          { id: "font/font", catalogKey: "font/font", config: { id: "a", size: 12 } },
          { id: "font/font", catalogKey: "font/font", config: { id: "b", size: 16 } },
          { id: "image/file", catalogKey: "image/file", config: { id: "logo", file: "logo.png", type: "BINARY" } }
        ]
      }),
      componentSchemas: ref({
        "font/font": { id: "font.font", domain: "font", fields: [textField("id"), { key: "size", type: "number" }] },
        "image/file": { id: "image.file", domain: "image", fields: [textField("id"), textField("file"), textField("type")] }
      }),
      componentSchemaStatus: ref({ "font/font": "ready", "image/file": "ready" })
    });
    const assets = harness.previewTabs.value.find((tab) => tab.key === "assets");
    expect((assets.content.match(/^font:/gm) || []).length).toBe(1);
    expect((assets.content.match(/^image:/gm) || []).length).toBe(1);
    expect(assets.content).toMatch(/-\s+id:\s+"?a"?/);
    expect(assets.content).toMatch(/-\s+id:\s+"?b"?/);
  });

  it("keeps a section's leading comment in that section's tab, not the previous one", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [{ id: "output/ledc", catalogKey: "output/ledc", config: { id: "backlight", pin: "GPIO5" } }],
        fieldComments: { output: "# --- Backlight PWM output ---" }
      }),
      bussesSchemas: ref({ spi: { fields: [textField("clk_pin"), textField("id")] } }),
      bussesDefinitions: [{ key: "spi" }],
      resolveBusEnabled: (key) => key === "spi",
      getBusInstances: (key) => (key === "spi" ? [{ clk_pin: "GPIO14", id: "tft_bus" }] : []),
      componentSchemas: ref({
        "output/ledc": { id: "output.ledc", domain: "output", platform: "ledc", fields: [textField("id"), textField("pin")] }
      }),
      componentSchemaStatus: ref({ "output/ledc": "ready" })
    });
    const byKey = Object.fromEntries(harness.previewTabs.value.map((tab) => [tab.key, tab]));
    expect(byKey.busses.content).not.toContain("Backlight PWM output");
    expect(byKey.output.content).toMatch(/# --- Backlight PWM output ---\noutput:/);
  });

  it("prepends a field-level section comment before the matching component field", () => {
    const harness = buildHarness({
      config: ref({
        esphomeCore: { name: "kitchen_sensor" },
        substitutions: {},
        platformCore: {},
        networkCore: {},
        protocolsCore: {},
        systemCore: {},
        automationCore: {},
        bussesCore: {},
        components: [{ id: "touchscreen/xpt2046", catalogKey: "touchscreen/xpt2046", config: { id: "main_touchscreen" } }],
        fieldComments: { "touchscreen[0].id": "# unique per board" }
      }),
      componentSchemas: ref({
        "touchscreen/xpt2046": { domain: "touchscreen", platform: "xpt2046", fields: [textField("id")] }
      }),
      componentSchemaStatus: ref({ "touchscreen/xpt2046": "ready" })
    });
    expect(harness.yamlPreview.value).toContain(
      'touchscreen:\n  - platform: xpt2046\n    # unique per board\n    id: "main_touchscreen"'
    );
  });
});
