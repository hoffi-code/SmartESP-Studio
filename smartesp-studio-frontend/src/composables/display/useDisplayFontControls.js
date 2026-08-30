import { computed } from "vue";
import { deriveGoogleFontStyle } from "../../utils/displayFonts";

const PROTECTED_LOCAL_FONT_FILE = "materialdesignicons-webfont.ttf";

// Shared font-source/-variant handling for text elements and graph-legend name/value fonts.
// `prefix` namespaces the patch field names: "" -> fontSource/fontFamily/..., "legendName" ->
// legendNameFontSource/legendNameFontFamily/..., "legendValue" -> legendValueFontSource/...
export function useDisplayFontControls({ localFonts, googleFonts, assetsBase }) {
  const visibleLocalFonts = computed(() =>
    (localFonts.value || []).filter(
      (font) => String(font?.file || "").trim().toLowerCase() !== PROTECTED_LOCAL_FONT_FILE
    )
  );

  const findVisibleLocalFont = (file) => visibleLocalFonts.value.find((item) => item.file === file);
  const firstVisibleLocalFont = () => visibleLocalFonts.value[0];

  const formatFileOptionLabel = (value, maxLength = 28) => {
    const text = String(value || "");
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  };

  const deriveLocalStyle = (label, fileName) => {
    const value = `${label || ""} ${fileName || ""}`.toLowerCase();
    const style = value.includes("italic") ? "italic" : "normal";
    let weight = 400;
    if (value.includes("thin")) weight = 100;
    else if (value.includes("extralight") || value.includes("extra light")) weight = 200;
    else if (value.includes("light")) weight = 300;
    else if (value.includes("medium")) weight = 500;
    else if (value.includes("semibold") || value.includes("semi bold")) weight = 600;
    else if (value.includes("bold")) weight = 700;
    else if (value.includes("extrabold") || value.includes("extra bold")) weight = 800;
    else if (value.includes("black")) weight = 900;
    return { weight, style };
  };

  const fieldKey = (prefix, suffix) => (prefix ? `${prefix}Font${suffix}` : `font${suffix}`);

  const buildLocalFontPatch = (prefix, font) => {
    const styleInfo = deriveLocalStyle(font?.label, font?.file);
    return {
      [fieldKey(prefix, "Source")]: "local",
      [fieldKey(prefix, "Family")]: font?.label || "",
      [fieldKey(prefix, "File")]: font?.file || "",
      [fieldKey(prefix, "Variant")]: "regular",
      [fieldKey(prefix, "Url")]: font?.file ? `${assetsBase.value}fonts/${font.file}` : "",
      [fieldKey(prefix, "Weight")]: styleInfo.weight,
      [fieldKey(prefix, "Style")]: styleInfo.style
    };
  };

  const buildGoogleFamilyPatch = (prefix, family, variantOverride) => {
    const variant = variantOverride || (family?.variants?.includes("regular") ? "regular" : family?.variants?.[0]);
    const url = family?.files?.[variant] || "";
    const { weight, style } = deriveGoogleFontStyle(variant);
    return {
      [fieldKey(prefix, "Source")]: "google",
      [fieldKey(prefix, "Family")]: family?.family || "",
      [fieldKey(prefix, "Variant")]: variant || "regular",
      [fieldKey(prefix, "File")]: "",
      [fieldKey(prefix, "Url")]: url,
      [fieldKey(prefix, "Weight")]: weight,
      [fieldKey(prefix, "Style")]: style
    };
  };

  const buildGoogleVariantPatch = (prefix, family, variant) => {
    const url = family?.files?.[variant] || "";
    const { weight, style } = deriveGoogleFontStyle(variant);
    return {
      [fieldKey(prefix, "Source")]: "google",
      [fieldKey(prefix, "Variant")]: variant,
      [fieldKey(prefix, "Url")]: url,
      [fieldKey(prefix, "Weight")]: weight,
      [fieldKey(prefix, "Style")]: style
    };
  };

  const buildFontSourcePatch = (prefix, source) => {
    if (source === "google") {
      return buildGoogleFamilyPatch(prefix, googleFonts.value[0]);
    }
    return buildLocalFontPatch(prefix, firstVisibleLocalFont());
  };

  const buildDefaultFontDescriptor = (size) => {
    const local = firstVisibleLocalFont();
    if (local) {
      const styleInfo = deriveLocalStyle(local?.label, local?.file);
      return {
        source: "local",
        family: local?.label || "",
        file: local?.file || "",
        variant: "regular",
        url: local?.file ? `${assetsBase.value}fonts/${local.file}` : "",
        weight: styleInfo.weight,
        style: styleInfo.style,
        size
      };
    }
    const google = googleFonts.value[0];
    if (google) {
      const variant = google.variants?.includes("regular") ? "regular" : google.variants?.[0];
      const url = google.files?.[variant] || "";
      const { weight, style } = deriveGoogleFontStyle(variant);
      return { source: "google", family: google.family, file: "", variant: variant || "regular", url, weight, style, size };
    }
    return null;
  };

  return {
    visibleLocalFonts,
    findVisibleLocalFont,
    firstVisibleLocalFont,
    formatFileOptionLabel,
    deriveLocalStyle,
    buildFontSourcePatch,
    buildLocalFontPatch,
    buildGoogleFamilyPatch,
    buildGoogleVariantPatch,
    buildDefaultFontDescriptor
  };
}
