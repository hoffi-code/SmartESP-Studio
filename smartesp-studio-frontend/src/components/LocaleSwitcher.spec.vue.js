// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import { flushPromises } from "@vue/test-utils";

import LocaleSwitcher from "./LocaleSwitcher.vue";
import { DEFAULT_LOCALE, i18n, setLocale } from "../i18n";

const mountSwitcher = () => mount(LocaleSwitcher);

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("LocaleSwitcher", () => {
  it("lists the supported locales and reflects the active one", () => {
    const wrapper = mountSwitcher();
    expect(wrapper.findAll("option").map((o) => o.text())).toEqual(["EN", "DE"]);
    expect(wrapper.get("select").element.value).toBe("en");
  });

  it("switches the locale on change (loading the de catalog first)", async () => {
    const wrapper = mountSwitcher();
    wrapper.get("select").element.value = "de";
    await wrapper.get("select").trigger("change");
    // the handler kicks off an async locale load; await it and let the component re-render
    await setLocale("de");
    await flushPromises();
    expect(i18n.global.locale.value).toBe("de");
    expect(wrapper.get("select").element.value).toBe("de");
  });
});
