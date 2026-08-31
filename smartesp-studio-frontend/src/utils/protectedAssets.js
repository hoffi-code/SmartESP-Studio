// The Material Design Icons webfont ships with the app and is referenced verbatim
// by the generated display YAML. The backend refuses to rename/delete it and
// flags it as `protected` in the asset manifest; keep a filename fallback for
// manifests produced before that flag existed.
export const PROTECTED_ASSET_FILES = new Set(["materialdesignicons-webfont.ttf"]);

export function isProtectedAsset(item) {
  if (item && item.protected === true) return true;
  const file = String(item?.file || "")
    .trim()
    .toLowerCase();
  return PROTECTED_ASSET_FILES.has(file);
}
