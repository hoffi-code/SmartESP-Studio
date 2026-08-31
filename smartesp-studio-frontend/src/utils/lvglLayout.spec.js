import { describe, expect, it } from "vitest";
import { resolveLvglPageLayout, lvglColorToCss } from "./lvglLayout";

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
    expect(c2.box.y).toBeGreaterThan(c1.box.y); // stacked, not piled on the origin
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
