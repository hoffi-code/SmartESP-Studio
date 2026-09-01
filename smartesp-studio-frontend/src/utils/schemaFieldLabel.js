// Fallback label for a schema field when no explicit `field.label` and no
// `schema.<id>.<path>.label` i18n entry exists. Turns a snake/kebab key into prose:
//   "default_font"  -> "Default font"
//   "cs_pin"        -> "CS pin"
//   "rgb_order"     -> "RGB order"
// No translation happens here -- the i18n layer calls this as the `t(key, <fallback>)`
// default so an untranslated field still reads well.

const ACRONYMS = new Set([
  "id", "rgb", "gpio", "pwm", "spi", "i2c", "i2s", "mqtt", "led", "ir", "uart",
  "dns", "ntp", "tx", "rx", "url", "ha", "lvgl", "ble", "ota", "cpu", "ssid",
  "ip", "mac", "adc", "dac", "usb", "sd", "rtc", "api", "utc", "hz", "khz", "mhz",
  "css", "html", "json", "yaml", "svg", "png", "cs", "dc", "qr"
]);

// Flat i18n namespace for schema field labels/hints, keyed by the field key alone
// (no per-schema qualifier -- SchemaField never gets the resolved schema id). A `label`
// or `hint` set directly in the schema JSON still wins over the catalog.
export const fieldLabelI18nKey = (key) => `schema.fields.${String(key || "")}.label`;
export const fieldHintI18nKey = (key) => `schema.fields.${String(key || "")}.hint`;

export const humanizeFieldKey = (key) => {
  const raw = String(key || "").trim();
  if (!raw) return "";
  const words = raw.split(/[_\-\s]+/).filter(Boolean);
  if (!words.length) return "";
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return word.toUpperCase();
      if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(" ");
};
