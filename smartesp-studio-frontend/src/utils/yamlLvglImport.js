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

  // tabview/tileview hold their child widgets grouped under `tabs`/`tiles`, not a
  // flat `widgets:`. Parse each group's `widgets` into real nodes so the tree,
  // canvas and export can treat them like any other nesting axis.
  const groups = await parseWidgetGroups(type, value, schemaContext);

  // Widget schemas are curated subsets. Keys present in the YAML but not in the
  // schema (e.g. a meter's `scales:`, a widget style block) would otherwise be
  // dropped -- keep them verbatim so an import -> export round-trip stays lossless.
  const schemaKeys = new Set(schema.fields.map((field) => field.key));
  const extra = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (key === "widgets" || key === groups?.key || schemaKeys.has(key)) return;
    extra[key] = raw;
  });

  const node = { uiId: nextUiId(), type, common, props, children };
  if (groups) node[groups.key] = groups.entries;
  if (Object.keys(extra).length) node.extra = extra;
  return node;
};

const GROUP_KEY_BY_TYPE = { tabview: "tabs", tileview: "tiles" };

// Returns { key: "tabs"|"tiles", entries: [{ ...meta, widgets: WidgetNode[] }] }
// for tabview/tileview, or null for every other widget type.
const parseWidgetGroups = async (type, value, schemaContext) => {
  const key = GROUP_KEY_BY_TYPE[type];
  if (!key || !Array.isArray(value[key])) return null;
  const entries = await Promise.all(
    value[key].map(async (raw) => {
      const meta = isPlainObject(raw) ? { ...raw } : {};
      const widgetsRaw = Array.isArray(meta.widgets) ? meta.widgets : [];
      delete meta.widgets;
      const widgets = (
        await Promise.all(widgetsRaw.map((w) => parseWidgetNode(w, schemaContext)))
      ).filter(Boolean);
      // uiId is a builder-only handle so the tree can select the group; it is
      // stripped again on export (see serializeWidgetGroups).
      return { uiId: nextUiId(), ...meta, widgets };
    })
  );
  return { key, entries };
};

const parsePage = async (rawPage, schemaContext) => {
  if (!isPlainObject(rawPage)) return null;
  const widgets = Array.isArray(rawPage.widgets) ? rawPage.widgets : [];
  return {
    id: rawPage.id || "",
    widgets: (await Promise.all(widgets.map((widget) => parseWidgetNode(widget, schemaContext)))).filter(Boolean)
  };
};

// Top-level `lvgl:` keys the builder maps to a dedicated field; everything else
// is kept verbatim in `options` so an import -> export round-trip stays lossless
// and the Settings panel has something to edit.
const LVGL_MAPPED_KEYS = new Set(["displays", "touchscreens", "buffer_size", "bg_color", "pages"]);

// Parses the raw `lvgl:` document value into the Builder's config.lvgl shape. Returns null when
// there is no lvgl section (distinct from an lvgl section with no pages, which is still an object).
// `schemaContext` is optional -- without it (e.g. in tests that only care about the raw tree
// shape), every widget round-trips as an opaque "unsupported" node.
export const parseLvglSection = async (lvglValue, schemaContext = {}) => {
  if (!isPlainObject(lvglValue)) return null;
  const pages = Array.isArray(lvglValue.pages) ? lvglValue.pages : [];
  const options = {};
  Object.entries(lvglValue).forEach(([key, value]) => {
    if (!LVGL_MAPPED_KEYS.has(key)) options[key] = value;
  });
  return {
    displays: Array.isArray(lvglValue.displays) ? lvglValue.displays : [],
    touchscreens: Array.isArray(lvglValue.touchscreens) ? lvglValue.touchscreens : [],
    bufferSize: lvglValue.buffer_size !== undefined ? lvglValue.buffer_size : "",
    bgColor: lvglValue.bg_color !== undefined ? lvglValue.bg_color : "",
    options,
    pages: (await Promise.all(pages.map((page) => parsePage(page, schemaContext)))).filter(Boolean)
  };
};
