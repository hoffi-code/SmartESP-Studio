import { computed, ref } from "vue";
import { isMultiInstanceBusKey } from "../../utils/busInstances";
import { isArrayLikeSchemaField } from "../../utils/builderValidationRules";
import { normalizeModeLevel } from "../../utils/schemaModeLevel";
import {
  buildComponentsYamlDocumentLines,
  buildGeneralSchemaDocumentBlocks,
  buildGeneralSchemaListDocumentBlock,
  buildSchemaYamlDocumentLines,
  buildSchemaYaml,
  formatYamlValue
} from "../../utils/schemaYaml";
import { createGeneratedYamlLine, createYamlDocument } from "../../utils/yamlDocumentModel";
import { buildLvglYamlLines } from "../../utils/schemaLvglYaml";

const substitutionsBlockKeys = new Set([
  "font",
  "image",
  "images",
  "graph",
  "animation"
]);

const automationBlockKeys = new Set([
  "deep_sleep",
  "script",
  "globals",
  "interval"
]);

const timeBlockKeys = new Set(["time"]);

// Keep only keys that exist in the schema (used before YAML generation).
const filterConfigBySchema = (sourceValue, fields) => {
  if (!sourceValue || typeof sourceValue !== "object") return {};
  const filtered = {};
  (fields || []).forEach((field) => {
    if (!field?.key) return;
    const value = sourceValue[field.key];
    if (value === undefined) return;
    if (field.type === "object" && value && typeof value === "object" && !Array.isArray(value)) {
      filtered[field.key] = filterConfigBySchema(value, field.fields || []);
      return;
    }
    if (
      isArrayLikeSchemaField(field) &&
      Array.isArray(value) &&
      (field.item?.extends === "base_actions.json" || field.item?.extends === "base_filters.json" || field.item?.extends === "base_binary_sensor_filters.json")
    ) {
      filtered[field.key] = value;
      return;
    }
    if (isArrayLikeSchemaField(field) && Array.isArray(value) && Array.isArray(field.item?.fields)) {
      filtered[field.key] = value.map((item) => {
        if (item && typeof item === "object") {
          return filterConfigBySchema(item, field.item.fields || []);
        }
        return item;
      });
      return;
    }
    filtered[field.key] = value;
  });
  return filtered;
};

const shouldEmitEmptyBlock = (fields) => {
  const schemaFields = Array.isArray(fields) ? fields : [];
  if (!schemaFields.length) return false;
  return !schemaFields.some((field) => field.required);
};

const makePreviewOrigin = ({
  owner = "schema",
  type = "field",
  scopeId = "",
  tabKey = "",
  path = [],
  fieldKey = "",
  modeLevel = "",
  confidence = "exact",
  contentKind = "schema",
  suppressFocus = false
} = {}) => ({
  owner,
  type,
  scopeId,
  tabKey,
  path: Array.isArray(path) ? path : [],
  fieldKey,
  modeLevel,
  confidence,
  contentKind,
  suppressFocus: Boolean(suppressFocus)
});

const makeSourceContext = ({ owner = "schema", scopeId = "", tabKey = "", path = [] } = {}) => ({
  owner,
  scopeId,
  tabKey,
  path: Array.isArray(path) ? path : []
});

const pushPreviewLine = (lines, text, blockKey = "", origin = null) => {
  lines.push(createGeneratedYamlLine({
    text,
    blockKey,
    origin,
    id: `preview:${blockKey || "root"}:${lines.length}:${origin?.scopeId || "none"}`
  }));
};

const appendPreviewLines = (lines, nextLines = [], fallbackBlockKey = "") => {
  (nextLines || []).forEach((line) => {
    if (line && typeof line === "object" && Object.prototype.hasOwnProperty.call(line, "text")) {
      lines.push(line);
      return;
    }
    pushPreviewLine(lines, String(line ?? ""), fallbackBlockKey, null);
  });
};

const sectionOrigin = (scopeId, tabKey, path = [], options = {}) =>
  makePreviewOrigin({ type: "section", scopeId, tabKey, path, confidence: "section", ...options });

const parseYamlDocumentBlocks = (documentLines = []) => {
  const blocks = [];
  let current = null;

  const isTopLevelKey = (line) => {
    const text = String(line?.text || "");
    if (!text || /^\s/.test(text)) return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("#")) return false;
    return trimmed.includes(":");
  };

  const isTopLevelValueLine = (line) => {
    const text = String(line?.text || "");
    if (!text || /^\s/.test(text)) return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("#")) return false;
    return !trimmed.includes(":");
  };

  (documentLines || []).forEach((line) => {
    const text = String(line?.text || "");
    if (isTopLevelKey(line)) {
      if (current) blocks.push(current);
      const key = text.split(":")[0].trim();
      current = { key, lines: [text], documentLines: [line] };
      return;
    }
    if (isTopLevelValueLine(line)) {
      if (!current || current.key !== "__root_misc__") {
        if (current) blocks.push(current);
        current = { key: "__root_misc__", lines: [text], documentLines: [line] };
        return;
      }
      current.lines.push(text);
      current.documentLines.push(line);
      return;
    }
    if (current) {
      current.lines.push(text);
      current.documentLines.push(line);
    }
  });

  if (current) blocks.push(current);
  return blocks;
};

const parseTopLevelKeysFromYamlSnippet = (yamlText) => {
  const keys = [];
  const lines = (yamlText || "").split(/\r?\n/);
  lines.forEach((line) => {
    if (!line || /^\s/.test(line)) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes(":")) return;
    const key = trimmed.split(":")[0].trim();
    if (key) keys.push(key);
  });
  return keys;
};

const titleCase = (value) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const humanizePreviewKey = (key) => {
  const map = {
    api: "API",
    ota: "OTA",
    mqtt: "MQTT",
    espnow: "ESP-NOW",
    esphome: "ESPHome",
    i2c: "I2C",
    spi: "SPI",
    uart: "UART",
    i2s: "I2S",
    one_wire: "1-Wire",
    canbus: "CAN Bus",
    psram: "PSRAM",
    status_led: "Status LED",
    web_server: "Web Server"
  };
  if (map[key]) return map[key];
  const normalized = key.replace(/[_-]+/g, " ").trim();
  return titleCase(normalized);
};

const buildPreviewText = (blocks = []) => {
  const parts = blocks.map((block) => block.lines.join("\n").replace(/\n+$/g, ""));
  return parts.join("\n\n").trim();
};

const buildPreviewLines = (blocks = []) => {
  const result = [];
  blocks.forEach((block, index) => {
    if (index > 0) {
      pushPreviewLine(result, "", block.key, null);
    }
    appendPreviewLines(result, block.documentLines || block.lines || [], block.key);
  });
  while (result.length && !String(result[result.length - 1]?.text || "").trim()) {
    result.pop();
  }
  return result;
};

// Assembles the full YAML preview (document + per-tab groupings) from config + schemas.
// This composable only wires together already-tested primitives (buildSchemaYamlDocumentLines,
// buildSchemaYaml, ...); the section/tab boundaries and scope ids are BuilderView's source of
// truth, passed in rather than duplicated here.
export const useBuilderYamlPreview = ({
  config,
  substitutionsCoreSchema,
  esphomeCoreSchema,
  platformCoreConfig,
  platformDetailSchema,
  networkCoreConfig,
  networkDetailSchema,
  networkCoreSchema,
  protocolsCoreConfig,
  protocolsSchemas,
  protocolDefinitions,
  enabledProtocolKeys,
  otherSchemas,
  systemConfig,
  automationSchemas,
  automationCoreConfig,
  automationDefinitions,
  generatedAutomation,
  bussesCoreConfig,
  bussesSchemas,
  bussesDefinitions,
  resolveBusEnabled,
  getBusInstances,
  componentSchemas,
  componentSchemaStatus,
  componentIdFromEntry,
  parseComponentId,
  mdiSubstitutions,
  globalStore,
  hubDomainsInUse,
  substitutionsCoreScopeId,
  esphomeCoreScopeId,
  platformDetailScopeId,
  networkDetailScopeId,
  networkOtaScopeId,
  networkWebServerScopeId,
  lvglWidgetSchemas = ref({})
}) => {
  const pushBlockHeaderComment = (lines, domainKey) => {
    const comment = (config.value.fieldComments || {})[domainKey];
    if (!comment) return;
    comment.split("\n").forEach((line) => pushPreviewLine(lines, line, domainKey, null));
  };

  const yamlPreviewDocument = computed(() => {
    const lines = [];
    const headerComment = config.value.headerComment || "";
    if (headerComment) {
      headerComment.split("\n").forEach((line) => {
        pushPreviewLine(lines, line, "headerComment", null);
      });
      pushPreviewLine(lines, "", "headerComment", null);
    }
    const substitutionsValue = config.value.substitutions || {};
    const substitutionsFields = substitutionsCoreSchema.value?.fields || [];
    if (substitutionsFields.length) {
      const filteredSubstitutionsValue = filterConfigBySchema(
        substitutionsValue,
        substitutionsFields
      );
      const substitutionLines = buildSchemaYamlDocumentLines(
        filteredSubstitutionsValue,
        substitutionsFields,
        0,
        config.value,
        globalStore.value,
        makeSourceContext({ owner: "core", scopeId: substitutionsCoreScopeId, tabKey: "core" }),
        "substitutions"
      );
      if (substitutionLines.length) {
        appendPreviewLines(lines, substitutionLines, "substitutions");
      }
    }
    const coreValue = config.value.esphomeCore || {};
    const coreFields = esphomeCoreSchema.value?.fields || [];
    if (coreFields.length) {
      const filteredCoreValue = filterConfigBySchema(coreValue, coreFields);
      const coreLines = buildSchemaYamlDocumentLines(
        filteredCoreValue,
        coreFields,
        2,
        config.value,
        globalStore.value,
        makeSourceContext({ owner: "core", scopeId: esphomeCoreScopeId, tabKey: "core" }),
        "esphome"
      );
      if (coreLines.length) {
        pushPreviewLine(lines, "", "core", null);
        pushBlockHeaderComment(lines, "esphome");
        pushPreviewLine(lines, "esphome:", "esphome", sectionOrigin(esphomeCoreScopeId, "core", [], { suppressFocus: true }));
        appendPreviewLines(lines, coreLines, "esphome");
      }
    }

    const platformName = platformCoreConfig.value?.platform;
    const detailFields = platformDetailSchema.value?.fields || [];
    if (platformName && detailFields.length) {
      const platformContext = makeSourceContext({ owner: "platform", scopeId: platformDetailScopeId, tabKey: "core" });
      pushPreviewLine(lines, "", platformName, null);
      pushBlockHeaderComment(lines, platformName);
      pushPreviewLine(lines, `${platformName}:`, platformName, sectionOrigin(platformDetailScopeId, "core", [], { suppressFocus: true }));

      if (platformName === "esp32") {
        const {
          platform,
          framework,
          framework_config,
          advanced,
          components,
          ...rest
        } = platformCoreConfig.value || {};
        const esp32Fields = detailFields.filter(
          (field) =>
            ![
              "framework",
              "framework_config",
              "advanced",
              "components"
            ].includes(field.key)
        );
        const baseLines = buildSchemaYamlDocumentLines(rest, esp32Fields, 2, config.value, globalStore.value, platformContext, platformName);
        if (baseLines.length) {
          appendPreviewLines(lines, baseLines, platformName);
        }
        const frameworkConfig = framework_config || {};
        const hasFramework = framework || Object.keys(frameworkConfig).length;
        const hasAdvanced = advanced && Object.keys(advanced).length;
        const hasComponents = Array.isArray(components) && components.length;
        if (hasFramework || hasAdvanced || hasComponents) {
          pushPreviewLine(lines, "  framework:", platformName, makePreviewOrigin({
            type: "field",
            scopeId: platformDetailScopeId,
            tabKey: "core",
            path: ["framework"],
            fieldKey: "framework",
            confidence: "exact"
          }));
          if (framework) {
            pushPreviewLine(lines, `    type: ${framework}`, platformName, makePreviewOrigin({
              type: "field",
              scopeId: platformDetailScopeId,
              tabKey: "core",
              path: ["framework"],
              fieldKey: "framework",
              confidence: "exact"
            }));
          }
          const frameworkField = detailFields.find((field) => field.key === "framework_config");
          const advancedField = detailFields.find((field) => field.key === "advanced");
          const componentsField = detailFields.find((field) => field.key === "components");
          const appendFrameworkFields = (value, fields, formPath = []) => {
            if (!Array.isArray(fields) || !fields.length) return;
            const frameworkLines = buildSchemaYamlDocumentLines(
              value || {},
              fields,
              4,
              config.value,
              globalStore.value,
              makeSourceContext({
                owner: "platform",
                scopeId: platformDetailScopeId,
                tabKey: "core",
                path: formPath
              }),
              platformName
            );
            if (frameworkLines.length) {
              appendPreviewLines(lines, frameworkLines, platformName);
            }
          };

          appendFrameworkFields(frameworkConfig, frameworkField?.fields, ["framework_config"]);
          if (hasAdvanced) {
            appendFrameworkFields({ advanced }, [advancedField], []);
          }
          if (hasComponents) {
            appendFrameworkFields({ components }, [componentsField], []);
          }
        }
      } else {
        const { platform, ...rest } = platformCoreConfig.value || {};
        appendPreviewLines(
          lines,
          buildSchemaYamlDocumentLines(rest, detailFields, 2, config.value, globalStore.value, platformContext, platformName),
          platformName
        );
      }
    }

    const networkTransport = networkCoreConfig.value?.transport;
    const networkCoreFields = networkCoreSchema.value?.fields || [];
    const networkFields = networkDetailSchema.value?.fields || [];
    if (networkTransport && networkFields.length) {
      const { transport, ...rawNetworkConfig } = networkCoreConfig.value || {};
      const networkConfig = filterConfigBySchema(rawNetworkConfig, networkFields);
      const coreNetworkConfig = filterConfigBySchema(rawNetworkConfig, networkCoreFields);
      let captivePortalEnabled = false;
      let webServerConfig = null;
      let webServerFields = [];
      let webServerEnabled = false;

      if (networkTransport === "wifi") {
        const apConfig = networkConfig.ap;
        if (apConfig && typeof apConfig === "object") {
          const apEnabled = apConfig.enabled !== undefined ? apConfig.enabled : true;
          if (apEnabled === false) {
            delete networkConfig.ap;
          } else {
            const { enabled, captive_portal, ...apRest } = apConfig;
            captivePortalEnabled =
              captive_portal !== undefined ? Boolean(captive_portal) : true;
            networkConfig.ap = Object.keys(apRest).length ? apRest : {};
          }
        }
      }

      const webServerField = networkCoreFields.find((field) => field.key === "web_server");
      webServerFields = webServerField?.fields || [];
      const rawWebServer = coreNetworkConfig.web_server;
      if (rawWebServer && typeof rawWebServer === "object") {
        webServerEnabled =
          rawWebServer.enabled !== undefined ? Boolean(rawWebServer.enabled) : false;
        if (webServerEnabled) {
          webServerConfig = rawWebServer;
        }
      }

      const networkContext = makeSourceContext({ owner: "network", scopeId: networkDetailScopeId, tabKey: "core" });
      const networkLines = buildSchemaYamlDocumentLines(
        networkConfig,
        networkFields,
        2,
        config.value,
        globalStore.value,
        networkContext,
        networkTransport
      );
      if (networkLines.length) {
        if (networkTransport === "wifi") {
          const apIndex = networkLines.findIndex(
            (line) => line.text.startsWith("  ") && line.text.trimStart().startsWith("ap:")
          );
          if (apIndex !== -1) {
            const apBlock = [networkLines.splice(apIndex, 1)[0]];
            while (apIndex < networkLines.length && networkLines[apIndex].text.startsWith("    ")) {
              apBlock.push(networkLines.splice(apIndex, 1)[0]);
            }
            if (networkLines.length && networkLines[networkLines.length - 1].text.trim() !== "") {
              pushPreviewLine(networkLines, "", networkTransport, null);
            }
            networkLines.push(
              createGeneratedYamlLine({
                text: "  # Enable fallback hotspot (captive portal) in case wifi connection fails",
                blockKey: networkTransport,
                origin: sectionOrigin(networkDetailScopeId, "core", ["ap"])
              }),
              ...apBlock
            );
          }
        }
        pushPreviewLine(lines, "", networkTransport, null);
        pushBlockHeaderComment(lines, networkTransport);
        pushPreviewLine(lines, `${networkTransport}:`, networkTransport, sectionOrigin(networkDetailScopeId, "core", [], { suppressFocus: true }));
        appendPreviewLines(lines, networkLines, networkTransport);
        if (networkTransport === "wifi" && captivePortalEnabled) {
          pushPreviewLine(lines, "", "captive_portal", null);
          pushPreviewLine(lines, "captive_portal:", "captive_portal", sectionOrigin(networkDetailScopeId, "core", ["ap", "captive_portal"]));
        }
        const otaConfig = networkCoreConfig.value?.ota || null;
        const otaEnabled = otaConfig?.enabled ?? true;
        const otaPasswordEnabled = otaConfig?.use_password ?? true;
        const otaPassword = otaConfig?.password?.trim();
        if (otaEnabled) {
          const otaField = networkCoreFields.find((field) => field.key === "ota");
          const otaOrigin = sectionOrigin(networkOtaScopeId, "core", [], {
            modeLevel: normalizeModeLevel(otaField?.lvl || "Simple")
          });
          pushPreviewLine(lines, "", "ota", null);
          pushPreviewLine(lines, "ota:", "ota", otaOrigin);
          pushPreviewLine(lines, "  - platform: esphome", "ota", otaOrigin);
          if (otaPasswordEnabled && otaPassword) {
            pushPreviewLine(lines, `    password: ${formatYamlValue(otaPassword, { type: "password" })}`, "ota", makePreviewOrigin({
              type: "field",
              scopeId: networkOtaScopeId,
              tabKey: "core",
              path: ["ota", "password"],
              fieldKey: "password"
            }));
          }
        }
        if (webServerEnabled) {
          pushPreviewLine(lines, "", "web_server", null);
          pushPreviewLine(lines, "web_server:", "web_server", sectionOrigin(networkWebServerScopeId, "core"));
          if (webServerFields.length) {
            const webServerLines = buildSchemaYamlDocumentLines(
              webServerConfig || {},
              webServerFields,
              2,
              config.value,
              globalStore.value,
              makeSourceContext({ owner: "network", scopeId: networkWebServerScopeId, tabKey: "core" }),
              "web_server"
            );
            if (webServerLines.length) {
              appendPreviewLines(lines, webServerLines, "web_server");
            }
          }
        }
      }
    }

    const protocolConfig = protocolsCoreConfig.value || {};
    const protocolSchemaMap = protocolsSchemas.value || {};
    protocolDefinitions.forEach((entry) => {
      if (!enabledProtocolKeys.value.includes(entry.key)) return;
      const schema = protocolSchemaMap[entry.key];
      const fields = schema?.fields || [];
      if (!fields.length) return;
      const protocolValue = filterConfigBySchema(protocolConfig[entry.key] || {}, fields);
      const scopeId = `tab:Protocols:${entry.key}`;
      const protocolLines = buildSchemaYamlDocumentLines(
        protocolValue,
        fields,
        2,
        config.value,
        globalStore.value,
        makeSourceContext({ owner: "protocol", scopeId, tabKey: "automation" }),
        entry.key
      );
      if (!protocolLines.length && !shouldEmitEmptyBlock(fields)) return;
      pushPreviewLine(lines, "", entry.key, null);
      pushPreviewLine(lines, `${entry.key}:`, entry.key, sectionOrigin(scopeId, "automation", [], { suppressFocus: true }));
      if (protocolLines.length) {
        appendPreviewLines(lines, protocolLines, entry.key);
      }
    });

    const otherSchemaMap = otherSchemas.value || {};
    const otherConfig = systemConfig.value || {};

    const otherEntries = [
      { key: "logger", label: "logger" },
      { key: "status_led", label: "status_led" },
      { key: "debug", label: "debug" },
      { key: "psram", label: "psram" }
    ];
    otherEntries.forEach((entry) => {
      const schema = otherSchemaMap[entry.key];
      const fields = schema?.fields || [];
      if (!fields.length) return;
      const configValue = otherConfig[entry.key] || {};
      if (!configValue.enabled) return;
      const filteredValue = filterConfigBySchema(configValue || {}, fields);
      const scopeId = `tab:System:${entry.key}`;
      const sectionLines = buildSchemaYamlDocumentLines(
        filteredValue,
        fields,
        2,
        config.value,
        globalStore.value,
        makeSourceContext({ owner: "system", scopeId, tabKey: "core" }),
        entry.label
      );
      if (!sectionLines.length && !shouldEmitEmptyBlock(fields)) return;
      pushPreviewLine(lines, "", entry.label, null);
      pushPreviewLine(lines, `${entry.label}:`, entry.label, sectionOrigin(scopeId, "core", [], { suppressFocus: true }));
      appendPreviewLines(lines, sectionLines, entry.label);
    });

    const automationSchemaMap = automationSchemas.value || {};
    const automationConfig = automationCoreConfig.value || {};
    const generated = generatedAutomation.value || {};

    const buildAutomationListLines = (items, itemFields, entryKey) => {
      const listLines = [];
      items.forEach((item, index) => {
        const scopeId = `tab:Automation:${entryKey}`;
        const objectLines = buildSchemaYamlDocumentLines(
          item || {},
          itemFields,
          4,
          config.value,
          globalStore.value,
          makeSourceContext({ owner: "automation", scopeId, tabKey: "automation", path: [entryKey, index] }),
          entryKey
        );
        if (!objectLines.length) {
          listLines.push(createGeneratedYamlLine({ text: "  - {}", blockKey: entryKey, origin: sectionOrigin(scopeId, "automation", [entryKey, index]) }));
          return;
        }
        const prefix = "  - ";
        const firstLine = objectLines[0];
        listLines.push({ ...firstLine, text: `${prefix}${firstLine.text.slice(4)}` });
        objectLines.slice(1).forEach((line) => listLines.push(line));
      });
      return listLines;
    };

    const normalizeAutomationItems = (value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return [value];
      return [];
    };

    const automationItemSignature = (item, itemFields) => {
      const objectLines = buildSchemaYaml(item || {}, itemFields, 0, config.value, globalStore.value);
      return objectLines.join("\n");
    };

    const dedupeAutomationItems = (items, itemFields, seen) =>
      items.filter((item) => {
        const signature = automationItemSignature(item, itemFields);
        if (!signature) return true;
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });

    automationDefinitions.forEach((entry) => {
      const schema = automationSchemaMap[entry.key];
      const fields = schema?.fields || [];
      const listField = fields.find((field) => field.key === entry.key);
      const itemFields = listField?.item?.fields || [];
      const generatedItemsRaw = normalizeAutomationItems(generated[entry.key]);
      const manualItemsRaw = normalizeAutomationItems(automationConfig[entry.key]);
      if (!itemFields.length || (!generatedItemsRaw.length && !manualItemsRaw.length)) return;
      const seen = new Set();
      const generatedItems = dedupeAutomationItems(generatedItemsRaw, itemFields, seen);
      const manualItems = dedupeAutomationItems(manualItemsRaw, itemFields, seen);
      if (!generatedItems.length && !manualItems.length) return;
      const scopeId = `tab:Automation:${entry.key}`;
      pushPreviewLine(lines, "", entry.key, null);
      pushPreviewLine(lines, `${entry.key}:`, entry.key, sectionOrigin(scopeId, "automation", [], { suppressFocus: true }));
      if (generatedItems.length) {
        pushPreviewLine(lines, "  # Auto-generated", entry.key, sectionOrigin(scopeId, "automation"));
        appendPreviewLines(lines, buildAutomationListLines(generatedItems, itemFields, entry.key), entry.key);
      }
      if (manualItems.length) {
        if (generatedItems.length) {
          pushPreviewLine(lines, "  # Added by user", entry.key, sectionOrigin(scopeId, "automation"));
        }
        appendPreviewLines(lines, buildAutomationListLines(manualItems, itemFields, entry.key), entry.key);
      }
    });

    const bussesConfig = bussesCoreConfig.value || {};
    const bussesSchemaMap = bussesSchemas.value || {};
    const bussesEntries = [
      { key: "i2c", label: "i2c" },
      { key: "spi", label: "spi" },
      { key: "uart", label: "uart" },
      { key: "one_wire", label: "one_wire" },
      { key: "i2s", label: "i2s_audio" },
      { key: "canbus", label: "canbus" },
      { key: "modbus", label: "modbus" }
    ];
    bussesEntries.forEach((entry) => {
      const definition = bussesDefinitions.find((item) => item.key === entry.key);
      if (!definition || !resolveBusEnabled(entry.key)) return;
      const schema = bussesSchemaMap[entry.key];
      const fields = schema?.fields || [];
      if (!fields.length) return;
      if (isMultiInstanceBusKey(entry.key)) {
        const busValues = getBusInstances(entry.key).map((instance) =>
          filterConfigBySchema(instance || {}, fields)
        );
        const busBlocks = buildGeneralSchemaListDocumentBlock(
          entry.label,
          busValues,
          schema,
          config.value,
          globalStore.value,
          {
            ...makeSourceContext({ owner: "bus", scopeId: `tab:Busses:${entry.key}`, tabKey: "busses" }),
            itemScopeId: (index) => `tab:Busses:${entry.key}:${index}`
          },
          { suppressSectionFocus: true }
        );
        if (!busBlocks.length) return;
        busBlocks.forEach((block) => {
          pushPreviewLine(lines, "", block.key, null);
          pushBlockHeaderComment(lines, block.key);
          appendPreviewLines(lines, block.documentLines || block.lines, block.key);
        });
        return;
      }
      const busValue = filterConfigBySchema(bussesConfig[entry.key] || {}, fields);
      const busBlocks = buildGeneralSchemaDocumentBlocks(
        entry.label,
        busValue,
        schema,
        config.value,
        globalStore.value,
        makeSourceContext({ owner: "bus", scopeId: `tab:Busses:${entry.key}`, tabKey: "busses" }),
        { suppressSectionFocus: true }
      );
      const primaryBlock = busBlocks[0] || null;
      const hasPrimaryContent = (primaryBlock?.documentLines?.length || primaryBlock?.lines?.length || 0) > 1;
      if (!hasPrimaryContent && !shouldEmitEmptyBlock(fields)) return;
      busBlocks.forEach((block) => {
        pushPreviewLine(lines, "", block.key, null);
        pushBlockHeaderComment(lines, block.key);
        appendPreviewLines(lines, block.documentLines || block.lines, block.key);
      });
    });

    const componentLines = buildComponentsYamlDocumentLines(
      config.value.components,
      componentSchemas.value,
      componentSchemaStatus.value,
      globalStore.value,
      mdiSubstitutions.value,
      config.value.fieldComments || {}
    );
    if (componentLines.length) {
      pushPreviewLine(lines, "", "components", null);
      appendPreviewLines(lines, componentLines, "components");
    }

    const lvglLines = buildLvglYamlLines(config.value.lvgl, lvglWidgetSchemas.value);
    if (lvglLines.length) {
      pushPreviewLine(lines, "", "lvgl", null);
      lvglLines.forEach((line) => pushPreviewLine(lines, line.text, "lvgl", line.origin));
    }

    while (lines.length && String(lines[0]?.text || "").trim() === "") {
      lines.shift();
    }

    return createYamlDocument(lines);
  });

  const yamlPreview = computed(() => yamlPreviewDocument.value.text);

  const yamlBlocks = computed(() => parseYamlDocumentBlocks(yamlPreviewDocument.value.lines));

  const customPreviewBlockKeys = computed(() => {
    const keys = new Set();
    (config.value.components || []).forEach((entry) => {
      const componentId = componentIdFromEntry(entry);
      if (!componentId) return;
      const schema = componentSchemas.value?.[componentId];
      if (schema?.renderStrategy !== "verbatim_root") return;
      const rawField = typeof schema?.verbatimField === "string" && schema.verbatimField.trim()
        ? schema.verbatimField.trim()
        : "custom_config";
      const rawYaml = typeof entry?.config?.[rawField] === "string" ? entry.config[rawField] : "";
      parseTopLevelKeysFromYamlSnippet(rawYaml).forEach((key) => keys.add(key));
    });
    return keys;
  });

  const customPreviewBlocks = computed(() => {
    const blocks = [];
    (config.value.components || []).forEach((entry, index) => {
      const componentId = componentIdFromEntry(entry);
      if (!componentId) return;
      const schema = componentSchemas.value?.[componentId];
      if (schema?.renderStrategy !== "verbatim_root") return;
      const rawField =
        typeof schema?.verbatimField === "string" && schema.verbatimField.trim()
          ? schema.verbatimField.trim()
          : "custom_config";
      const rawYaml = typeof entry?.config?.[rawField] === "string" ? entry.config[rawField] : "";
      const normalized = rawYaml.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
      if (!normalized.trim()) return;
      blocks.push({ key: `custom-${index}`, lines: normalized.split("\n") });
    });
    return blocks;
  });

  const coreBlockKeys = computed(() => {
    const keys = new Set([
      "esphome",
      "substitutions",
      "ota",
      "api",
      "mqtt",
      "espnow",
      "captive_portal",
      "web_server",
      "logger",
      "status_led",
      "debug",
      "psram"
    ]);
    const platformName = platformCoreConfig.value?.platform;
    if (platformName) keys.add(platformName);
    const networkTransport = networkCoreConfig.value?.transport;
    if (networkTransport) keys.add(networkTransport);
    return keys;
  });

  const bussesBlockKeys = computed(() => {
    const keys = new Set(bussesDefinitions.map((entry) => entry.key));
    keys.add("i2s_audio");
    keys.add("audio_adc");
    keys.add("audio_dac");
    return keys;
  });

  const previewGroups = computed(() => {
    const groups = new Map();

    (config.value.components || []).forEach((entry) => {
      const componentId = componentIdFromEntry(entry);
      if (!componentId) return;
      const schema = componentSchemas.value?.[componentId];
      if (!schema) return;

      const previewGroup = typeof schema?.previewGroup === "string" ? schema.previewGroup.trim() : "";
      if (!previewGroup) return;

      const entryConfig = entry?.config && typeof entry.config === "object" ? entry.config : {};
      const fallbackDomain = String(schema?.domain || parseComponentId(componentId).domain || "").trim();
      const domainBy = typeof schema?.domainBy === "string" ? schema.domainBy.trim() : "";
      const domainMap = schema?.domainMap && typeof schema.domainMap === "object" && !Array.isArray(schema.domainMap)
        ? schema.domainMap
        : null;
      const mappedDomainValue = domainBy ? entryConfig?.[domainBy] : undefined;
      const mappedDomain =
        domainMap && mappedDomainValue !== undefined && domainMap[String(mappedDomainValue)]
          ? String(domainMap[String(mappedDomainValue)]).trim()
          : "";
      const domain = mappedDomain || fallbackDomain;
      if (!domain) return;

      const groupKey = `preview-group:${previewGroup}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: humanizePreviewKey(previewGroup),
          blockKeys: new Set()
        });
      }
      groups.get(groupKey).blockKeys.add(domain);
    });

    return Array.from(groups.values());
  });

  const previewTabs = computed(() => {
    const blocks = yamlBlocks.value;
    const used = new Set();
    const tabs = [];

    const coreBlocks = blocks.filter((block) => coreBlockKeys.value.has(block.key));
    if (coreBlocks.length) {
      tabs.push({ key: "core", label: "Core", blocks: coreBlocks, lines: buildPreviewLines(coreBlocks), content: buildPreviewText(coreBlocks) });
      coreBlocks.forEach((block) => used.add(block.key));
    }

    const automationBlocks = blocks.filter((block) => automationBlockKeys.has(block.key));
    if (automationBlocks.length) {
      tabs.push({ key: "automation", label: "Automation", blocks: automationBlocks, lines: buildPreviewLines(automationBlocks), content: buildPreviewText(automationBlocks) });
      automationBlocks.forEach((block) => used.add(block.key));
    }

    const timeBlocks = blocks.filter((block) => timeBlockKeys.has(block.key));
    if (timeBlocks.length) {
      tabs.push({ key: "time", label: "Time", blocks: timeBlocks, lines: buildPreviewLines(timeBlocks), content: buildPreviewText(timeBlocks) });
      timeBlocks.forEach((block) => used.add(block.key));
    }

    previewGroups.value.forEach((group) => {
      const groupBlocks = blocks.filter((block) => group.blockKeys.has(block.key));
      if (!groupBlocks.length) return;
      tabs.push({ key: group.key, label: group.label, blocks: groupBlocks, lines: buildPreviewLines(groupBlocks), content: buildPreviewText(groupBlocks) });
      groupBlocks.forEach((block) => used.add(block.key));
    });

    const bussesBlocks = blocks.filter((block) => bussesBlockKeys.value.has(block.key));
    if (bussesBlocks.length) {
      tabs.push({ key: "busses", label: "Busses", blocks: bussesBlocks, lines: buildPreviewLines(bussesBlocks), content: buildPreviewText(bussesBlocks) });
      bussesBlocks.forEach((block) => used.add(block.key));
    }

    const hubsBlocks = blocks.filter((block) => hubDomainsInUse.value.has(block.key));
    if (hubsBlocks.length) {
      tabs.push({ key: "hubs", label: "Hubs", blocks: hubsBlocks, lines: buildPreviewLines(hubsBlocks), content: buildPreviewText(hubsBlocks) });
      hubsBlocks.forEach((block) => used.add(block.key));
    }

    const substitutionsBlocks = blocks.filter((block) => substitutionsBlockKeys.has(block.key));
    const displayBlocks = blocks.filter((block) => block.key === "display");
    const combinedDisplayBlocks = [...substitutionsBlocks, ...displayBlocks];
    if (combinedDisplayBlocks.length) {
      tabs.push({ key: "display", label: "Display", blocks: combinedDisplayBlocks, lines: buildPreviewLines(combinedDisplayBlocks), content: buildPreviewText(combinedDisplayBlocks) });
      combinedDisplayBlocks.forEach((block) => used.add(block.key));
    }

    const customBlocks = customPreviewBlocks.value;
    if (customBlocks.length) {
      tabs.push({ key: "custom", label: "Custom", blocks: customBlocks, lines: buildPreviewLines(customBlocks), content: buildPreviewText(customBlocks) });
      customPreviewBlockKeys.value.forEach((key) => used.add(key));
      used.add("__root_misc__");
    }

    blocks.forEach((block) => {
      if (used.has(block.key)) return;
      const groupedBlocks = blocks.filter((candidate) => candidate.key === block.key);
      tabs.push({ key: block.key, label: humanizePreviewKey(block.key), blocks: groupedBlocks, lines: buildPreviewLines(groupedBlocks), content: buildPreviewText(groupedBlocks) });
      used.add(block.key);
    });

    return tabs;
  });

  return {
    yamlPreviewDocument,
    yamlPreview,
    previewTabs
  };
};
