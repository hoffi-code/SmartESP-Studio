import { dump } from "js-yaml";
import { pushYamlLine, renderYamlObject } from "./schemaYaml";

// Re-emit widget keys the curated schema doesn't model (see parseWidgetNode's
// `extra`). Rendered as raw YAML at the widget's field indent so a partial
// schema still round-trips losslessly.
const renderExtraLines = (extra, indent) => {
  if (!extra || !Object.keys(extra).length) return [];
  return dump(extra)
    .trimEnd()
    .split("\n")
    .map((line) => (line ? `${" ".repeat(indent)}${line}` : ""));
};

// Reconstructs a widget's own flat field object (common + type-specific props) for the schema
// field renderer. Only fields with a value survive -- renderYamlObject already skips undefined
// optional fields, this just avoids emitting explicit `undefined` for common properties the
// widget never set.
const buildWidgetFieldValue = (node) => {
  const common = node.common || {};
  const value = { ...(node.props || {}) };
  if (common.id) value.id = common.id;
  if (common.x !== undefined) value.x = common.x;
  if (common.y !== undefined) value.y = common.y;
  if (common.width !== undefined) value.width = common.width;
  if (common.height !== undefined) value.height = common.height;
  if (common.align) value.align = common.align;
  return value;
};

// `dashIndent` is the column of the `- ` marker for this widget's own list item.
const serializeWidgetNode = (node, dashIndent, lines, widgetSchemas) => {
  if (!node) return;

  if (node.type === "unsupported") {
    const rawLines = (node.rawYaml || "").split("\n");
    if (!rawLines[0]) return;
    pushYamlLine(lines, `${" ".repeat(dashIndent)}- ${rawLines[0]}`);
    rawLines.slice(1).forEach((line) => {
      pushYamlLine(lines, line ? `${" ".repeat(dashIndent + 2)}${line}` : "");
    });
    return;
  }

  const schema = widgetSchemas?.[node.type];
  if (!schema || !Array.isArray(schema.fields)) return;

  const value = buildWidgetFieldValue(node);
  const objectLines = [];
  renderYamlObject(value, schema.fields, dashIndent + 4, objectLines, value, null);
  const extraLines = renderExtraLines(node.extra, dashIndent + 4);

  if (!objectLines.length && !extraLines.length && !(node.children || []).length) {
    pushYamlLine(lines, `${" ".repeat(dashIndent)}- ${node.type}: {}`);
    return;
  }

  pushYamlLine(lines, `${" ".repeat(dashIndent)}- ${node.type}:`);
  objectLines.forEach((line) => lines.push(line));
  extraLines.forEach((line) => pushYamlLine(lines, line));

  if ((node.children || []).length) {
    pushYamlLine(lines, `${" ".repeat(dashIndent + 4)}widgets:`);
    node.children.forEach((child) => serializeWidgetNode(child, dashIndent + 6, lines, widgetSchemas));
  }
};

const serializePage = (page, dashIndent, lines, widgetSchemas) => {
  pushYamlLine(lines, `${" ".repeat(dashIndent)}- id: ${page.id}`);
  if ((page.widgets || []).length) {
    pushYamlLine(lines, `${" ".repeat(dashIndent + 2)}widgets:`);
    page.widgets.forEach((widget) => serializeWidgetNode(widget, dashIndent + 4, lines, widgetSchemas));
  }
};

// Builds the `lvgl:` block's YAML lines from config.lvgl. `widgetSchemas` maps widget type
// ("label", ...) to its loaded JSON schema -- a widget whose schema isn't loaded yet is skipped
// rather than emitted incorrectly.
export const buildLvglYamlLines = (lvglConfig, widgetSchemas = {}) => {
  if (!lvglConfig) return [];
  const lines = [];

  pushYamlLine(lines, "lvgl:");
  if ((lvglConfig.displays || []).length) {
    pushYamlLine(lines, "  displays:");
    lvglConfig.displays.forEach((id) => pushYamlLine(lines, `    - ${id}`));
  }
  if ((lvglConfig.touchscreens || []).length) {
    pushYamlLine(lines, "  touchscreens:");
    lvglConfig.touchscreens.forEach((id) => pushYamlLine(lines, `    - ${id}`));
  }
  if (lvglConfig.bufferSize !== undefined && lvglConfig.bufferSize !== "") {
    pushYamlLine(lines, `  buffer_size: ${lvglConfig.bufferSize}`);
  }
  if (lvglConfig.bgColor !== undefined && lvglConfig.bgColor !== "") {
    pushYamlLine(lines, `  bg_color: ${lvglConfig.bgColor}`);
  }
  if ((lvglConfig.pages || []).length) {
    pushYamlLine(lines, "  pages:");
    lvglConfig.pages.forEach((page) => serializePage(page, 4, lines, widgetSchemas));
  }

  return lines;
};
