// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import LvglWidgetInspectorGeneric from "./LvglWidgetInspectorGeneric.vue";

// on_click renders through the generic action-list UI (ListField.vue), which eagerly fetches
// the action catalog on mount. Stub fetch so the unit test doesn't hit the network.
beforeAll(() => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ actions: [] })
  });
});

// A button-shaped schema: common block + type fields + an action list. Mirrors
// public/schemas/components/lvgl/widgets/button.json without loading it.
const buttonSchema = () => ({
  fields: [
    { key: "id", type: "id", required: false },
    { key: "x", type: "text", required: false },
    { key: "y", type: "text", required: false },
    { key: "width", type: "text", required: false },
    { key: "height", type: "text", required: false },
    { key: "align", type: "select", required: false, options: ["TOP_LEFT", "CENTER"] },
    { key: "text", type: "text", required: false },
    { key: "checkable", type: "boolean", required: false },
    { key: "bg_color", type: "text", required: false },
    { key: "on_click", type: "list", required: false, item: { type: "object", fields: [], extends: "base_actions.json" } }
  ]
});

const buttonNode = () => ({
  uiId: "w1",
  type: "button",
  common: { id: "btn_1", width: 110 },
  props: { text: "Couch", checkable: false },
  children: []
});

describe("LvglWidgetInspectorGeneric", () => {
  it("renders the common panel plus the schema's type-specific fields", () => {
    const wrapper = mount(LvglWidgetInspectorGeneric, {
      props: { node: buttonNode(), schema: buttonSchema() }
    });

    expect(wrapper.get("#schema-id").element.value).toBe("btn_1");
    expect(wrapper.get("#schema-width").element.value).toBe("110");
    expect(wrapper.get("#schema-text").element.value).toBe("Couch");
    expect(wrapper.find("#schema-checkable").exists()).toBe(true);
    expect(wrapper.find("#schema-bg_color").exists()).toBe(true);
  });

  it("emits a merged node when a type-specific field changes", async () => {
    const wrapper = mount(LvglWidgetInspectorGeneric, {
      props: { node: buttonNode(), schema: buttonSchema() }
    });

    await wrapper.get("#schema-text").setValue("New text");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.props.text).toBe("New text");
    expect(patch.common.id).toBe("btn_1");
  });

  it("emits a merged node when a common field changes", async () => {
    const wrapper = mount(LvglWidgetInspectorGeneric, {
      props: { node: buttonNode(), schema: buttonSchema() }
    });

    await wrapper.get("#schema-width").setValue("200");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.common.width).toBe("200");
    expect(patch.props.text).toBe("Couch");
  });

  it("renders a widget that already has an on_click action", () => {
    const node = {
      ...buttonNode(),
      props: {
        ...buttonNode().props,
        on_click: [{ type: "homeassistant.action", config: { action: "switch.toggle" }, fields: [{ key: "action", type: "text" }] }]
      }
    };
    const wrapper = mount(LvglWidgetInspectorGeneric, { props: { node, schema: buttonSchema() } });
    expect(wrapper.exists()).toBe(true);
  });

  it("keeps common and props separate for an image widget", async () => {
    const imageSchema = {
      fields: [
        { key: "id", type: "id", required: false },
        { key: "y", type: "text", required: false },
        { key: "src", type: "id_ref", required: false, domain: "image" },
        { key: "image_recolor", type: "text", required: false }
      ]
    };
    const node = {
      uiId: "w2",
      type: "image",
      common: { id: "img_1", y: -8 },
      props: { src: "icon_couch", image_recolor: "0x3FFFFF" },
      children: []
    };
    const wrapper = mount(LvglWidgetInspectorGeneric, { props: { node, schema: imageSchema } });

    expect(wrapper.get("#schema-id").element.value).toBe("img_1");
    expect(wrapper.get("#schema-src").element.value).toBe("icon_couch");

    await wrapper.get("#schema-src").setValue("icon_kettle");
    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.props.src).toBe("icon_kettle");
    expect(patch.common.id).toBe("img_1");
  });

  it("shows a note when the schema has no type-specific fields", () => {
    const commonOnly = {
      fields: [
        { key: "id", type: "id", required: false },
        { key: "x", type: "text", required: false },
        { key: "y", type: "text", required: false }
      ]
    };
    const node = { uiId: "w3", type: "obj", common: {}, props: {}, children: [] };
    const wrapper = mount(LvglWidgetInspectorGeneric, { props: { node, schema: commonOnly } });
    expect(wrapper.text()).toContain("No type-specific settings");
  });
});
