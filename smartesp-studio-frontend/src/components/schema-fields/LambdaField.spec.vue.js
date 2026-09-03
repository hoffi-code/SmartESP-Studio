// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";

import LambdaField from "./LambdaField.vue";

const mountField = (props = {}) =>
  mount(LambdaField, {
    props: { inputId: "l1", modelValue: "", ...props }
  });

// Das Feld ist controlled: ohne Parent, der den Wert zurueckschreibt, setzt Vue
// die Textarea beim naechsten Patch wieder auf den alten Prop-Wert.
const mountBound = ({ idIndex = [], language = "cpp", initial = "" } = {}) => {
  const text = ref(initial);
  const Host = defineComponent({
    setup: () => () =>
      h(LambdaField, {
        inputId: "l1",
        modelValue: text.value,
        idIndex,
        language,
        "onUpdate:model-value": (value) => {
          text.value = value;
        }
      })
  });
  return { wrapper: mount(Host), text };
};

const typeAt = async (wrapper, value, caret) => {
  const textarea = wrapper.get("textarea");
  textarea.element.value = value;
  textarea.element.setSelectionRange(caret, caret);
  await textarea.trigger("input");
  return textarea;
};

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

  it("stays quiet on clean code", () => {
    const wrapper = mountField({
      modelValue: "return id(temp).state;",
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }]
    });
    expect(wrapper.find(".lambda-field__warnings").exists()).toBe(false);
  });

  it("warns about an unknown id and an unbalanced bracket without blocking input", async () => {
    const wrapper = mountField({
      modelValue: "return id(ghost).state;",
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }]
    });
    let items = wrapper.findAll(".lambda-field__warnings li");
    expect(items).toHaveLength(1);
    expect(items[0].text()).toContain("ghost");

    await wrapper.setProps({ modelValue: "return (id(ghost).state;" });
    items = wrapper.findAll(".lambda-field__warnings li");
    expect(items).toHaveLength(2);
    expect(wrapper.get("textarea").attributes("disabled")).toBeUndefined();
  });

  it("does not lint yaml fields", () => {
    const wrapper = mountField({ modelValue: "key: (value", language: "yaml" });
    expect(wrapper.find(".lambda-field__warnings").exists()).toBe(false);
  });

  it("suggests ids while an id( call is open and inserts the pick", async () => {
    const { wrapper, text } = mountBound({
      idIndex: [
        { id: "temp", idLower: "temp", domain: "sensor" },
        { id: "term", idLower: "term", domain: "sensor" },
        { id: "relay", idLower: "relay", domain: "switch" }
      ]
    });
    await typeAt(wrapper, "return id(te", 12);

    const options = wrapper.findAll(".lambda-field__completion-option");
    expect(options.map((option) => option.text())).toEqual(["tempsensor", "termsensor"]);

    await options[1].trigger("mousedown");
    expect(text.value).toBe("return id(term)");
    expect(wrapper.find(".lambda-field__completion").exists()).toBe(false);
  });

  it("takes the highlighted entry on Enter and closes on Escape", async () => {
    const { wrapper, text } = mountBound({
      idIndex: [
        { id: "temp", idLower: "temp", domain: "sensor" },
        { id: "term", idLower: "term", domain: "sensor" }
      ]
    });
    const textarea = await typeAt(wrapper, "id(", 3);

    await textarea.trigger("keydown", { key: "ArrowDown" });
    await textarea.trigger("keydown", { key: "Enter" });
    expect(text.value).toBe("id(term)");

    await typeAt(wrapper, "id(te", 5);
    expect(wrapper.find(".lambda-field__completion").exists()).toBe(true);
    await textarea.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".lambda-field__completion").exists()).toBe(false);
  });

  it("reuses an existing closing parenthesis", async () => {
    const { wrapper, text } = mountBound({
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }],
      initial: "return id().state;"
    });
    await typeAt(wrapper, "return id(te).state;", 12);
    await wrapper.get(".lambda-field__completion-option").trigger("mousedown");
    expect(text.value).toBe("return id(temp).state;");
  });

  it("stays closed for a finished call and for yaml fields", async () => {
    const idIndex = [{ id: "temp", idLower: "temp", domain: "sensor" }];
    const cpp = mountBound({ idIndex });
    await typeAt(cpp.wrapper, "return id(temp).state;", 22);
    expect(cpp.wrapper.find(".lambda-field__completion").exists()).toBe(false);

    const yaml = mountBound({ idIndex, language: "yaml" });
    await typeAt(yaml.wrapper, "id(te", 5);
    expect(yaml.wrapper.find(".lambda-field__completion").exists()).toBe(false);
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
