import { createI18n } from "vue-i18n";

import en from "./locales/en";
import de from "./locales/de";

// `en` is the source of truth and the fallback; every other locale only overrides.
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "de"];
const STORAGE_KEY = "ses.locale";

const messages = { en, de };

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
  locale: readStoredLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  // Untranslated keys fall back to `en` silently; a bare key is never shown to the user
  // because every string has an `en` entry.
  missingWarn: false,
  fallbackWarn: false,
  messages
});

if (typeof document !== "undefined") {
  document.documentElement.setAttribute("lang", i18n.global.locale.value);
}

export const setLocale = (locale) => {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === i18n.global.locale.value) return;
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
