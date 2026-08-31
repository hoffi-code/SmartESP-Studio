// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LvglWidgetInspectorImage from "./LvglWidgetInspectorImage.vue";

const baseNode = () => ({
  uiId: "w1",
  type: "image",
  common: { id: "img_1", y: -8 },
  props: { src: "icon_couch", image_recolor: "0x3FFFFF", image_recolor_opa: "100%" },
  children: []
});

describe("LvglWidgetInspectorImage", () => {
  it("renders the common fields and the image-specific fields", () => {
    const wrapper = mount(LvglWidgetInspectorImage, { props: { node: baseNode() } });

    expect(wrapper.get("#schema-id").element.value).toBe("img_1");
    expect(wrapper.get("#schema-y").element.value).toBe("-8");
    expect(wrapper.get("#schema-src").element.value).toBe("icon_couch");
    expect(wrapper.get("#schema-image_recolor").element.value).toBe("0x3FFFFF");
    expect(wrapper.get("#schema-image_recolor_opa").element.value).toBe("100%");
  });

  it("emits an updated node when the image source changes", async () => {
    const wrapper = mount(LvglWidgetInspectorImage, { props: { node: baseNode() } });

    await wrapper.get("#schema-src").setValue("icon_kettle");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.props.src).toBe("icon_kettle");
    expect(patch.common.id).toBe("img_1");
  });
});
