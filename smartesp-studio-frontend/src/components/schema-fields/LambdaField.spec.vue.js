// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import LambdaField from "./LambdaField.vue";

const mountField = (props = {}) =>
  mount(LambdaField, {
    props: { inputId: "l1", modelValue: "", ...props }
  });

describe("LambdaField", () => {
  it("emits the raw text on input", async () => {
    const wrapper = mountField();
    await wrapper.get("textarea").setValue("return id(temp).state;");
    expect(wrapper.emitted("update:model-value").at(-1)).toEqual(["return id(temp).state;"]);
  });

  it("renders the value highlighted in the overlay", async () => {
    const wrapper = mountField({ modelValue: 'return "on";' });
    const overlay = wrapper.get(".lambda-field__highlight");
    await vi.waitFor(() => expect(overlay.html()).toContain('class="hljs-keyword"'));
    expect(overlay.text()).toBe('return "on";');
  });

  it("follows the value and escapes markup", async () => {
    const wrapper = mountField({ modelValue: "" });
    await wrapper.setProps({ modelValue: "if (a < b) return true;" });
    const overlay = wrapper.get(".lambda-field__highlight");
    await vi.waitFor(() => expect(overlay.html()).toContain("hljs-"));
    expect(overlay.text()).toBe("if (a < b) return true;");
    expect(overlay.element.querySelector("b")).toBeNull();
  });

  it("highlights as YAML when asked", async () => {
    const wrapper = mountField({ modelValue: "key: value", language: "yaml" });
    const overlay = wrapper.get(".lambda-field__highlight");
    await vi.waitFor(() => expect(overlay.html()).toContain('class="hljs-attr"'));
    expect(overlay.text()).toBe("key: value");
  });

  it("keeps the overlay scroll in sync with the textarea", async () => {
    const wrapper = mountField({ modelValue: "a\nb\nc" });
    const textarea = wrapper.get("textarea");
    textarea.element.scrollTop = 24;
    textarea.element.scrollLeft = 12;
    await textarea.trigger("scroll");
    const overlay = wrapper.get(".lambda-field__highlight").element;
    expect(overlay.scrollTop).toBe(24);
    expect(overlay.scrollLeft).toBe(12);
  });
});
