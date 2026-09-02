// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import SchemaField from "./SchemaField.vue";
import { DEFAULT_LOCALE, loadLocale, setLocale } from "../i18n";

const mountField = (field, extra = {}) => mount(SchemaField, { props: { field, value: {}, ...extra } });

beforeAll(async () => {
  await loadLocale("en");
  await loadLocale("de");
});

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("SchemaField labels and hints", () => {
  it("uses a catalog label over an explicit schema label", () => {
    // default_font has a catalog entry -> that wins so the name stays translatable
    const wrapper = mountField({ key: "default_font", type: "text", label: "My Font" });
    expect(wrapper.get("label").text()).toContain("Default font");
  });

  it("uses the catalog label when there is no explicit label", () => {
    const wrapper = mountField({ key: "default_font", type: "text" });
    expect(wrapper.get("label").text()).toContain("Default font");
  });

  it("falls back to field.label when nothing is in the catalog", () => {
    const wrapper = mountField({ key: "some_unmapped_key", type: "text", label: "Curated Name" });
    expect(wrapper.get("label").text()).toContain("Curated Name");
  });

  it("falls back to a humanized key when nothing is translated", () => {
    const wrapper = mountField({ key: "some_unmapped_key", type: "text" });
    expect(wrapper.get("label").text()).toContain("Some unmapped key");
  });

  it("renders a hint toggle only when a hint exists, and shows the catalog text", async () => {
    expect(mountField({ key: "some_unmapped_key", type: "text" }).find(".field-hint__toggle").exists()).toBe(false);

    const wrapper = mountField({ key: "default_font", type: "text" });
    await wrapper.get(".field-hint__toggle").trigger("click");
    expect(wrapper.get(".field-hint__popover").text()).toContain("font: component");
  });

  it("translates label and hint when the locale changes", async () => {
    await setLocale("de");
    const wrapper = mountField({ key: "default_font", type: "text" });
    expect(wrapper.get("label").text()).toContain("Standard-Schrift");
    await wrapper.get(".field-hint__toggle").trigger("click");
    expect(wrapper.get(".field-hint__popover").text()).toContain("font:-Komponente");
  });
});
