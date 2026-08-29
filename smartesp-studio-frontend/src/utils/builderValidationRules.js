import { isMultiInstanceBusIdDomain } from "./busInstances";
import { extractGpioUsageValue } from "./schemaGpio";
import { buildIdRefOptions } from "./schemaIdRefs";
import { isSecretReferenceValue, validateGeneratedPasswordValue } from "./schemaAuto";

const toPathLabel = (label, path) => (path.length ? `${label}.${path.join(".")}` : label);

// Use the same effective ID value users see in the form.
// For required id fields we fall back to schema default when config is still empty.
const resolveRegistryFieldValue = (field, configValue) => {
  if (!field?.key) return undefined;
  const explicitValue = configValue?.[field.key];
  if (explicitValue !== undefined) {
    return explicitValue;
  }
  if (field.type === "id" && field.required === true && typeof field.default === "string") {
    return field.default;
  }
  return undefined;
};

const resolveDependentValue = (key, contextValue, contextFields) => {
  if (contextValue && contextValue[key] !== undefined) {
    return contextValue[key];
  }
  const fieldDefinition = contextFields?.find((field) => field.key === key);
  if (fieldDefinition && fieldDefinition.default !== undefined) {
    return fieldDefinition.default;
  }
  return undefined;
};

const isFieldVisible = (field, contextValue, contextFields) => {
  const dependency = field?.dependsOn;
  if (!dependency) return true;
  const actual = resolveDependentValue(dependency.key, contextValue, contextFields);
  if (dependency.value !== undefined) return actual === dependency.value;
  if (Array.isArray(dependency.values)) return dependency.values.includes(actual);
  if (dependency.notValue !== undefined) return actual !== dependency.notValue;
  return Boolean(actual);
};

export const isArrayLikeSchemaField = (field) =>
  field?.type === "list" || field?.type === "fixed_list" || field?.type === "generated_list";

export const isObjectArrayLikeField = (field, value) =>
  isArrayLikeSchemaField(field) && Array.isArray(value) && field?.item?.type === "object" && field?.item?.fields;

const buildIdOptions = (
  idIndex,
  domain,
  contextComponentId,
  allowSelfReference = false,
  contextScopeId = ""
) => buildIdRefOptions({
  idIndex,
  domain,
  contextComponentId,
  contextScopeId,
  allowSelfReference
});

// Build a registry of values (used for duplicate id/name detection).
export const buildValueRegistry = (entries, match) => {
  const counts = {};

  const addValue = (value) => {
    if (!value || typeof value !== "string") return;
    const key = value.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  };

  const walkFields = (configValue, fields) => {
    if (!fields?.length) return;
    fields.forEach((field) => {
      if (!field?.key) return;
      if (!isFieldVisible(field, configValue, fields)) return;
      const value = resolveRegistryFieldValue(field, configValue);
      if (match(field, value)) {
        addValue(value);
      }
      if (field.type === "object") {
        const nestedValue = configValue?.[field.key];
        if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
          walkFields(nestedValue, field.fields || []);
        }
      }
      if (isObjectArrayLikeField(field, value)) {
        value.forEach((item) => walkFields(item || {}, field.item.fields));
      }
    });
  };

  (entries || []).forEach((entry) => {
    if (!entry?.fields) return;
    walkFields(entry.config || {}, entry.fields);
  });

  return counts;
};

// Validate id_ref fields against the current id registry.
export const buildIdRefErrors = (entries, idIndex) => {
  const errors = [];

  const pushError = (entry, path, message) => {
    errors.push({
      path: toPathLabel(entry?.label || "component", path),
      message,
      scopeId: entry?.scopeId || ""
    });
  };

  const checkIdRef = (value, field, entry, path) => {
    const hasValue = typeof value === "string" && value.trim();
    const options = buildIdOptions(
      idIndex,
      field.domain,
      entry?.componentId,
      Boolean(field?.allowSelfReference),
      entry?.scopeId || ""
    );
    if (!options.length) {
      if (field?.required === true || hasValue) {
        pushError(entry, path, "No matching identifiers available");
      }
      return;
    }
    if (!hasValue) {
      if (field?.required !== true && isMultiInstanceBusIdDomain(field?.domain) && options.length > 1) {
        pushError(entry, path, "Select which bus identifier to use");
      }
      return;
    }
    const match = options.some((option) => option.toLowerCase() === value.toLowerCase());
    if (!match) {
      pushError(entry, path, "No matching identifiers available");
    }
  };

  const walkFields = (configValue, fields, entry, path = []) => {
    if (!fields?.length) return;
    fields.forEach((field) => {
      if (!field?.key) return;
      const value = configValue?.[field.key];
      const nextPath = [...path, field.key];
      if (!isFieldVisible(field, configValue, fields)) return;

      if (field.type === "id_ref") {
        checkIdRef(value, field, entry, nextPath);
      }

      if (field.type === "object") {
        walkFields(value || {}, field.fields || [], entry, nextPath);
      }

      if (isObjectArrayLikeField(field, value)) {
        value.forEach((item, index) => {
          walkFields(item || {}, field.item.fields, entry, [...nextPath, String(index)]);
        });
      }

      if (
        (field.item?.extends === "base_actions.json" || field.item?.extends === "base_conditions.json") &&
        Array.isArray(value)
      ) {
        value.forEach((catalogEntry, index) => {
          const catalogFields = Array.isArray(catalogEntry?.fields) ? catalogEntry.fields : [];
          const catalogConfig = catalogEntry?.config || {};
          walkFields(catalogConfig, catalogFields, entry, [...nextPath, String(index)]);
        });
      }
    });
  };

  (entries || []).forEach((entry) => {
    if (!entry?.fields) return;
    walkFields(entry.config || {}, entry.fields, entry, []);
  });

  return errors;
};

export const buildDisplayElementIdErrors = (
  entries,
  idIndex,
  imageFiles,
  animationFiles,
  iconNames
) => {
  const errors = [];

  const pushError = (entry, path, message) => {
    errors.push({
      path: toPathLabel(entry?.label || "component", path),
      message,
      scopeId: entry?.scopeId || ""
    });
  };

  const hasOptionMatch = (value, options) =>
    options.some((option) => option.toLowerCase() === String(value || "").toLowerCase());

  const checkIdSelection = (value, options, entry, path, message) => {
    if (!options.length) {
      pushError(entry, path, "No matching identifiers available");
      return;
    }
    if (!value || !String(value).trim()) {
      pushError(entry, path, message || "Please select an ID");
      return;
    }
    if (!hasOptionMatch(value, options)) {
      pushError(entry, path, "No matching identifiers available");
    }
  };

  const checkFileSelection = (value, options, entry, path, emptyMessage, missingMessage) => {
    if (!options.length) {
      pushError(entry, path, emptyMessage);
      return;
    }
    if (!value || !String(value).trim()) {
      pushError(entry, path, missingMessage);
      return;
    }
    if (!options.includes(value)) {
      pushError(entry, path, emptyMessage);
    }
  };

  const checkIconSelection = (value, icons, entry, path) => {
    if (!icons.length) {
      pushError(entry, path, "No MDI icons available");
      return;
    }
    const name = String(value || "").trim();
    const trimmed = name.startsWith("mdi:") ? name.slice(4) : name;
    if (!trimmed) {
      pushError(entry, path, "Please select an icon");
      return;
    }
    if (!icons.some((icon) => icon.toLowerCase() === trimmed.toLowerCase())) {
      pushError(entry, path, "Invalid MDI icon name");
    }
  };

  (entries || []).forEach((entry) => {
    if (entry?.domain !== "display") return;
    const layout = entry?.config?._display_builder;
    const elements = Array.isArray(layout?.elements) ? layout.elements : [];
    if (!elements.length) return;
    const contextComponentId = entry.componentId;
    const contextScopeId = entry.scopeId;

    elements.forEach((element, index) => {
      const basePath = ["_display_builder", "elements", String(index)];
      if (element?.type === "text" && element?.textMode === "dynamic") {
        const options = buildIdOptions(
          idIndex,
          element?.dynamicDomain || "",
          contextComponentId,
          false,
          contextScopeId
        );
        checkIdSelection(element?.dynamicId, options, entry, [...basePath, "dynamicId"], "Please select a source ID");
      }

      if (element?.type === "graph") {
        if (!String(element?.graphId || "").trim()) {
          pushError(entry, [...basePath, "graphId"], "Please provide a graph ID");
        }
        if (element?.useTraces) {
          const traces = Array.isArray(element?.traces) ? element.traces : [];
          traces.forEach((trace, traceIndex) => {
            const options = buildIdOptions(idIndex, "sensor", contextComponentId, false, contextScopeId);
            checkIdSelection(trace?.sensor, options, entry, [...basePath, "traces", String(traceIndex), "sensor"], "Please select a sensor ID");
          });
        } else {
          const options = buildIdOptions(idIndex, "sensor", contextComponentId, false, contextScopeId);
          checkIdSelection(element?.sensor, options, entry, [...basePath, "sensor"], "Please select a sensor ID");
        }
      }

      if (element?.type === "animation") {
        if (!String(element?.animationId || "").trim()) {
          pushError(entry, [...basePath, "animationId"], "Please provide an animation ID");
        }
        checkFileSelection(
          element?.animationFile,
          animationFiles || [],
          entry,
          [...basePath, "animationFile"],
          "No GIF animations available",
          "Please select an animation file"
        );
      }

      if (element?.type === "image") {
        checkFileSelection(
          element?.image,
          imageFiles || [],
          entry,
          [...basePath, "image"],
          "No image files available",
          "Please select an image file"
        );
      }

      if (element?.type === "icon") {
        checkIconSelection(element?.icon, iconNames || [], entry, [...basePath, "icon"]);
      }
    });
  });

  return errors;
};

// Additional validation rules (e.g. base64 for API encryption).
export const buildValidationErrors = (entries) => {
  const errors = [];

  const pushError = (entry, path, message) => {
    errors.push({
      path: toPathLabel(entry?.label || "schema", path),
      message,
      scopeId: entry?.scopeId || ""
    });
  };

  const validateField = (value, field, entry, path) => {
    if (field?.type === "password" && isSecretReferenceValue(value)) return;
    const generatedPasswordError = validateGeneratedPasswordValue(field, value);
    if (generatedPasswordError) {
      pushError(entry, path, generatedPasswordError);
      return;
    }
    if (field?.type === "password" && field?.settings?.format === "base64_44") {
      const content = typeof value === "string" ? value.trim() : "";
      if (!/^[A-Za-z0-9+/]{43}=$/.test(content)) {
        pushError(entry, path, "Key must be base64 (44 chars, ending with =).");
      }
    }
  };

  const hasText = (value) => typeof value === "string" && value.trim().length > 0;
  const isMacAddress = (value) => /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(String(value || "").trim());
  const isHex32 = (value) => /^[0-9A-Fa-f]{32}$/.test(String(value || "").trim());
  const isBleUuid = (value) => {
    const normalized = String(value || "").trim();
    return (
      /^[0-9A-Fa-f]{4}$/.test(normalized) ||
      /^[0-9A-Fa-f]{8}$/.test(normalized) ||
      /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(
        normalized
      )
    );
  };
  const isUuid128 = (value) =>
    /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(
      String(value || "").trim()
    );
  const isIntegerLike = (value) => {
    if (value === undefined || value === null || value === "") return false;
    const parsed = Number(value);
    return Number.isInteger(parsed);
  };
  const parseNumberLike = (value) => {
    if (value === undefined || value === null || value === "") return Number.NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };
  const parseMHzValue = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return Number.NaN;
    const match = normalized.match(/^(\d+(?:\.\d+)?)\s*MHz$/i);
    if (!match) return Number.NaN;
    return Number(match[1]);
  };
  const hasTruthyObjectValue = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.values(value).some((item) => item === true || (typeof item === "string" && item.trim()) || typeof item === "number");
  };

  const rootMapEntriesByDomain = new Map();
  entries.forEach((entry) => {
    const renderAs = String(entry?.renderAs || "").trim().toLowerCase();
    const domain = String(entry?.domain || "").trim();
    if (renderAs !== "root_map" || !domain) return;
    if (!rootMapEntriesByDomain.has(domain)) {
      rootMapEntriesByDomain.set(domain, []);
    }
    rootMapEntriesByDomain.get(domain).push(entry);
  });
  const systemPsramEntry = entries.find((entry) => entry?.componentId === "general/system/psram");
  const isSystemPsramEnabled = systemPsramEntry?.config?.enabled === true;

  const walkFields = (configValue, fields, entry, path = []) => {
    if (!fields?.length) return;
    fields.forEach((field) => {
      if (!field?.key) return;
      const value = configValue?.[field.key];
      const nextPath = [...path, field.key];
      if (!isFieldVisible(field, configValue, fields)) return;
      validateField(value, field, entry, nextPath);
      if (field.type === "object") {
        walkFields(value || {}, field.fields || [], entry, nextPath);
      }
      if (isObjectArrayLikeField(field, value)) {
        value.forEach((item, index) => {
          walkFields(item || {}, field.item.fields, entry, [...nextPath, String(index)]);
        });
      }
    });
  };

  entries.forEach((entry) => {
    if (!entry?.fields) return;
    walkFields(entry.config || {}, entry.fields, entry, []);

    if (entry.componentId === "sensor/ble_rssi") {
      const config = entry.config || {};
      const identityKeys = ["mac_address", "irk", "service_uuid", "ibeacon_uuid"];
      const setCount = identityKeys.filter((key) => hasText(config[key])).length;

      if (setCount !== 1) {
        pushError(
          entry,
          ["mac_address"],
          "Set exactly one identity: mac_address, irk, service_uuid or ibeacon_uuid."
        );
      }

      if (hasText(config.mac_address) && !isMacAddress(config.mac_address)) {
        pushError(entry, ["mac_address"], "MAC address must use format AA:BB:CC:DD:EE:FF.");
      }
      if (hasText(config.irk) && !isHex32(config.irk)) {
        pushError(entry, ["irk"], "IRK must be a 32-character hexadecimal string.");
      }
      if (hasText(config.service_uuid) && !isBleUuid(config.service_uuid)) {
        pushError(entry, ["service_uuid"], "Service UUID must be 16-bit, 32-bit, or 128-bit UUID.");
      }
      if (hasText(config.ibeacon_uuid) && !isUuid128(config.ibeacon_uuid)) {
        pushError(entry, ["ibeacon_uuid"], "iBeacon UUID must be a 128-bit UUID.");
      }
      if (config.ibeacon_major !== undefined && config.ibeacon_major !== "" && !isIntegerLike(config.ibeacon_major)) {
        pushError(entry, ["ibeacon_major"], "iBeacon major must be an integer.");
      }
      if (config.ibeacon_minor !== undefined && config.ibeacon_minor !== "" && !isIntegerLike(config.ibeacon_minor)) {
        pushError(entry, ["ibeacon_minor"], "iBeacon minor must be an integer.");
      }
    }

    if (entry.componentId === "sensor/ble_client") {
      const config = entry.config || {};
      const type = String(config.type || "").trim();
      const isCharacteristic = type === "characteristic";

      if (isCharacteristic) {
        if (!hasText(config.service_uuid)) {
          pushError(entry, ["service_uuid"], "Service UUID is required for characteristic type.");
        }
        if (!hasText(config.characteristic_uuid)) {
          pushError(
            entry,
            ["characteristic_uuid"],
            "Characteristic UUID is required for characteristic type."
          );
        }
      }

      if (hasText(config.service_uuid) && !isBleUuid(config.service_uuid)) {
        pushError(entry, ["service_uuid"], "Service UUID must be 16-bit, 32-bit, or 128-bit UUID.");
      }
      if (hasText(config.characteristic_uuid) && !isBleUuid(config.characteristic_uuid)) {
        pushError(
          entry,
          ["characteristic_uuid"],
          "Characteristic UUID must be 16-bit, 32-bit, or 128-bit UUID."
        );
      }
      if (hasText(config.descriptor_uuid) && !isBleUuid(config.descriptor_uuid)) {
        pushError(
          entry,
          ["descriptor_uuid"],
          "Descriptor UUID must be 16-bit, 32-bit, or 128-bit UUID."
        );
      }
      if (config.on_notify && config.notify !== true) {
        pushError(entry, ["on_notify"], "Enable notify=true to use on_notify automation.");
      }
    }

    if (entry.componentId === "sensor/xiaomi_ble") {
      const config = entry.config || {};
      if (hasText(config.mac_address) && !isMacAddress(config.mac_address)) {
        pushError(entry, ["mac_address"], "MAC address must use format AA:BB:CC:DD:EE:FF.");
      }
      if (hasText(config.bindkey) && !isHex32(config.bindkey)) {
        pushError(entry, ["bindkey"], "Bindkey must be a 32-character hexadecimal string.");
      }
    }

    if (entry.componentId === "display/ili9xxx") {
      const config = entry.config || {};
      const model = String(config.model || "").trim();
      const dimensions = config.dimensions;
      const hasDimensionsWidth = Number.isFinite(Number(dimensions?.width)) && Number(dimensions.width) > 0;
      const hasDimensionsHeight = Number.isFinite(Number(dimensions?.height)) && Number(dimensions.height) > 0;
      const hasTransform = hasTruthyObjectValue(config.transform);

      if (config.rotation !== undefined && config.rotation !== "" && config.rotation !== "0" && hasTransform) {
        pushError(entry, ["transform"], "Use either rotation or transform, not both.");
      }

      if (hasText(config.color_palette_images) && config.color_palette !== "IMAGE_ADAPTIVE") {
        pushError(
          entry,
          ["color_palette_images"],
          "color_palette_images is only valid when color_palette is IMAGE_ADAPTIVE."
        );
      }

      if (model === "CUSTOM") {
        if (!hasDimensionsWidth || !hasDimensionsHeight) {
          pushError(entry, ["dimensions"], "Custom model requires dimensions.width and dimensions.height.");
        }
        if (!hasText(config.init_sequence)) {
          pushError(entry, ["init_sequence"], "Custom model requires init_sequence.");
        }
      }

    }

    if (entry.componentId === "display/st7789v") {
      const config = entry.config || {};
      const model = String(config.model || "").trim();
      const width = Number(config.width);
      const height = Number(config.height);
      const hasWidth = Number.isFinite(width) && width > 0;
      const hasHeight = Number.isFinite(height) && height > 0;

      if (model === "Custom" && (!hasWidth || !hasHeight)) {
        pushError(entry, ["width"], "Custom model requires positive width and height values.");
      }
    }

    if (entry.componentId === "display/qspi_dbi") {
      const config = entry.config || {};
      const model = String(config.model || "").trim();
      const dimensions = config.dimensions;
      const hasWidth = Number.isFinite(Number(dimensions?.width)) && Number(dimensions.width) > 0;
      const hasHeight = Number.isFinite(Number(dimensions?.height)) && Number(dimensions.height) > 0;
      const hasTransform = hasTruthyObjectValue(config.transform);

      if (config.rotation !== undefined && config.rotation !== "" && config.rotation !== "0" && hasTransform) {
        pushError(entry, ["transform"], "Use either rotation or transform, not both.");
      }

      if (!hasWidth || !hasHeight) {
        pushError(entry, ["dimensions"], "Dimensions.width and dimensions.height are required.");
      }

      if (model === "CUSTOM" && !hasText(config.init_sequence)) {
        pushError(entry, ["init_sequence"], "Custom model requires init_sequence.");
      }
    }

    if (entry.componentId === "esp32_camera") {
      const config = entry.config || {};
      const dataPins = config.data_pins;
      const frameBufferLocation = String(config.frame_buffer_location || "PSRAM").trim().toUpperCase();
      const externalClockFrequency = parseMHzValue(config.external_clock?.frequency);
      const jpegQuality = parseNumberLike(config.jpeg_quality);
      const frameBufferCount = parseNumberLike(config.frame_buffer_count);
      const contrast = parseNumberLike(config.contrast);
      const brightness = parseNumberLike(config.brightness);
      const saturation = parseNumberLike(config.saturation);
      const aeLevel = parseNumberLike(config.ae_level);
      const aecValue = parseNumberLike(config.aec_value);
      const agcValue = parseNumberLike(config.agc_value);

      if (!Array.isArray(dataPins) || dataPins.filter((value) => value !== undefined && value !== null && String(value).trim() !== "").length !== 8) {
        pushError(entry, ["data_pins"], "ESP32 Camera requires exactly 8 data pins.");
      }
      if (frameBufferLocation === "PSRAM" && !isSystemPsramEnabled) {
        pushError(entry, ["frame_buffer_location"], "PSRAM frame buffers require System > PSRAM to be enabled.");
      }
      if (config.external_clock?.frequency !== undefined && Number.isNaN(externalClockFrequency)) {
        pushError(entry, ["external_clock", "frequency"], "External clock frequency must use format 8MHz to 20MHz.");
      } else if (!Number.isNaN(externalClockFrequency) && (externalClockFrequency < 8 || externalClockFrequency > 20)) {
        pushError(entry, ["external_clock", "frequency"], "External clock frequency must be between 8MHz and 20MHz.");
      }
      if (!Number.isNaN(jpegQuality) && jpegQuality !== 0 && (jpegQuality < 6 || jpegQuality > 63)) {
        pushError(entry, ["jpeg_quality"], "JPEG quality must be 0 or between 6 and 63.");
      }
      if (!Number.isNaN(frameBufferCount) && ![1, 2].includes(frameBufferCount)) {
        pushError(entry, ["frame_buffer_count"], "Frame buffer count must be 1 or 2.");
      }
      if (!Number.isNaN(contrast) && (contrast < -2 || contrast > 2)) {
        pushError(entry, ["contrast"], "Contrast must be between -2 and 2.");
      }
      if (!Number.isNaN(brightness) && (brightness < -2 || brightness > 2)) {
        pushError(entry, ["brightness"], "Brightness must be between -2 and 2.");
      }
      if (!Number.isNaN(saturation) && (saturation < -2 || saturation > 2)) {
        pushError(entry, ["saturation"], "Saturation must be between -2 and 2.");
      }
      if (!Number.isNaN(aeLevel) && (aeLevel < -2 || aeLevel > 2)) {
        pushError(entry, ["ae_level"], "AE level must be between -2 and 2.");
      }
      if (!Number.isNaN(aecValue) && (aecValue < 0 || aecValue > 1200)) {
        pushError(entry, ["aec_value"], "AEC value must be between 0 and 1200.");
      }
      if (!Number.isNaN(agcValue) && (agcValue < 0 || agcValue > 30)) {
        pushError(entry, ["agc_value"], "AGC value must be between 0 and 30.");
      }
    }
  });

  rootMapEntriesByDomain.forEach((domainEntries, domain) => {
    if (domainEntries.length < 2) return;
    domainEntries.forEach((entry) => {
      pushError(entry, [], `Only one root-map component can emit domain '${domain}'.`);
    });
  });

  return errors;
};

// Build GPIO usage index from components and extra configs (busses/network).
export const buildGpioUsageIndex = (
  components,
  schemas,
  extraConfigs = [],
  componentIdFromEntry = (entry) => (typeof entry === "string" ? entry : entry?.id || "")
) => {
  const usage = {};

  const normalizeKey = (value) =>
    value.toLowerCase().replace(/\s+/g, "").replace(/^gpio/, "");

  const addUsage = (value) => {
    const normalizedValue = extractGpioUsageValue(value);
    if (!normalizedValue) return;
    const key = normalizeKey(normalizedValue);
    usage[key] = (usage[key] || 0) + 1;
  };

  const walkFields = (configValue, fields) => {
    if (!fields?.length) return;
    fields.forEach((field) => {
      const value = configValue?.[field.key];
      if (field.type === "gpio") {
        addUsage(value);
      }
      if (field.type === "object") {
        walkFields(value || {}, field.fields || []);
      }
      if (isArrayLikeSchemaField(field) && Array.isArray(value)) {
        if (field.item?.type === "gpio") {
          value.forEach((item) => addUsage(item));
        } else if (field.item?.type === "object" && field.item?.fields) {
          value.forEach((item) => walkFields(item || {}, field.item.fields));
        }
      }
    });
  };

  components.forEach((entry) => {
    const componentId = componentIdFromEntry(entry);
    if (!componentId) return;
    const schema = schemas[componentId];
    if (!schema?.fields) return;
    walkFields(entry?.config || {}, schema.fields);
  });

  extraConfigs.forEach((entry) => {
    if (!entry?.fields) return;
    walkFields(entry.config || {}, entry.fields);
  });

  return usage;
};

// Flatten all ids with component context for id_ref lookups.
export const buildIdIndex = (entries) => {
  const idEntries = [];

  const addEntry = (value, entry, domainOverride = "") => {
    if (!value) return;
    idEntries.push({
      id: value,
      idLower: value.toLowerCase(),
      domain: domainOverride || entry?.domain || entry?.componentId?.split(/[./]/)[0] || "",
      componentId: entry?.componentId || "",
      scopeId: entry?.scopeId || ""
    });
  };

  const walkFields = (configValue, fields, entry) => {
    if (!fields?.length) return;
    fields.forEach((field) => {
      if (!field?.key) return;
      const value = resolveRegistryFieldValue(field, configValue);
      if (!isFieldVisible(field, configValue, fields)) return;
      if (field.type === "id" && typeof value === "string" && value.trim()) {
        const idDomain =
          typeof field.idDomain === "string" && field.idDomain.trim() ? field.idDomain.trim() : "";
        addEntry(value, entry, idDomain);
      }
      if (field.type === "object") {
        const nestedValue = configValue?.[field.key];
        if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
          walkFields(nestedValue, field.fields || [], entry);
        }
      }
      if (isObjectArrayLikeField(field, value)) {
        value.forEach((item) => walkFields(item || {}, field.item.fields, entry));
      }
    });
  };

  (entries || []).forEach((entry) => {
    if (!entry?.fields) return;
    walkFields(entry.config || {}, entry.fields, entry);
  });

  return idEntries;
};

export const buildDuplicateErrors = (entries, idCounts, nameCounts) => {
  const errors = [];

  const pushError = (entry, path, message) => {
    errors.push({
      path: toPathLabel(entry?.label || "component", path),
      message,
      scopeId: entry?.scopeId || ""
    });
  };

  const walkFields = (configValue, fields, entry, path = []) => {
    if (!fields?.length) return;
    fields.forEach((field) => {
      if (!field?.key) return;
      const value = resolveRegistryFieldValue(field, configValue);
      const nextPath = [...path, field.key];
      if (!isFieldVisible(field, configValue, fields)) return;

      if (field.type === "id" && typeof value === "string" && value.trim()) {
        const key = value.toLowerCase();
        if ((idCounts[key] || 0) > 1) {
          pushError(entry, nextPath, "ID already used");
        }
      }

      if (field.key === "name" && typeof value === "string" && value.trim()) {
        const key = value.toLowerCase();
        if ((nameCounts[key] || 0) > 1) {
          pushError(entry, nextPath, "Name already used");
        }
      }

      if (field.type === "object") {
        const nestedValue = configValue?.[field.key];
        if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
          walkFields(nestedValue, field.fields || [], entry, nextPath);
        }
      }

      if (isObjectArrayLikeField(field, value)) {
        value.forEach((item, index) => {
          walkFields(item || {}, field.item.fields, entry, [...nextPath, String(index)]);
        });
      }
    });
  };

  (entries || []).forEach((entry) => {
    if (!entry?.fields) return;
    walkFields(entry.config || {}, entry.fields, entry, []);
  });

  return errors;
};
