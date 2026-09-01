// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import LocaleSwitcher from "./LocaleSwitcher.vue";
import { DEFAULT_LOCALE, i18n, setLocale } from "../i18n";

const mountSwitcher = () => mount(LocaleSwitcher, { global: { plugins: [i18n] } });

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("LocaleSwitcher", () => {
  it("lists the supported locales and reflects the active one", () => {
    const wrapper = mountSwitcher();
    expect(wrapper.findAll("option").map((o) => o.text())).toEqual(["EN", "DE"]);
    expect(wrapper.get("select").element.value).toBe("en");
  });

  it("switches the locale on change", async () => {
    const wrapper = mountSwitcher();
    await wrapper.get("select").setValue("de");
    expect(i18n.global.locale.value).toBe("de");
  });
});
