// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import FieldHint from "./FieldHint.vue";

describe("FieldHint", () => {
  it("hides the popover until the toggle is clicked", async () => {
    const wrapper = mount(FieldHint, { props: { text: "A short explanation." } });
    expect(wrapper.find(".field-hint__popover").exists()).toBe(false);

    await wrapper.get(".field-hint__toggle").trigger("click");
    expect(wrapper.get(".field-hint__popover").text()).toBe("A short explanation.");
    expect(wrapper.get(".field-hint__toggle").attributes("aria-expanded")).toBe("true");
  });

  it("closes again on a second click and on Escape", async () => {
    const wrapper = mount(FieldHint, { props: { text: "x" }, attachTo: document.body });
    const toggle = wrapper.get(".field-hint__toggle");

    await toggle.trigger("click");
    await toggle.trigger("click");
    expect(wrapper.find(".field-hint__popover").exists()).toBe(false);

    await toggle.trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".field-hint__popover").exists()).toBe(false);
    wrapper.unmount();
  });

  it("closes on an outside click", async () => {
    const wrapper = mount(FieldHint, { props: { text: "x" }, attachTo: document.body });
    await wrapper.get(".field-hint__toggle").trigger("click");
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".field-hint__popover").exists()).toBe(false);
    wrapper.unmount();
  });
});
