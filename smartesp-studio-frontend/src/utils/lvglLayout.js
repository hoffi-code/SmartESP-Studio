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

// Pixel size of a widget's text_font. LVGL's built-ins encode the size in the name
// (montserrat_14, unscii_8); a referenced font: id has an unknown size -> 14.
export const lvglFontPx = (node) => {
  const font = String(node?.props?.text_font ?? "").trim();
  const m = font.match(/_(\d{1,2})$/);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 6 && n <= 64 ? n : 14;
};

// Rough content size per widget type, used when width/height is SIZE_CONTENT or absent.
const intrinsicSize = (node) => {
  const text = String(node?.props?.text ?? node?.props?.options?.[0] ?? "");
  const fp = lvglFontPx(node);
  switch (node?.type) {
    case "label": return { w: Math.max(24, Math.round(text.length * fp * 0.6) + 6), h: fp + 6 };
    case "button": return { w: Math.max(48, Math.round(text.length * fp * 0.6) + 20), h: fp + 16 };
    case "checkbox": return { w: Math.max(40, Math.round(text.length * fp * 0.6) + 26), h: Math.max(20, fp + 6) };
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

const n0 = (value) => {
  const num = toNumber(value);
  return num === null ? 0 : num;
};

// The layout block moved into node.props.layout with the flex/grid schema; older
// opaque nodes still carry it (or the flat keys) in node.extra.
const readLayout = (node) => {
  const fromProps = node?.props?.layout;
  if (fromProps && typeof fromProps === "object") return fromProps;
  const extra = node?.extra || {};
  if (extra.layout && typeof extra.layout === "object") return extra.layout;
  if (extra.flex_flow || extra.grid_columns || extra.grid_rows) return extra;
  return null;
};

const layoutMode = (layout) => {
  if (!layout) return null;
  const type = String(layout.type || "").toUpperCase();
  if (type === "GRID" || layout.grid_columns || layout.grid_rows) return "grid";
  if (type === "FLEX" || layout.flex_flow) return "flex";
  return null;
};

// LVGL pads a container per side (pad_all is the shared fallback); flex/grid gaps
// are pad_row (between rows) and pad_column (between columns). An unspecified gap
// falls back to a few px so preview widgets don't touch; an explicit 0 collapses.
const padSide = (layout, side) => n0(layout[`pad_${side}`] ?? layout.pad_all);

// Returns a stateful positioner(w, h) -> { x, y } for a container's managed
// children, or null when the container isn't a layout container.
const managedPositioner = (node, box) => {
  const layout = readLayout(node);
  const mode = layoutMode(layout);
  if (!mode) return null;

  const padL = padSide(layout, "left");
  const padT = padSide(layout, "top");
  const padR = padSide(layout, "right");
  const padB = padSide(layout, "bottom");
  const innerX = box.x + padL;
  const innerY = box.y + padT;
  const innerW = Math.max(1, box.w - padL - padR);
  const innerH = Math.max(1, box.h - padT - padB);

  if (mode === "grid") {
    const cols = Array.isArray(layout.grid_columns)
      ? layout.grid_columns.length
      : Math.max(1, n0(layout.grid_columns) || 2);
    const gapX = layout.pad_column === undefined ? 4 : n0(layout.pad_column);
    const gapY = layout.pad_row === undefined ? 4 : n0(layout.pad_row);
    const cellW = (innerW - gapX * (cols - 1)) / cols;
    let index = 0;
    let rowY = innerY;
    let rowH = 0;
    return (_w, h) => {
      const col = index % cols;
      if (col === 0 && index > 0) {
        rowY += rowH + gapY;
        rowH = 0;
      }
      rowH = Math.max(rowH, h);
      index += 1;
      return { x: innerX + col * (cellW + gapX), y: rowY };
    };
  }

  const flow = String(layout.flex_flow || "COLUMN").toUpperCase();
  const row = flow.startsWith("ROW");
  const wrap = flow.includes("WRAP");
  const gap = row
    ? layout.pad_column === undefined ? 4 : n0(layout.pad_column)
    : layout.pad_row === undefined ? 4 : n0(layout.pad_row);
  let cx = innerX;
  let cy = innerY;
  let lineExtent = 0;
  return (w, h) => {
    if (row) {
      if (wrap && cx > innerX && cx + w > innerX + innerW) {
        cx = innerX;
        cy += lineExtent + gap;
        lineExtent = 0;
      }
      const pos = { x: cx, y: cy };
      cx += w + gap;
      lineExtent = Math.max(lineExtent, h);
      return pos;
    }
    if (wrap && cy > innerY && cy + h > innerY + innerH) {
      cy = innerY;
      cx += lineExtent + gap;
      lineExtent = 0;
    }
    const pos = { x: cx, y: cy };
    cy += h + gap;
    lineExtent = Math.max(lineExtent, w);
    return pos;
  };
};

const hasAlignTo = (node) => Boolean(node?.props?.align_to || node?.extra?.align_to);

// `hidden: true` isn't a curated builder field, so it rides props/extra/common.
const isHidden = (node) => {
  const v = node?.props?.hidden ?? node?.extra?.hidden ?? node?.common?.hidden;
  return v === true || v === "true";
};

let counter = 0;

const layoutNode = (node, parentBox, depth, placeManaged, out, activeGroupOf) => {
  if (isHidden(node)) return null;
  const common = node.common || {};
  const intrinsic = intrinsicSize(node);
  const w = Math.max(1, resolveDim(common.width, parentBox.w, intrinsic.w));
  const h = Math.max(1, resolveDim(common.height, parentBox.h, intrinsic.h));

  let x;
  let y;
  let positionable = !hasAlignTo(node) && node.type !== "unsupported";

  if (placeManaged) {
    // Flex/grid decides the real position; this only approximates it (direction,
    // per-side padding, row/column gap) so the children don't pile on the origin.
    ({ x, y } = placeManaged(w, h));
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
    layoutManaged: Boolean(placeManaged)
  };
  out.push(entry);

  // Regular nesting plus the active tab/tile of a tabview/tileview. Which group is
  // active comes from the caller (canvas UI state); default to the first.
  const groups = node.tabs || node.tiles || [];
  const activeIndex = groups.length ? Math.min(groups.length - 1, Math.max(0, activeGroupOf?.(node) ?? 0)) : 0;
  const groupWidgets = groups[activeIndex]?.widgets || [];
  const children = [...(node.children || []), ...groupWidgets];
  if (children.length) {
    const childBox = { x, y, w, h };
    const placeChild = managedPositioner(node, childBox);
    children.forEach((child) => layoutNode(child, childBox, depth + 1, placeChild, out, activeGroupOf));
  }
  return entry;
};

// Returns a flat, paint-ordered list of { key, uiId, type, node, depth, box, positionable, layoutManaged }.
// `activeGroupOf(node)` optionally supplies the active tab/tile index for a tabview/tileview.
export const resolveLvglPageLayout = (page, canvasWidth, canvasHeight, activeGroupOf = null) => {
  counter = 0;
  const out = [];
  const root = { x: 0, y: 0, w: canvasWidth, h: canvasHeight };
  (page?.widgets || []).forEach((widget) => layoutNode(widget, root, 0, null, out, activeGroupOf));
  return out;
};

export const lvglColorToCss = (value, fallback = "") => {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim().replace(/^0x/i, "");
  return colorToCss(raw, fallback);
};
