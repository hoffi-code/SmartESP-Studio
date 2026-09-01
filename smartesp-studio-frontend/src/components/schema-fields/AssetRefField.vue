<template>
  <div class="schema-id schema-id-ref schema-asset-ref">
    <input
      :id="inputId"
      type="text"
      :value="modelValue"
      :placeholder="field.placeholder"
      @focus="open = true"
      @blur="scheduleClose"
      @input="onInput"
    />
    <span class="schema-id-ref-chevron" aria-hidden="true"></span>
    <button
      v-if="canManage"
      type="button"
      class="secondary compact schema-asset-ref__manage"
      :title="t('schema.assetRef.manage')"
      @click="openAssetManager()"
    >
      &hellip;
    </button>
    <div v-if="open && options.length" class="id-ref-list">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="id-ref-option"
        @mousedown.prevent="pick(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: "" },
  inputId: { type: String, required: true }
});

const emit = defineEmits(["update:model-value"]);

const { t } = useI18n();

// Provided by BuilderView: (kind) => string[] of uploaded filenames, and a way to
// open the Asset Manager. Absent in isolated specs -> just a plain text input.
const assetRefProvider = inject("assetRefProvider", null);
const openAssetManager = inject("openAssetManager", null);

const assetKind = computed(() => props.field?.assetKind || "images");
const prefix = computed(() =>
  typeof props.field?.assetPathPrefix === "string" ? props.field.assetPathPrefix : ""
);

const open = ref(false);
const query = ref("");

const options = computed(() => {
  if (typeof assetRefProvider !== "function") return [];
  const files = assetRefProvider(assetKind.value) || [];
  const term = query.value.trim().toLowerCase();
  return files
    .filter((file) => !term || String(file).toLowerCase().includes(term))
    .map((file) => ({ label: file, value: `${prefix.value}${file}` }));
});

const canManage = computed(() => typeof openAssetManager === "function");

const onInput = (event) => {
  query.value = event.target.value;
  emit("update:model-value", event.target.value);
};

const scheduleClose = () => {
  window.setTimeout(() => {
    open.value = false;
  }, 150);
};

const pick = (value) => {
  emit("update:model-value", value);
  open.value = false;
};
</script>
