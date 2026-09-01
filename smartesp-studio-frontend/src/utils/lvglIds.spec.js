import { describe, expect, it } from "vitest";

import { LVGL_BUILTIN_FONTS, collectLvglGroupNames, collectLvglWidgetIds } from "./lvglIds";

describe("LVGL_BUILTIN_FONTS", () => {
  it("includes the common montserrat sizes and non-latin faces", () => {
    expect(LVGL_BUILTIN_FONTS).toContain("montserrat_14");
    expect(LVGL_BUILTIN_FONTS).toContain("montserrat_48");
    expect(LVGL_BUILTIN_FONTS).toContain("unscii_16");
    expect(LVGL_BUILTIN_FONTS).toContain("simsun_16_cjk");
  });
});

describe("collectLvglGroupNames", () => {
  it("returns an empty list for missing / empty config", () => {
    expect(collectLvglGroupNames(null)).toEqual([]);
    expect(collectLvglGroupNames({ pages: [] })).toEqual([]);
  });

  it("gathers group names from widgets, nested children, tab/tile groups and default_group, sorted and unique", () => {
    const config = {
      options: { default_group: "nav" },
      pages: [
        {
          widgets: [
            { type: "button", props: { group: "nav" } },
            { type: "obj", props: {}, children: [{ type: "slider", props: { group: "sliders" } }] },
            {
              type: "tabview",
              tabs: [
                { name: "A", widgets: [{ type: "label", props: { group: "tab_a" } }] },
                { name: "B", widgets: [{ type: "label", props: {} }] }
              ]
            }
          ]
        }
      ]
    };
    expect(collectLvglGroupNames(config)).toEqual(["nav", "sliders", "tab_a"]);
  });
});

describe("collectLvglWidgetIds", () => {
  it("returns an empty list for missing config", () => {
    expect(collectLvglWidgetIds(null)).toEqual([]);
  });

  it("gathers common.id from widgets, children and tab/tile groups, sorted and unique", () => {
    const config = {
      pages: [
        {
          widgets: [
            { type: "button", common: { id: "btn_ok" } },
            { type: "obj", common: {}, children: [{ type: "slider", common: { id: "vol" } }] },
            {
              type: "tileview",
              tiles: [{ meta: {}, widgets: [{ type: "checkbox", common: { id: "agree" } }] }]
            }
          ]
        }
      ]
    };
    expect(collectLvglWidgetIds(config)).toEqual(["agree", "btn_ok", "vol"]);
  });
});
