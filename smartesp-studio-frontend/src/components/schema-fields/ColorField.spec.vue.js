// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ColorField from "./ColorField.vue";
import ColorPickerModal from "../ColorPickerModal.vue";

const mountField = (props = {}) =>
  mount(ColorField, {
    props: { inputId: "schema-c", field: { key: "bg_color", type: "color" }, modelValue: "", ...props }
  });

describe("ColorField", () => {
  it("renders a swatch, a free-text input and a picker button", () => {
    const w = mountField({ modelValue: "0x3FA9F5" });
    expect(w.find(".schema-color__swatch").exists()).toBe(true);
    expect(w.get("input[type='text']").element.value).toBe("0x3FA9F5");
    expect(w.findAll("button").some((b) => b.text() === "Pick")).toBe(true);
  });

  it("passes raw text through on input (templates / named colours stay editable)", async () => {
    const w = mountField();
    await w.get("input[type='text']").setValue("!lambda return lv_color_hex(0x00ff00);");
    expect(w.emitted("update:model-value").at(-1)).toEqual(["!lambda return lv_color_hex(0x00ff00);"]);
  });

  it("emits 0xRRGGBB when the field format is hex0x", async () => {
    const w = mountField({ field: { key: "bg_color", type: "color", colorFormat: "hex0x" } });
    await w.findAll("button").find((b) => b.text() === "Pick").trigger("click");
    w.findComponent(ColorPickerModal).vm.$emit("select", "#3FA9F5");
    await w.vm.$nextTick();
    expect(w.emitted("update:model-value").at(-1)).toEqual(["0x3FA9F5"]);
  });

  it("emits #RRGGBB by default and keeps 0x when the current value already uses it", async () => {
    const hexDefault = mountField();
    await hexDefault.findAll("button").find((b) => b.text() === "Pick").trigger("click");
    hexDefault.findComponent(ColorPickerModal).vm.$emit("select", "#112233");
    await hexDefault.vm.$nextTick();
    expect(hexDefault.emitted("update:model-value").at(-1)).toEqual(["#112233"]);

    const zeroX = mountField({ modelValue: "0xffffff" });
    await zeroX.findAll("button").find((b) => b.text() === "Pick").trigger("click");
    zeroX.findComponent(ColorPickerModal).vm.$emit("select", "#112233");
    await zeroX.vm.$nextTick();
    expect(zeroX.emitted("update:model-value").at(-1)).toEqual(["0x112233"]);
  });
});
