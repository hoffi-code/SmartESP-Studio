// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorText from "./DisplayInspectorText.vue";

const baseElement = () => ({
  type: "text",
  x: 0,
  y: 0,
  w: 100,
  h: 20,
  textMode: "static",
  text: "Hello",
  color: "",
  fontSource: "local",
  fontFile: ""
});

const dynamicIds = [
  { id: "sensor.temp", label: "Temperature", domain: "sensor" },
  { id: "binary_sensor.door", label: "Door", domain: "binary_sensor" }
];

const localFonts = [{ file: "Roboto-Regular.ttf", label: "Roboto Regular" }];
const googleFonts = [{ family: "Lato", variants: ["regular", "700"], files: { regular: "lato-regular.ttf", "700": "lato-700.ttf" } }];

describe("DisplayInspectorText", () => {
  it("shows the static text field in static mode", () => {
    const wrapper = mount(DisplayInspectorText, {
      props: { selectedElement: baseElement(), isMonochrome: true, localFonts, googleFonts, dynamicIds }
    });

    expect(wrapper.find("#textValue").exists()).toBe(true);
    expect(wrapper.find("#dynamicId").exists()).toBe(false);
  });

  it("shows source-id, prefix/suffix and format for a dynamic numeric source", () => {
    const wrapper = mount(DisplayInspectorText, {
      props: {
        selectedElement: { ...baseElement(), textMode: "dynamic", dynamicDomain: "sensor", dynamicId: "sensor.temp" },
        isMonochrome: true,
        localFonts,
        googleFonts,
        dynamicIds
      }
    });

    expect(wrapper.find("#dynamicId").exists()).toBe(true);
    expect(wrapper.find("#prefix").exists()).toBe(true);
    expect(wrapper.find("#format").exists()).toBe(true);
    expect(wrapper.find("#onLabel").exists()).toBe(false);
  });

  it("shows on/off labels for a dynamic binary source", () => {
    const wrapper = mount(DisplayInspectorText, {
      props: {
        selectedElement: { ...baseElement(), textMode: "dynamic", dynamicDomain: "binary_sensor", dynamicId: "binary_sensor.door" },
        isMonochrome: true,
        localFonts,
        googleFonts,
        dynamicIds
      }
    });

    expect(wrapper.find("#onLabel").exists()).toBe(true);
    expect(wrapper.find("#format").exists()).toBe(false);
  });

  it("flags a missing dynamic source id as invalid", () => {
    const wrapper = mount(DisplayInspectorText, {
      props: {
        selectedElement: { ...baseElement(), textMode: "dynamic", dynamicDomain: "sensor", dynamicId: "" },
        isMonochrome: true,
        localFonts,
        googleFonts,
        dynamicIds
      }
    });

    expect(wrapper.get("#dynamicId").classes()).toContain("field-error");
    expect(wrapper.text()).toContain("Please select a source ID.");
  });

  it("hides the color picker when monochrome and shows it otherwise", async () => {
    const mono = mount(DisplayInspectorText, {
      props: { selectedElement: baseElement(), isMonochrome: true, localFonts, googleFonts, dynamicIds }
    });
    expect(mono.find("#elementColor").exists()).toBe(false);

    const color = mount(DisplayInspectorText, {
      props: { selectedElement: baseElement(), isMonochrome: false, localFonts, googleFonts, dynamicIds }
    });
    await color.get("#elementColor").setValue("#123456");
    expect(color.emitted("update")).toEqual([[{ color: "#123456" }]]);
  });

  it("switches font source to google and emits the default family/variant patch", async () => {
    const wrapper = mount(DisplayInspectorText, {
      props: { selectedElement: baseElement(), isMonochrome: true, localFonts, googleFonts, dynamicIds }
    });

    await wrapper.get("#fontSource").setValue("google");
    const emitted = wrapper.emitted("update");
    expect(emitted[0][0]).toMatchObject({
      fontSource: "google",
      fontFamily: "Lato",
      fontVariant: "regular",
      fontUrl: "lato-regular.ttf"
    });
  });

  it("emits a plain x update without aspect-ratio locking", async () => {
    const wrapper = mount(DisplayInspectorText, {
      props: { selectedElement: baseElement(), isMonochrome: true, localFonts, googleFonts, dynamicIds }
    });

    await wrapper.get("#posX").setValue("42");
    expect(wrapper.emitted("update")).toEqual([[{ x: 42 }]]);
  });
});
