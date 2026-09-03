// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import TogglePill from "./TogglePill.vue";

describe("TogglePill", () => {
  it("zeigt AUS/EIN passend zum modelValue", () => {
    const off = mount(TogglePill, { props: { modelValue: false } });
    expect(off.text()).toContain("OFF");
    const on = mount(TogglePill, { props: { modelValue: true } });
    expect(on.text()).toContain("ON");
  });

  it("emittiert den invertierten Wert bei Klick", async () => {
    const wrapper = mount(TogglePill, { props: { modelValue: false } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
  });
});
