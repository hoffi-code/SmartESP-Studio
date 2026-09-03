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

  it("suggests domain members right after id(x). and inserts the pick", async () => {
    const { wrapper, text } = mountBound({
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }],
      initial: "id(temp)."
    });
    await typeAt(wrapper, "id(temp).", "id(temp).".length);

    const options = wrapper.findAll(".lambda-field__completion-option");
    expect(options.map((option) => option.text())).toEqual(["has_state()", "publish_state(x)", "state"]);
    // Member options carry no domain badge -- the domain is already implied by context.
    expect(wrapper.find(".lambda-field__completion-domain").exists()).toBe(false);

    await options[2].trigger("mousedown");
    expect(text.value).toBe("id(temp).state");
    expect(wrapper.find(".lambda-field__completion").exists()).toBe(false);
  });

  it("filters domain members by the typed prefix", async () => {
    const { wrapper } = mountBound({
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }],
      initial: "id(temp).st"
    });
    await typeAt(wrapper, "id(temp).st", "id(temp).st".length);
    const options = wrapper.findAll(".lambda-field__completion-option");
    expect(options.map((option) => option.text())).toEqual(["state"]);
  });

  it("swaps from id-context to member-context cleanly as the call closes", async () => {
    const { wrapper } = mountBound({
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }]
    });
    await typeAt(wrapper, "id(te", 5);
    expect(wrapper.findAll(".lambda-field__completion-option").map((o) => o.text())).toEqual(["tempsensor"]);

    await typeAt(wrapper, "id(temp).", "id(temp).".length);
    expect(wrapper.findAll(".lambda-field__completion-option").map((o) => o.text())).toEqual([
      "has_state()",
      "publish_state(x)",
      "state"
    ]);
  });

  it("offers no member dropdown for an unknown id or an out-of-scope domain", async () => {
    const idIndex = [
      { id: "temp", idLower: "temp", domain: "sensor" },
      { id: "bus1", idLower: "bus1", domain: "i2c" }
    ];
    const unknown = mountBound({ idIndex });
    await typeAt(unknown.wrapper, "id(ghost).", "id(ghost).".length);
    expect(unknown.wrapper.find(".lambda-field__completion").exists()).toBe(false);

    const outOfScope = mountBound({ idIndex });
    await typeAt(outOfScope.wrapper, "id(bus1).", "id(bus1).".length);
    expect(outOfScope.wrapper.find(".lambda-field__completion").exists()).toBe(false);
  });

  it("selects a domain member with Tab and closes it with Escape", async () => {
    const { wrapper, text } = mountBound({
      idIndex: [{ id: "sw", idLower: "sw", domain: "switch" }]
    });
    const textarea = await typeAt(wrapper, "id(sw).", "id(sw).".length);
    // switch members sorted: state, toggle, turn_off, turn_on -- ArrowDown twice lands on turn_off.
    await textarea.trigger("keydown", { key: "ArrowDown" });
    await textarea.trigger("keydown", { key: "ArrowDown" });
    await textarea.trigger("keydown", { key: "Tab" });
    expect(text.value).toBe("id(sw).turn_off()");

    await typeAt(wrapper, "id(sw).t", "id(sw).t".length);
    expect(wrapper.find(".lambda-field__completion").exists()).toBe(true);
    await textarea.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".lambda-field__completion").exists()).toBe(false);
  });

  it("opens the palette and inserts the first legacy snippet at the caret", async () => {
    const { wrapper, text } = mountBound({ initial: "return ;" });
    const textarea = wrapper.get("textarea");
    textarea.element.setSelectionRange(7, 7);

    await wrapper.get(".lambda-field__toolbar button").trigger("click");
    const entries = wrapper.findAll(".lambda-field__snippet");
    expect(entries.length).toBeGreaterThan(3);

    await entries[0].trigger("mousedown");
    expect(text.value).toBe("return id(x).state;");
    expect(wrapper.find(".lambda-field__palette").exists()).toBe(false);
  });

  it("offers no palette on yaml fields", () => {
    const { wrapper } = mountBound({ language: "yaml" });
    expect(wrapper.find(".lambda-field__toolbar").exists()).toBe(false);
  });

  it("shows the palette grouped by category without a suggested section", async () => {
    const { wrapper } = mountBound();
    await wrapper.get(".lambda-field__toolbar button").trigger("click");
    expect(wrapper.findAll(".lambda-field__palette-section-title").map((title) => title.text())).toEqual([
      "Snippets",
      "Logging",
      "Strings",
      "Time",
      "Core"
    ]);
  });

  it("puts a Suggested section with the referenced entity's members first", async () => {
    const { wrapper } = mountBound({
      idIndex: [{ id: "temp", idLower: "temp", domain: "sensor" }]
    });
    const text = "return id(temp).state;";
    await typeAt(wrapper, text, text.length);
    await wrapper.get(".lambda-field__toolbar button").trigger("click");

    const titles = wrapper.findAll(".lambda-field__palette-section-title").map((title) => title.text());
    expect(titles[0]).toBe("Suggested");

    const firstItem = wrapper.findAll(".lambda-field__snippet")[0];
    expect(firstItem.find("code").text()).toBe("state");
    expect(firstItem.find("span").text()).toBe("Current value");
  });

  it("filters the palette to matching items and drops empty sections", async () => {
    const { wrapper } = mountBound();
    await wrapper.get(".lambda-field__toolbar button").trigger("click");
    await wrapper.get(".lambda-field__palette-search").setValue("millis");

    expect(wrapper.findAll(".lambda-field__palette-section-title").map((title) => title.text())).toEqual([
      "Time"
    ]);
    const items = wrapper.findAll(".lambda-field__snippet");
    expect(items).toHaveLength(1);
    expect(items[0].find("code").text()).toBe("millis()");
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
