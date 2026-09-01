// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import AssetRefField from "./AssetRefField.vue";

const field = {
  key: "file",
  type: "asset_ref",
  assetKind: "images",
  assetPathPrefix: "esp_assets/images/",
  placeholder: "mdi:home / path"
};

const mountField = (provide = {}, props = {}) =>
  mount(AssetRefField, {
    props: { inputId: "a1", field, modelValue: "", ...props },
    global: { provide }
  });

describe("AssetRefField", () => {
  it("is a plain text input without providers", async () => {
    const wrapper = mountField();
    await wrapper.get("input").trigger("focus");
    expect(wrapper.find(".id-ref-list").exists()).toBe(false);
    expect(wrapper.find(".schema-asset-ref__manage").exists()).toBe(false);
    await wrapper.get("input").setValue("mdi:home");
    expect(wrapper.emitted("update:model-value").at(-1)).toEqual(["mdi:home"]);
  });

  it("lists uploaded files and emits the prefixed path on pick", async () => {
    const wrapper = mountField({ assetRefProvider: (kind) => (kind === "images" ? ["logo.png", "icon.png"] : []) });
    await wrapper.get("input").trigger("focus");
    expect(wrapper.findAll(".id-ref-option").map((b) => b.text())).toEqual(["logo.png", "icon.png"]);
    await wrapper.findAll(".id-ref-option")[0].trigger("mousedown");
    expect(wrapper.emitted("update:model-value").at(-1)).toEqual(["esp_assets/images/logo.png"]);
  });

  it("filters the list by the typed text", async () => {
    const wrapper = mountField({ assetRefProvider: () => ["logo.png", "background.png"] });
    await wrapper.get("input").trigger("focus");
    await wrapper.get("input").setValue("back");
    expect(wrapper.findAll(".id-ref-option").map((b) => b.text())).toEqual(["background.png"]);
  });

  it("shows a manage button that opens the asset manager", async () => {
    const open = vi.fn();
    const wrapper = mountField({ assetRefProvider: () => [], openAssetManager: open });
    await wrapper.get(".schema-asset-ref__manage").trigger("click");
    expect(open).toHaveBeenCalled();
  });
});
