import { colorToCss } from "./displayColor";

// LVGL widget positions are offsets from an `align` anchor inside the parent box,
// not absolute coordinates, and sizes are frequently SIZE_CONTENT / percentages.
// This resolves an approximate screen rectangle per widget so the canvas can draw
// something useful -- it is deliberately not a full LVGL layout engine.

const DEFAULT_ALIGN = "TOP_LEFT";

// anchor(px offset of the widget's top-left) for each align keyword.
const anchorOffset = (align, pw, ph, w, h) => {
  const cx = pw / 2 - w / 2;
  const cy = ph / 2 - h / 2;
  const right = pw - w;
  const bottom = ph - h;
  switch (align || DEFAULT_ALIGN) {
    case "TOP_LEFT": return { x: 0, y: 0 };
    case "TOP_MID": return { x: cx, y: 0 };
    case "TOP_RIGHT": return { x: right, y: 0 };
    case "LEFT_MID": return { x: 0, y: cy };
    case "CENTER": return { x: cx, y: cy };
    case "RIGHT_MID": return { x: right, y: cy };
    case "BOTTOM_LEFT": return { x: 0, y: bottom };
    case "BOTTOM_MID": return { x: cx, y: bottom };
    case "BOTTOM_RIGHT": return { x: right, y: bottom };
    // OUT_* / *_OUT_* variants -- treat as the plain edge, good enough for a preview.
    default: return { x: 0, y: 0 };
  }
};

// Rough content size per widget type, used when width/height is SIZE_CONTENT or absent.
const intrinsicSize = (node) => {
  const text = String(node?.props?.text ?? node?.props?.options?.[0] ?? "");
  switch (node?.type) {
    case "label": return { w: Math.max(24, text.length * 7 + 6), h: 18 };
    case "button": return { w: Math.max(48, text.length * 8 + 20), h: 30 };
    case "checkbox": return { w: Math.max(40, text.length * 7 + 26), h: 20 };
    case "dropdown":
    case "roller":
    case "textarea": return { w: 120, h: node.type === "roller" ? 60 : 28 };
    case "switch": return { w: 44, h: 24 };
    case "slider":
    case "bar": return { w: 120, h: 12 };
    case "arc":
    case "spinner": return { w: 70, h: 70 };
    case "led": return { w: 18, h: 18 };
    case "image":
    case "qrcode":
    case "canvas":
    case "animimg": return { w: 48, h: 48 };
    case "obj":
    case "container":
    case "tabview":
    case "tileview": return { w: 120, h: 100 };
    case "unsupported": return { w: 90, h: 26 };
    default: return { w: 64, h: 28 };
  }
};

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
};

const resolveDim = (value, parentDim, intrinsic) => {
  if (value === undefined || value === null || value === "" || value === "SIZE_CONTENT") return intrinsic;
  const num = toNumber(value);
  if (num !== null) return num;
  const pct = String(value).trim().match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pct) return (Number(pct[1]) / 100) * parentDim;
  return intrinsic;
};

// A parent using flex/grid ignores its children's x/y. Layout lives in
// node.props.layout since the flex/grid schema landed; older opaque nodes may
// still carry the flat keys in node.extra.
const isLayoutContainer = (node) => {
  const layout = node?.props?.layout;
  if (layout && typeof layout === "object") {
    const type = String(layout.type || "").toUpperCase();
    return type === "FLEX" || type === "GRID" || Boolean(layout.flex_flow || layout.grid_columns || layout.grid_rows);
  }
  const extra = node?.extra || {};
  return Boolean(
    extra.flex_flow || extra.grid_rows || extra.grid_columns ||
    (extra.layout && typeof extra.layout === "object")
  );
};

const hasAlignTo = (node) => Boolean(node?.props?.align_to || node?.extra?.align_to);

let counter = 0;

const layoutNode = (node, parentBox, depth, flexParent, out) => {
  const common = node.common || {};
  const intrinsic = intrinsicSize(node);
  const w = Math.max(1, resolveDim(common.width, parentBox.w, intrinsic.w));
  const h = Math.max(1, resolveDim(common.height, parentBox.h, intrinsic.h));

  let x;
  let y;
  let positionable = !hasAlignTo(node) && node.type !== "unsupported";

  if (flexParent) {
    // Stack managed children top-down inside the parent; their real position is
    // decided by LVGL, this is only so they don't all pile on the origin.
    x = parentBox.x + 4;
    y = parentBox._flexCursor;
    parentBox._flexCursor += h + 4;
    positionable = false;
  } else {
    const offX = toNumber(common.x) ?? 0;
    const offY = toNumber(common.y) ?? 0;
    const anchor = anchorOffset(common.align, parentBox.w, parentBox.h, w, h);
    x = parentBox.x + anchor.x + offX;
    y = parentBox.y + anchor.y + offY;
  }

  counter += 1;
  const entry = {
    key: node.uiId || `lvgl-node-${counter}`,
    uiId: node.uiId || "",
    type: node.type,
    node,
    depth,
    box: { x, y, w, h },
    positionable,
    layoutManaged: Boolean(flexParent)
  };
  out.push(entry);

  // Regular nesting plus the active tab/tile of a tabview/tileview (preview shows
  // the first group; the canvas can switch which one via node._activeGroup).
  const groupWidgets = (node.tabs || node.tiles || [])[node._activeGroup || 0]?.widgets || [];
  const children = [...(node.children || []), ...groupWidgets];
  if (children.length) {
    const childBox = { x, y, w, h, _flexCursor: y + 4 };
    const childFlex = isLayoutContainer(node);
    children.forEach((child) => layoutNode(child, childBox, depth + 1, childFlex, out));
  }
  return entry;
};

// Returns a flat, paint-ordered list of { key, uiId, type, node, depth, box, positionable, layoutManaged }.
export const resolveLvglPageLayout = (page, canvasWidth, canvasHeight) => {
  counter = 0;
  const out = [];
  const root = { x: 0, y: 0, w: canvasWidth, h: canvasHeight, _flexCursor: 4 };
  (page?.widgets || []).forEach((widget) => layoutNode(widget, root, 0, false, out));
  return out;
};

export const lvglColorToCss = (value, fallback = "") => {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim().replace(/^0x/i, "");
  return colorToCss(raw, fallback);
};
