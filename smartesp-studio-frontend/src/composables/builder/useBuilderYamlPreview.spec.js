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
