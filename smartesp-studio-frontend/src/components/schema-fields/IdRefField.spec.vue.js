// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import IdRefField from "./IdRefField.vue";

const idx = (id, domain) => ({ id, idLower: id.toLowerCase(), domain, componentId: `${domain}/x`, scopeId: `s:${id}` });

const mountField = (props = {}) =>
  mount(IdRefField, {
    props: {
      inputId: "r1",
      field: { key: "src", type: "id_ref", domain: "image" },
      modelValue: "",
      idIndex: [idx("logo", "image"), idx("icon", "image"), idx("temp", "sensor")],
      ...props
    }
  });

describe("IdRefField", () => {
  it("lists only ids of the field domain, sorted", async () => {
    const wrapper = mountField();
    await wrapper.get("input").trigger("focus");
    expect(wrapper.findAll(".id-ref-option").map((b) => b.text())).toEqual(["icon", "logo"]);
  });

  it("filters the list as the user types and emits the raw input", async () => {
    const wrapper = mountField();
    await wrapper.get("input").trigger("focus");
    await wrapper.get("input").setValue("lo");
    expect(wrapper.emitted("update:model-value").at(-1)).toEqual(["lo"]);
    expect(wrapper.findAll(".id-ref-option").map((b) => b.text())).toEqual(["logo"]);
  });

  it("emits the picked id on option click", async () => {
    const wrapper = mountField();
    await wrapper.get("input").trigger("focus");
    await wrapper.findAll(".id-ref-option").find((b) => b.text() === "logo").trigger("mousedown");
    expect(wrapper.emitted("update:model-value").at(-1)).toEqual(["logo"]);
  });

  it("closes the list on blur after a short delay", async () => {
    vi.useFakeTimers();
    const wrapper = mountField();
    await wrapper.get("input").trigger("focus");
    expect(wrapper.find(".id-ref-list").exists()).toBe(true);
    await wrapper.get("input").trigger("blur");
    vi.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".id-ref-list").exists()).toBe(false);
    vi.useRealTimers();
  });

  it("shows the (empty) sentinel and never emits it", async () => {
    const wrapper = mountField({ field: { key: "src", type: "id_ref", domain: "nothing" } });
    await wrapper.get("input").trigger("focus");
    const only = wrapper.findAll(".id-ref-option");
    expect(only).toHaveLength(1);
    expect(only[0].text()).toBe("(empty)");
    await only[0].trigger("mousedown");
    expect(wrapper.emitted("update:model-value")).toBeUndefined();
  });

  it("flags a required field with no candidates, and clears once a valid id is set", async () => {
    const noCand = mountField({ field: { key: "src", type: "id_ref", domain: "nothing", required: true } });
    expect(noCand.get(".field-error").text()).toBe("No matching identifiers available");

    const typedBad = mountField({ field: { key: "src", type: "id_ref", domain: "image", required: true }, modelValue: "nope" });
    expect(typedBad.get(".field-error").text()).toBe("No matching identifiers available");

    const ok = mountField({ field: { key: "src", type: "id_ref", domain: "image", required: true }, modelValue: "logo" });
    expect(ok.find(".field-error").exists()).toBe(false);
  });

  it("suppresses the error when the field allows free text", () => {
    const wrapper = mountField({
      field: { key: "default_group", type: "id_ref", domain: "__lvgl_group", required: true, allowFreeText: true },
      modelValue: "my_group"
    });
    expect(wrapper.find(".field-error").exists()).toBe(false);
  });

  it("merges options from an injected idRefOptionProvider with the idIndex options", async () => {
    const wrapper = mount(IdRefField, {
      props: {
        inputId: "r3",
        field: { key: "default_font", type: "id_ref", domain: "font" },
        modelValue: "",
        idIndex: [idx("roboto", "font")]
      },
      global: {
        provide: { idRefOptionProvider: (field) => (field.domain === "font" ? ["montserrat_14", "roboto"] : []) }
      }
    });
    await wrapper.get("input").trigger("focus");
    expect(wrapper.findAll(".id-ref-option").map((b) => b.text())).toEqual(["montserrat_14", "roboto"]);
  });

  it("shows the + button only for creatable fields with an injected definer, and emits the new id", async () => {
    const plain = mountField({ field: { key: "src", type: "id_ref", domain: "image" } });
    expect(plain.find(".schema-id-ref__add").exists()).toBe(false);

    const define = vi.fn().mockResolvedValue("new_logo");
    const wrapper = mount(IdRefField, {
      props: {
        inputId: "r2",
        field: { key: "src", type: "id_ref", domain: "image", creatable: true },
        modelValue: "old",
        idIndex: []
      },
      global: { provide: { requestIdDefinition: define } }
    });
    await wrapper.get(".schema-id-ref__add").trigger("click");
    expect(define).toHaveBeenCalledWith("image", { initialName: "old" });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:model-value").at(-1)).toEqual(["new_logo"]);
  });
});
