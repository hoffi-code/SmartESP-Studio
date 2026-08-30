// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import DisplayInspectorImage from "./DisplayInspectorImage.vue";

const baseElement = () => ({
  type: "image",
  x: 0,
  y: 0,
  w: 40,
  h: 20,
  image: "logo.png",
  imageType: "BINARY"
});

const images = [{ file: "logo.png" }, { file: "icon.png" }];

describe("DisplayInspectorImage", () => {
  it("renders the image select and encoding controls for BINARY", () => {
    const wrapper = mount(DisplayInspectorImage, {
      props: { selectedElement: baseElement(), images }
    });

    expect(wrapper.get("#imageValue").element.value).toBe("logo.png");
    expect(wrapper.find("#imageInvertAlpha").exists()).toBe(true);
    expect(wrapper.find("#imageDither").exists()).toBe(true);
    expect(wrapper.find("#imageByteOrder").exists()).toBe(false);
  });

  it("shows byte_order only for RGB565", () => {
    const wrapper = mount(DisplayInspectorImage, {
      props: { selectedElement: { ...baseElement(), imageType: "RGB565" }, images }
    });

    expect(wrapper.find("#imageByteOrder").exists()).toBe(true);
    expect(wrapper.find("#imageInvertAlpha").exists()).toBe(false);
  });

  it("flags a missing image file as invalid", () => {
    const wrapper = mount(DisplayInspectorImage, {
      props: { selectedElement: { ...baseElement(), image: "" }, images }
    });

    expect(wrapper.get("#imageValue").classes()).toContain("field-error");
    expect(wrapper.text()).toContain("Please select an image file.");
  });

  it("keeps aspect ratio locked when width changes", async () => {
    const wrapper = mount(DisplayInspectorImage, {
      props: { selectedElement: baseElement(), images }
    });

    await wrapper.get("#sizeW").setValue("80");
    expect(wrapper.emitted("update")).toEqual([[{ w: 80, h: 40 }]]);
  });

  it("emits the invert-alpha alias field together with imageInvertAlpha", async () => {
    const wrapper = mount(DisplayInspectorImage, {
      props: { selectedElement: baseElement(), images }
    });

    await wrapper.get("#imageInvertAlpha").setValue("true");
    expect(wrapper.emitted("update")).toEqual([[{ imageInvertAlpha: true, invert: true }]]);
  });

  it("updates image + imageUrl when the selected file changes", async () => {
    const wrapper = mount(DisplayInspectorImage, {
      props: { selectedElement: baseElement(), images, assetsBase: "/base/" }
    });

    await wrapper.get("#imageValue").setValue("icon.png");
    expect(wrapper.emitted("update")[0]).toEqual([{ image: "icon.png", imageUrl: "/base/images/icon.png" }]);
  });
});
