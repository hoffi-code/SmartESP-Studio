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
  { type: "slider", label: "Slider", schemaPath: widgetPath("slider"), defaults: {} },
  { type: "switch", label: "Switch", schemaPath: widgetPath("switch"), defaults: {} },
  { type: "checkbox", label: "Checkbox", schemaPath: widgetPath("checkbox"), defaults: { text: "Checkbox" } },
  { type: "dropdown", label: "Dropdown", schemaPath: widgetPath("dropdown"), defaults: {} },
  { type: "roller", label: "Roller", schemaPath: widgetPath("roller"), defaults: {} },
  { type: "spinbox", label: "Spinbox", schemaPath: widgetPath("spinbox"), defaults: {} },
  { type: "textarea", label: "Text area", schemaPath: widgetPath("textarea"), defaults: {} },
  { type: "buttonmatrix", label: "Button matrix", schemaPath: widgetPath("buttonmatrix"), defaults: {} },
  { type: "meter", label: "Meter", schemaPath: widgetPath("meter"), defaults: {} },
  { type: "qrcode", label: "QR code", schemaPath: widgetPath("qrcode"), defaults: {} },
  { type: "spinner", label: "Spinner", schemaPath: widgetPath("spinner"), defaults: {} },
  { type: "animimg", label: "Animated image", schemaPath: widgetPath("animimg"), defaults: {} },
  { type: "tabview", label: "Tab view", schemaPath: widgetPath("tabview"), defaults: {} },
  { type: "tileview", label: "Tile view", schemaPath: widgetPath("tileview"), defaults: {} },
  { type: "keyboard", label: "Keyboard", schemaPath: widgetPath("keyboard"), defaults: {} },
  { type: "canvas", label: "Canvas", schemaPath: widgetPath("canvas"), defaults: {} }
];

export const LVGL_WIDGET_TYPES = new Set(LVGL_WIDGETS.map((widget) => widget.type));

// Which LVGL parts each widget type actually draws. The shared style schema
// resolves style blocks for every part on every widget (so any part: block in
// imported YAML still round-trips), but the inspector only offers the parts that
// make sense for the selected type. Types not listed here have only LV_PART_MAIN.
export const LVGL_WIDGET_PARTS = {
  obj: ["scrollbar"],
  label: ["selected", "scrollbar"],
  arc: ["indicator", "knob"],
  bar: ["indicator"],
  slider: ["indicator", "knob"],
  switch: ["indicator", "knob"],
  checkbox: ["indicator"],
  dropdown: ["indicator", "selected", "scrollbar"],
  roller: ["selected"],
  spinbox: ["cursor", "selected", "scrollbar"],
  textarea: ["cursor", "selected", "scrollbar"],
  buttonmatrix: ["items"],
  keyboard: ["items"],
  meter: ["indicator", "ticks", "items"],
  spinner: ["indicator"],
  tileview: ["scrollbar"]
};

export const lvglWidgetParts = (type) => LVGL_WIDGET_PARTS[type] || [];

export const lvglWidgetByType = (type) => LVGL_WIDGETS.find((widget) => widget.type === type) || null;

export const lvglWidgetDefaults = (type) => ({ ...(lvglWidgetByType(type)?.defaults || {}) });
