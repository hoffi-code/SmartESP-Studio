// LVGL built-in fonts are always selectable without a `font:` component.
export const LVGL_BUILTIN_FONTS = [
  "montserrat_8",
  "montserrat_10",
  "montserrat_12",
  "montserrat_14",
  "montserrat_16",
  "montserrat_18",
  "montserrat_20",
  "montserrat_22",
  "montserrat_24",
  "montserrat_26",
  "montserrat_28",
  "montserrat_30",
  "montserrat_32",
  "montserrat_34",
  "montserrat_36",
  "montserrat_38",
  "montserrat_40",
  "montserrat_42",
  "montserrat_44",
  "montserrat_46",
  "montserrat_48",
  "unscii_8",
  "unscii_16",
  "dejavu_16_persian_hebrew",
  "simsun_16_cjk"
];

// Walk pages -> widgets -> children / tab / tile groups, calling `visit` on every widget node.
const forEachLvglWidget = (lvglConfig, visit) => {
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    visit(node);
    (node.children || []).forEach(walk);
    (node.tabs || node.tiles || []).forEach((grp) => (grp?.widgets || []).forEach(walk));
  };
  (lvglConfig?.pages || []).forEach((page) => (page?.widgets || []).forEach(walk));
};

// Group names are plain strings referenced on widgets (`props.group`), not a defined
// section -- offer whatever names are already in use plus lvgl.default_group.
export const collectLvglGroupNames = (lvglConfig) => {
  const names = new Set();
  forEachLvglWidget(lvglConfig, (node) => {
    const group = node.props?.group;
    if (typeof group === "string" && group.trim()) names.add(group.trim());
  });

  const defaultGroup = lvglConfig?.options?.default_group;
  if (typeof defaultGroup === "string" && defaultGroup.trim()) names.add(defaultGroup.trim());

  return [...names].sort((a, b) => a.localeCompare(b));
};

// Widget ids (`common.id`) so id_ref fields -- both LVGL-internal (align_to) and the
// ESPHome `<platform>/lvgl.json` `widget:` fields -- can offer them.
export const collectLvglWidgetIds = (lvglConfig) => {
  const ids = new Set();
  forEachLvglWidget(lvglConfig, (node) => {
    const id = node.common?.id;
    if (typeof id === "string" && id.trim()) ids.add(id.trim());
  });
  return [...ids].sort((a, b) => a.localeCompare(b));
};
