import { dump } from "js-yaml";
import { mapYamlObjectToSchemaConfig } from "./schemaProjectImport";
import { loadAutomationContextForSchema } from "./yamlProjectImport";
import { COMMON_FIELD_KEYS, LVGL_WIDGET_TYPES } from "./lvglWidgets";

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

let uiIdCounter = 0;
const nextUiId = () => {
  uiIdCounter += 1;
  return `lvgl-widget-${uiIdCounter}`;
};

const splitCommonAndProps = (flatConfig) => {
  const common = {};
  const propsValue = {};
  Object.entries(flatConfig || {}).forEach(([key, value]) => {
    if (COMMON_FIELD_KEYS.has(key)) {
      common[key] = value;
    } else {
      propsValue[key] = value;
    }
  });
  return { common, props: propsValue };
};

// A widget entry in ESPHome YAML is a single-key object, `{ <type>: {...} }` -- the type is the
// object's own key, not a `platform:` sibling field like every other component domain.
// `schemaContext` supplies the same schema/action-catalog loaders `importYamlToProjectConfig`
// already receives, so a supported widget's fields (including `on_click`) are mapped through the
// exact same generic schema mapper used everywhere else in the app, instead of a bespoke parser
// that would need to be kept in sync by hand.
export const parseWidgetNode = async (rawWidget, schemaContext = {}) => {
  if (!isPlainObject(rawWidget)) return null;
  const keys = Object.keys(rawWidget);
  if (keys.length !== 1) return null;
  const [type] = keys;
  const value = isPlainObject(rawWidget[type]) ? rawWidget[type] : {};
  const childrenRaw = Array.isArray(value.widgets) ? value.widgets : [];
  const children = (
    await Promise.all(childrenRaw.map((child) => parseWidgetNode(child, schemaContext)))
  ).filter(Boolean);

  if (!LVGL_WIDGET_TYPES.has(type) || typeof schemaContext.loadWidgetSchema !== "function") {
    return {
      uiId: nextUiId(),
      type: "unsupported",
      originalType: type,
      rawYaml: dump({ [type]: { ...value, widgets: undefined } }).trimEnd(),
      children
    };
  }

  const schema = await schemaContext.loadWidgetSchema(type);
  if (!schema || !Array.isArray(schema.fields)) {
    return {
      uiId: nextUiId(),
      type: "unsupported",
      originalType: type,
      rawYaml: dump({ [type]: { ...value, widgets: undefined } }).trimEnd(),
      children
    };
  }

  const actionContext = await loadAutomationContextForSchema(schema, value, schemaContext);
  const mapped = mapYamlObjectToSchemaConfig({
    yamlValue: value,
    fields: schema.fields,
    basePath: type,
    actionContext
  });
  const { common, props } = splitCommonAndProps(mapped.config);

  return { uiId: nextUiId(), type, common, props, children };
};

const parsePage = async (rawPage, schemaContext) => {
  if (!isPlainObject(rawPage)) return null;
  const widgets = Array.isArray(rawPage.widgets) ? rawPage.widgets : [];
  return {
    id: rawPage.id || "",
    widgets: (await Promise.all(widgets.map((widget) => parseWidgetNode(widget, schemaContext)))).filter(Boolean)
  };
};

// Parses the raw `lvgl:` document value into the Builder's config.lvgl shape. Returns null when
// there is no lvgl section (distinct from an lvgl section with no pages, which is still an object).
// `schemaContext` is optional -- without it (e.g. in tests that only care about the raw tree
// shape), every widget round-trips as an opaque "unsupported" node.
export const parseLvglSection = async (lvglValue, schemaContext = {}) => {
  if (!isPlainObject(lvglValue)) return null;
  const pages = Array.isArray(lvglValue.pages) ? lvglValue.pages : [];
  return {
    displays: Array.isArray(lvglValue.displays) ? lvglValue.displays : [],
    touchscreens: Array.isArray(lvglValue.touchscreens) ? lvglValue.touchscreens : [],
    bufferSize: lvglValue.buffer_size !== undefined ? lvglValue.buffer_size : "",
    bgColor: lvglValue.bg_color !== undefined ? lvglValue.bg_color : "",
    pages: (await Promise.all(pages.map((page) => parsePage(page, schemaContext)))).filter(Boolean)
  };
};
