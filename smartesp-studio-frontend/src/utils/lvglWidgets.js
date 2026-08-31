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

export const LVGL_WIDGETS = [
  { type: "label", label: "Label", schemaPath: "components/lvgl/widgets/label.json", defaults: { text: "Label" } },
  { type: "button", label: "Button", schemaPath: "components/lvgl/widgets/button.json", defaults: { text: "Button" } },
  { type: "image", label: "Image", schemaPath: "components/lvgl/widgets/image.json", defaults: {} }
];

export const LVGL_WIDGET_TYPES = new Set(LVGL_WIDGETS.map((widget) => widget.type));

export const lvglWidgetByType = (type) => LVGL_WIDGETS.find((widget) => widget.type === type) || null;

export const lvglWidgetDefaults = (type) => ({ ...(lvglWidgetByType(type)?.defaults || {}) });
