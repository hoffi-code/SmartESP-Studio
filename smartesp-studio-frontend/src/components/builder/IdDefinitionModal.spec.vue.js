// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import IdDefinitionModal from "./IdDefinitionModal.vue";

const SchemaRendererStub = {
  name: "SchemaRenderer",
  emits: ["update"],
  template: "<div class=\"schema-renderer-stub\"></div>"
};

const mountModal = (props = {}) =>
  mount(IdDefinitionModal, {
    props: { open: true, componentId: "image/file", schemaPath: "components/image/file.json", ...props },
    global: { stubs: { SchemaRenderer: SchemaRendererStub } }
  });

describe("IdDefinitionModal", () => {
  it("renders nothing while closed", () => {
    expect(mountModal({ open: false }).find(".modal-backdrop").exists()).toBe(false);
  });

  it("seeds the draft with the initial id and keeps Save disabled until the id is a valid free slug", async () => {
    const wrapper = mountModal({ initialId: "", existingIds: ["logo"] });
    const save = wrapper.get(".modal-actions button:last-child");
    expect(save.attributes("disabled")).toBeDefined();

    const renderer = wrapper.findComponent(SchemaRendererStub);
    renderer.vm.$emit("update", { path: ["id"], value: "Bad Id" });
    await wrapper.vm.$nextTick();
    expect(save.attributes("disabled")).toBeDefined();

    renderer.vm.$emit("update", { path: ["id"], value: "logo" });
    await wrapper.vm.$nextTick();
    expect(save.attributes("disabled")).toBeDefined(); // collides with an existing id

    renderer.vm.$emit("update", { path: ["id"], value: "new_font" });
    await wrapper.vm.$nextTick();
    expect(save.attributes("disabled")).toBeUndefined();
  });

  it("emits confirm with the assembled draft", async () => {
    const wrapper = mountModal();
    const renderer = wrapper.findComponent(SchemaRendererStub);
    renderer.vm.$emit("update", { path: ["id"], value: "my_font" });
    renderer.vm.$emit("update", { path: ["size"], value: 20 });
    await wrapper.vm.$nextTick();
    await wrapper.get(".modal-actions button:last-child").trigger("click");
    expect(wrapper.emitted("confirm").at(-1)).toEqual([{ id: "my_font", size: 20 }]);
  });

  it("emits cancel on backdrop click", async () => {
    const wrapper = mountModal();
    await wrapper.get(".modal-backdrop").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});
