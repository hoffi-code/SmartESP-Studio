<template>
  <div v-if="kind" class="design-preview" :class="`design-preview--${kind}`">
    <img v-if="kind === 'image' && imageUrl" :src="imageUrl" alt="" class="design-preview__img" />
    <p v-else-if="kind === 'image'" class="design-preview__hint">{{ t("builder.preview.imageNone") }}</p>

    <template v-else-if="kind === 'font'">
      <p v-if="fontFamily" class="design-preview__sample" :style="{ fontFamily: sampleFontStack }">
        {{ t("builder.preview.fontSample") }}
      </p>
      <p v-else class="design-preview__hint">{{ fontHint }}</p>
    </template>

    <template v-else-if="kind === 'color'">
      <span v-if="colorCss" class="design-preview__color" :style="{ background: colorCss }"></span>
      <p v-else class="design-preview__hint">{{ t("builder.preview.colorNone") }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  // "image" | "font" -- derived from schema.domain by the caller
  domain: { type: String, default: "" },
  config: { type: Object, default: () => ({}) },
  assetsBase: { type: String, default: "" }
});

const { t } = useI18n();

const kind = computed(() =>
  ["image", "font", "color"].includes(props.domain) ? props.domain : ""
);

// --- color ---
const clamp255 = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
const colorCss = computed(() => {
  const cfg = props.config || {};
  const hex = String(cfg.hex || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  const rgbInts = ["red_int", "green_int", "blue_int"].map((k) => cfg[k]);
  if (rgbInts.some((v) => v !== undefined && v !== null && v !== "")) {
    return `rgb(${rgbInts.map(clamp255).join(", ")})`;
  }
  return "";
});

// --- image ---
const imageUrl = computed(() => {
  const file = String(props.config?.file || "").trim();
  if (!file) return "";
  if (file.startsWith("mdi:")) {
    return `https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${file.slice(4)}.svg`;
  }
  if (/^https?:\/\//.test(file)) return file;
  if (/[\\/]/.test(file)) return ""; // arbitrary build-host path, not resolvable in the browser
  return `${props.assetsBase}images/${encodeURIComponent(file)}`;
});

// --- font ---
const fileType = computed(() => String(props.config?.file?.type || "").trim());
const fontFamily = computed(() => {
  if (fileType.value === "gfonts") return String(props.config?.file?.family || "").trim();
  return "";
});
const sampleFontStack = computed(() => `"${fontFamily.value}", system-ui, sans-serif`);
const fontHint = computed(() =>
  fileType.value === "local" || fileType.value === "web"
    ? t("builder.preview.fontUnrenderable")
    : t("builder.preview.fontNone")
);

// Load the Google font stylesheet so the sample renders in the real face.
let linkEl = null;
const syncGoogleFont = (family) => {
  if (linkEl) {
    linkEl.remove();
    linkEl = null;
  }
  if (!family || typeof document === "undefined") return;
  linkEl = document.createElement("link");
  linkEl.rel = "stylesheet";
  linkEl.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  document.head.appendChild(linkEl);
};

watch(fontFamily, (family) => syncGoogleFont(family), { immediate: true });
onBeforeUnmount(() => {
  if (linkEl) linkEl.remove();
});
</script>

<style scoped>
.design-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  padding: 8px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: #f8fafc;
}

.design-preview__img {
  max-width: 100%;
  max-height: 120px;
  image-rendering: pixelated;
}

.design-preview__sample {
  margin: 0;
  font-size: 20px;
  color: var(--navy);
}

.design-preview__hint {
  margin: 0;
  color: var(--muted, #64748b);
  font-size: 12px;
}

.design-preview__color {
  width: 96px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
</style>
