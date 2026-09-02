import { describe, expect, it } from "vitest";
import { resolveLvglPageLayout, lvglColorToCss, lvglFontPx } from "./lvglLayout";

const node = (over = {}) => ({
  uiId: "w",
  type: "label",
  common: {},
  props: {},
  children: [],
  ...over
});

describe("resolveLvglPageLayout", () => {
  it("places a TOP_LEFT widget at its x/y offset from the page origin", () => {
    const [entry] = resolveLvglPageLayout(
      { widgets: [node({ uiId: "a", common: { x: 10, y: 20, width: 40, height: 12 } })] },
      240,
      320
    );
    expect(entry.box).toEqual({ x: 10, y: 20, w: 40, h: 12 });
    expect(entry.positionable).toBe(true);
  });

  it("resolves CENTER align against the parent box and widget size", () => {
    const [entry] = resolveLvglPageLayout(
      { widgets: [node({ common: { align: "CENTER", width: 100, height: 40 } })] },
      240,
      320
    );
    // (240/2 - 100/2, 320/2 - 40/2)
    expect(entry.box.x).toBe(70);
    expect(entry.box.y).toBe(140);
  });

  it("resolves percentage width against the parent and keeps SIZE_CONTENT as an estimate", () => {
    const [pct] = resolveLvglPageLayout(
      { widgets: [node({ common: { width: "50%", height: 10 } })] },
      200,
      200
    );
    expect(pct.box.w).toBe(100);

    const [content] = resolveLvglPageLayout(
      { widgets: [node({ type: "label", props: { text: "Hi" }, common: { width: "SIZE_CONTENT" } })] },
      200,
      200
    );
    expect(content.box.w).toBeGreaterThan(0);
  });

  it("nests children relative to their parent's resolved box", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({
            uiId: "outer",
            type: "obj",
            common: { x: 20, y: 30, width: 100, height: 100 },
            children: [node({ uiId: "inner", common: { x: 5, y: 5, width: 10, height: 10 } })]
          })
        ]
      },
      240,
      320
    );
    const inner = layout.find((e) => e.uiId === "inner");
    expect(inner.box).toMatchObject({ x: 25, y: 35 });
    expect(inner.depth).toBe(1);
  });

  it("marks flex-container children as layout-managed and not positionable", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({
            uiId: "row",
            type: "obj",
            common: { x: 0, y: 0, width: 200, height: 80 },
            extra: { flex_flow: "ROW" },
            children: [node({ uiId: "c1" }), node({ uiId: "c2" })]
          })
        ]
      },
      240,
      320
    );
    const c1 = layout.find((e) => e.uiId === "c1");
    const c2 = layout.find((e) => e.uiId === "c2");
    expect(c1.layoutManaged).toBe(true);
    expect(c1.positionable).toBe(false);
    // ROW flow -> children run left to right, not piled on the origin
    expect(c2.box.x).toBeGreaterThan(c1.box.x);
    expect(c2.box.y).toBe(c1.box.y);
  });

  it("honours flex direction, per-side padding and the row/column gap", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({
            uiId: "col",
            type: "obj",
            common: { x: 0, y: 0, width: 200, height: 200 },
            props: { layout: { type: "FLEX", flex_flow: "COLUMN", pad_left: 10, pad_top: 6, pad_row: 8 } },
            children: [
              node({ uiId: "c1", common: { height: 20 } }),
              node({ uiId: "c2", common: { height: 20 } })
            ]
          })
        ]
      },
      240,
      320
    );
    const c1 = layout.find((e) => e.uiId === "c1");
    const c2 = layout.find((e) => e.uiId === "c2");
    expect(c1.box.x).toBe(10);
    expect(c1.box.y).toBe(6);
    // second child sits one child height + the pad_row gap below the first
    expect(c2.box.y).toBe(6 + 20 + 8);
    expect(c2.box.x).toBe(10);
  });

  it("lays a grid container out row-major by grid_columns", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({
            uiId: "grid",
            type: "obj",
            common: { x: 0, y: 0, width: 200, height: 200 },
            props: { layout: { type: "GRID", grid_columns: ["FR(1)", "FR(1)"], pad_column: 0, pad_row: 0 } },
            children: [
              node({ uiId: "a", common: { height: 30 } }),
              node({ uiId: "b", common: { height: 30 } }),
              node({ uiId: "c", common: { height: 30 } })
            ]
          })
        ]
      },
      240,
      320
    );
    const a = layout.find((e) => e.uiId === "a");
    const b = layout.find((e) => e.uiId === "b");
    const c = layout.find((e) => e.uiId === "c");
    expect(a.box.x).toBe(0);
    expect(b.box.x).toBe(100); // second column
    expect(b.box.y).toBe(a.box.y);
    expect(c.box.x).toBe(0); // wraps to the next row
    expect(c.box.y).toBeGreaterThan(a.box.y);
  });

  it("treats a props.layout flex/grid container the same as the legacy extra form", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({
            uiId: "row",
            type: "obj",
            common: { x: 0, y: 0, width: 200, height: 80 },
            props: { layout: { type: "FLEX", flex_flow: "ROW" } },
            children: [node({ uiId: "c1" }), node({ uiId: "c2" })]
          })
        ]
      },
      240,
      320
    );
    expect(layout.find((e) => e.uiId === "c1").layoutManaged).toBe(true);
    expect(layout.find((e) => e.uiId === "c1").positionable).toBe(false);
  });

  it("keeps a props.align_to widget non-positionable", () => {
    const layout = resolveLvglPageLayout(
      { widgets: [node({ uiId: "rel", common: {}, props: { align_to: { id: "x", align: "OUT_TOP_MID" } } })] },
      240,
      320
    );
    expect(layout.find((e) => e.uiId === "rel").positionable).toBe(false);
  });

  it("lays out the first tab's widgets of a tabview", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({
            uiId: "tv",
            type: "tabview",
            common: { x: 0, y: 0, width: 200, height: 200 },
            tabs: [
              { name: "One", widgets: [node({ uiId: "in-tab", common: { x: 5, y: 5, width: 30, height: 12 } })] },
              { name: "Two", widgets: [node({ uiId: "hidden-tab" })] }
            ]
          })
        ]
      },
      240,
      320
    );
    expect(layout.find((e) => e.uiId === "in-tab")).toBeTruthy();
    expect(layout.find((e) => e.uiId === "hidden-tab")).toBeUndefined();
  });

  it("drops hidden widgets (and their children) from the layout", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({ uiId: "shown" }),
          node({
            uiId: "gone",
            type: "obj",
            props: { hidden: true },
            children: [node({ uiId: "child" })]
          })
        ]
      },
      240,
      320
    );
    expect(layout.map((e) => e.uiId)).toEqual(["shown"]);
  });

  it("scales a SIZE_CONTENT label with its text_font", () => {
    const small = resolveLvglPageLayout(
      { widgets: [node({ type: "label", props: { text: "Hello" }, common: { width: "SIZE_CONTENT" } })] },
      200,
      200
    )[0];
    const big = resolveLvglPageLayout(
      { widgets: [node({ type: "label", props: { text: "Hello", text_font: "montserrat_28" }, common: { width: "SIZE_CONTENT" } })] },
      200,
      200
    )[0];
    expect(big.box.w).toBeGreaterThan(small.box.w);
    expect(big.box.h).toBeGreaterThan(small.box.h);
  });

  it("keeps unsupported and align_to widgets non-positionable", () => {
    const layout = resolveLvglPageLayout(
      {
        widgets: [
          node({ uiId: "u", type: "unsupported", originalType: "chart", rawYaml: "chart:", common: {} }),
          node({ uiId: "rel", common: {}, extra: { align_to: { id: "u", align: "OUT_BOTTOM_MID" } } })
        ]
      },
      240,
      320
    );
    expect(layout.find((e) => e.uiId === "u").positionable).toBe(false);
    expect(layout.find((e) => e.uiId === "rel").positionable).toBe(false);
  });
});

describe("lvglColorToCss", () => {
  it("accepts 0x-prefixed hex", () => {
    expect(lvglColorToCss("0x3FA9F5")).toBe("#3FA9F5");
  });
  it("returns the fallback for empty input", () => {
    expect(lvglColorToCss("", "#000")).toBe("#000");
    expect(lvglColorToCss(undefined)).toBe("");
  });
});

describe("lvglFontPx", () => {
  it("reads the size from an LVGL built-in font name", () => {
    expect(lvglFontPx({ props: { text_font: "montserrat_28" } })).toBe(28);
    expect(lvglFontPx({ props: { text_font: "unscii_8" } })).toBe(8);
  });
  it("falls back to 14 for a referenced font id or nothing", () => {
    expect(lvglFontPx({ props: { text_font: "my_roboto" } })).toBe(14);
    expect(lvglFontPx({ props: {} })).toBe(14);
    expect(lvglFontPx(null)).toBe(14);
  });
});
