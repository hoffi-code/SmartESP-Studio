<template>
  <div class="schema-input-action-row schema-color">
    <button
      type="button"
      class="schema-color__swatch"
      :style="swatchStyle"
      :aria-label="t('modals.colorPicker.title')"
      @click="pickerOpen = true"
    ></button>
    <input
      :id="inputId"
      type="text"
      :value="modelValue"
      :placeholder="field.placeholder || placeholderForFormat"
      @input="onInput"
    />
    <ColorPickerModal
      :open="pickerOpen"
      :selected="hexForModal"
      @close="pickerOpen = false"
      @select="handlePick"
      @clear="handleClear"
    />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ColorPickerModal from "../ColorPickerModal.vue";
import { colorToCss, normalizeHexColor } from "../../utils/displayColor";

const { t } = useI18n();

const props = defineProps({
  modelValue: { type: String, default: "" },
  field: { type: Object, required: true },
  inputId: { type: String, required: true }
});

const emit = defineEmits(["update:model-value"]);

const pickerOpen = ref(false);

// "hex" -> #RRGGBB, "hex0x" -> 0xRRGGBB, "rgb" -> R:G:B. Falls back to keeping a
// 0x prefix the current value already uses so an LVGL round-trip stays stable.
const colorFormat = computed(() => {
  if (props.field.colorFormat) return props.field.colorFormat;
  return /^0x/i.test(String(props.modelValue || "").trim()) ? "hex0x" : "hex";
});

const placeholderForFormat = computed(() =>
  colorFormat.value === "hex0x" ? "0xRRGGBB" : colorFormat.value === "rgb" ? "R:G:B" : "#RRGGBB"
);

const stripPrefix = (value) => String(value || "").trim().replace(/^0x/i, "");

const swatchStyle = computed(() => {
  const css = colorToCss(stripPrefix(props.modelValue), "");
  // no resolvable colour -> let the CSS checkerboard show through
  return css ? { backgroundColor: css, backgroundImage: "none" } : {};
});

const hexForModal = computed(() => normalizeHexColor(stripPrefix(props.modelValue)) || "");

const toFieldFormat = (hex) => {
  const norm = normalizeHexColor(hex); // #RRGGBB or ""
  if (!norm) return "";
  if (colorFormat.value === "hex0x") return `0x${norm.slice(1)}`;
  if (colorFormat.value === "rgb") {
    const n = parseInt(norm.slice(1), 16);
    return `${(n >> 16) & 255}:${(n >> 8) & 255}:${n & 255}`;
  }
  return norm;
};

const onInput = (event) => {
  emit("update:model-value", event.target.value);
};

const handlePick = (hex) => {
  pickerOpen.value = false;
  emit("update:model-value", toFieldFormat(hex));
};

const handleClear = () => {
  pickerOpen.value = false;
  emit("update:model-value", "");
};
</script>

<style scoped>
.schema-color__swatch {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--border);
  cursor: pointer;
  background-color: transparent;
  background-image:
    linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0;
}

.schema-color {
  align-items: center;
}
</style>
