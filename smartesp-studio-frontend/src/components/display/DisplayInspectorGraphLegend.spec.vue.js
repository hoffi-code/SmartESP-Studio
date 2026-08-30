// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorGraphLegend from "./DisplayInspectorGraphLegend.vue";

const baseElement = () => ({
  type: "graph",
  legendEnabled: true,
  legendNameFontSource: "local",
  legendValueFontSource: "local",
  legendNameFontFile: "Roboto-Regular.ttf",
  legendValueFontFile: "Roboto-Regular.ttf"
});

const localFonts = [{ file: "Roboto-Regular.ttf", label: "Roboto Regular" }];
const googleFonts = [{ family: "Lato", variants: ["regular", "700"], files: { regular: "lato-regular.ttf", "700": "lato-700.ttf" } }];

describe("DisplayInspectorGraphLegend", () => {
  it("shows local font selects by default", () => {
    const wrapper = mount(DisplayInspectorGraphLegend, {
      props: { selectedElement: baseElement(), localFonts, googleFonts }
    });

    expect(wrapper.find("#legendNameFontFile").exists()).toBe(true);
    expect(wrapper.find("#legendNameFontFamily").exists()).toBe(false);
  });

  it("switches the name font to google and emits the default family/variant patch", async () => {
    const wrapper = mount(DisplayInspectorGraphLegend, {
      props: { selectedElement: baseElement(), localFonts, googleFonts }
    });

    await wrapper.get("#legendNameFontSource").setValue("google");
    const emitted = wrapper.emitted("update");
    expect(emitted[0][0]).toMatchObject({
      legendNameFontSource: "google",
      legendNameFontFamily: "Lato",
      legendNameFontVariant: "regular",
      legendNameFontUrl: "lato-regular.ttf"
    });
  });

  it("emits legend width/height updates as numbers", async () => {
    const wrapper = mount(DisplayInspectorGraphLegend, {
      props: { selectedElement: baseElement(), localFonts, googleFonts }
    });

    await wrapper.get("#legendWidth").setValue("120");
    expect(wrapper.emitted("update")).toEqual([[{ legendWidth: 120 }]]);
  });
});
