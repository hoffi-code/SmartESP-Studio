import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, currentLocale, i18n, loadLocale, setLocale } from "./index";

const t = (key, params) => i18n.global.t(key, params || {});

afterEach(() => setLocale(DEFAULT_LOCALE));

describe("i18n setup", () => {
  it("starts on the default locale with en as fallback", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toContain("de");
    expect(currentLocale()).toBe("en");
    expect(i18n.global.fallbackLocale.value).toBe("en");
  });

  it("resolves common strings per locale (de core loaded lazily)", async () => {
    expect(t("common.save")).toBe("Save");
    await setLocale("de");
    expect(currentLocale()).toBe("de");
    expect(t("common.save")).toBe("Speichern");
  });

  it("ignores an unsupported locale", async () => {
    await setLocale("fr");
    expect(currentLocale()).toBe("en");
  });

  it("falls back to en for a key missing in de", async () => {
    await setLocale("de");
    expect(t("builder.comment.buttonAdd")).toBe("Kommentar");
    expect(t("builder.nope.missing")).toBe("builder.nope.missing");
  });

  it("interpolates named params", () => {
    expect(t("builder.comment.componentTitle", { domain: "spi" })).toContain("spi");
    expect(t("builder.comment.hint", { hash: "#" })).toContain("#");
  });

  it("loadLocale pulls the schema catalog for a locale", async () => {
    await loadLocale("de");
    await setLocale("de");
    expect(t("schema.fields.default_font.label")).toBe("Standard-Schrift");
  });
});
