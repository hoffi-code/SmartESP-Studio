import { createI18n } from "vue-i18n";

import en from "./locales/en";

// `en` core catalogs are bundled; the large `schema` catalog and the whole `de`
// locale are code-split and fetched on demand.
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "de"];
const STORAGE_KEY = "ses.locale";

const readStoredLocale = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {
    // localStorage blocked (private window / disabled) -- fall through to default
  }
  return DEFAULT_LOCALE;
};

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  // Untranslated keys fall back to `en`; a bare key is never shown because every
  // string has an `en` entry (the `schema` catalog also has a runtime humanize fallback).
  missingWarn: false,
  fallbackWarn: false,
  messages: { en }
});

const coreLoaded = new Set(["en"]);
const schemaLoaded = new Set();

const loadCore = async (locale) => {
  if (coreLoaded.has(locale)) return;
  const mod = locale === "de" ? await import("./locales/de/index.js") : null;
  if (mod) i18n.global.mergeLocaleMessage(locale, mod.default);
  coreLoaded.add(locale);
};

const loadSchema = async (locale) => {
  if (schemaLoaded.has(locale)) return;
  const mod = locale === "de"
    ? await import("./locales/de/schema.json")
    : await import("./locales/en/schema.json");
  i18n.global.mergeLocaleMessage(locale, { schema: mod.default });
  schemaLoaded.add(locale);
};

export const loadLocale = async (locale) => {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  await Promise.all([loadCore(locale), loadSchema(locale)]);
};

export const setLocale = async (locale) => {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === i18n.global.locale.value) return;
  await loadLocale(locale);
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // persistence is best-effort; the in-memory switch still applies
  }
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", locale);
  }
};

export const currentLocale = () => i18n.global.locale.value;

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("lang", i18n.global.locale.value);
}

// Pull the `en` field-hint/label catalog in the background (the UI works without it
// thanks to the humanize fallback), then apply any stored non-default locale.
loadSchema("en").catch(() => {});
const startupLocale = readStoredLocale();
if (startupLocale !== DEFAULT_LOCALE) {
  setLocale(startupLocale).catch(() => {});
}
