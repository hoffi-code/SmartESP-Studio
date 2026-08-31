// Single source of truth for which LVGL widget types the builder can edit. Import,
// export, the "add widget" picker, the inspector dispatcher and the schema preload
// in BuilderView all read from here -- adding a widget = one schema JSON under
// public/schemas/components/lvgl/widgets/ + one entry in LVGL_WIDGETS.
//
// A type not listed here still round-trips on import as an opaque raw-YAML node
// (see parseWidgetNode in yamlLvglImport.js); it just isn't editable.

// Position/size fields every widget type shares. The inspector renders these in a
// dedicated Common panel; import/export use the same set to split the flat widget
// object into `common` vs. `props` (it's a UI grouping, not a data distinction --
// buildWidgetFieldValue spreads them back together for export).
export const COMMON_FIELD_KEYS = new Set(["id", "x", "y", "width", "height", "align"]);

const widgetPath = (type) => `components/lvgl/widgets/${type}.json`;

export const LVGL_WIDGETS = [
  { type: "label", label: "Label", schemaPath: widgetPath("label"), defaults: { text: "Label" } },
  { type: "button", label: "Button", schemaPath: widgetPath("button"), defaults: { text: "Button" } },
  { type: "image", label: "Image", schemaPath: widgetPath("image"), defaults: {} },
  { type: "obj", label: "Container", schemaPath: widgetPath("obj"), defaults: {} },
  { type: "led", label: "LED", schemaPath: widgetPath("led"), defaults: {} },
  { type: "line", label: "Line", schemaPath: widgetPath("line"), defaults: {} },
  { type: "arc", label: "Arc", schemaPath: widgetPath("arc"), defaults: {} },
  { type: "bar", label: "Bar", schemaPath: widgetPath("bar"), defaults: {} },
  { type: "slider", label: "Slider", schemaPath: widgetPath("slider"), defaults: {} }
];

export const LVGL_WIDGET_TYPES = new Set(LVGL_WIDGETS.map((widget) => widget.type));

export const lvglWidgetByType = (type) => LVGL_WIDGETS.find((widget) => widget.type === type) || null;

export const lvglWidgetDefaults = (type) => ({ ...(lvglWidgetByType(type)?.defaults || {}) });
