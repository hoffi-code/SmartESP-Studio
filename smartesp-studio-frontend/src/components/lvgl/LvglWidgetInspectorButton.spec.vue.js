// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { beforeAll, describe, expect, it } from "vitest";
import LvglWidgetInspectorButton from "./LvglWidgetInspectorButton.vue";

// A button's on_click field renders through the app's generic action-list UI (ListField.vue),
// which eagerly fetches the action catalog on mount. Stub it so that fetch doesn't hit the
// network in this unit test -- the catalog's actual content isn't what these tests check.
beforeAll(() => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ actions: [] })
  });
});

const baseNode = () => ({
  uiId: "w1",
  type: "button",
  common: { id: "btn_1", width: 110 },
  props: { text: "Couch", checkable: false },
  children: []
});

describe("LvglWidgetInspectorButton", () => {
  it("renders the common fields and the button-specific fields", () => {
    const wrapper = mount(LvglWidgetInspectorButton, { props: { node: baseNode() } });

    expect(wrapper.get("#schema-id").element.value).toBe("btn_1");
    expect(wrapper.get("#schema-width").element.value).toBe("110");
    expect(wrapper.get("#schema-text").element.value).toBe("Couch");
    expect(wrapper.find("#schema-checkable").exists()).toBe(true);
    expect(wrapper.find("#schema-bg_color").exists()).toBe(true);
  });

  it("emits an updated node when the button text changes", async () => {
    const wrapper = mount(LvglWidgetInspectorButton, { props: { node: baseNode() } });

    await wrapper.get("#schema-text").setValue("New text");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.props.text).toBe("New text");
    expect(patch.common.id).toBe("btn_1");
  });

  it("emits an updated node when a common field (width) changes", async () => {
    const wrapper = mount(LvglWidgetInspectorButton, { props: { node: baseNode() } });

    await wrapper.get("#schema-width").setValue("200");

    const patch = wrapper.emitted("update").at(-1)[0];
    expect(patch.common.width).toBe("200");
    expect(patch.props.text).toBe("Couch");
  });

  it("renders without error when the button already has an on_click action", () => {
    const node = {
      ...baseNode(),
      props: {
        ...baseNode().props,
        on_click: [{ type: "homeassistant.action", config: { action: "switch.toggle" }, fields: [{ key: "action", type: "text" }] }]
      }
    };
    const wrapper = mount(LvglWidgetInspectorButton, { props: { node } });
    expect(wrapper.exists()).toBe(true);
  });
});
