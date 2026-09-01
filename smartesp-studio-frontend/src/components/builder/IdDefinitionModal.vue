<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal-card id-def-card" role="dialog" aria-modal="true">
      <h3>{{ title }}</h3>
      <DesignElementPreview
        v-if="previewDomain"
        :domain="previewDomain"
        :config="draft"
        :assets-base="assetsBase"
      />
      <div class="id-def-body">
        <SchemaRenderer
          :key="componentId"
          :component-id="componentId"
          :schema-path="schemaPath"
          :component-config="draft"
          :field-errors="{}"
          :custom-config="''"
          mode-level="Advanced"
          :id-registry="idRegistry"
          :name-registry="nameRegistry"
          :id-index="idIndex"
          :gpio-options="gpioOptions"
          :gpio-usage="gpioUsage"
          :gpio-title="gpioTitle"
          :context-component-id="componentId"
          :context-scope-id="'id-definition'"
          :global-store="globalStore"
          :display-images="displayImages"
          :display-fonts="displayFonts"
          :display-google-fonts="displayGoogleFonts"
          :assets-base="assetsBase"
          @update="applyUpdate"
          @open-asset-manager="emit('open-asset-manager')"
        />
      </div>
      <div class="modal-actions">
        <button class="secondary" type="button" @click="emit('cancel')">{{ t("common.cancel") }}</button>
        <button type="button" :disabled="!canSave" @click="emit('confirm', draft)">{{ t("common.save") }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import SchemaRenderer from "../SchemaRenderer.vue";
import DesignElementPreview from "./DesignElementPreview.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  componentId: { type: String, default: "" },
  schemaPath: { type: String, default: "" },
  initialId: { type: String, default: "" },
  existingIds: { type: Array, default: () => [] },
  idRegistry: { type: Object, default: () => ({}) },
  nameRegistry: { type: Object, default: () => ({}) },
  idIndex: { type: Array, default: () => [] },
  gpioOptions: { type: Array, default: () => [] },
  gpioUsage: { type: Object, default: () => ({}) },
  gpioTitle: { type: String, default: "" },
  globalStore: { type: Object, default: () => ({}) },
  displayImages: { type: Array, default: () => [] },
  displayFonts: { type: Array, default: () => [] },
  displayGoogleFonts: { type: Array, default: () => [] },
  assetsBase: { type: String, default: "" }
});

const emit = defineEmits(["confirm", "cancel", "open-asset-manager"]);

const { t } = useI18n();

const draft = ref({});

const PREVIEW_DOMAINS = { "image/file": "image", "font/font": "font", "color/color": "color" };
const previewDomain = computed(() => PREVIEW_DOMAINS[props.componentId] || "");

const applyUpdate = ({ path, value }) => {
  if (!Array.isArray(path) || !path.length) return;
  let target = draft.value;
  path.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  });
  target[path[path.length - 1]] = value;
};

const idIsSlug = computed(() => /^[a-z_][a-z0-9_]*$/.test(String(draft.value.id || "")));
const idIsFree = computed(() => {
  const id = String(draft.value.id || "").toLowerCase();
  return !props.existingIds.some((existing) => String(existing).toLowerCase() === id);
});
const canSave = computed(() => Boolean(draft.value.id) && idIsSlug.value && idIsFree.value);

watch(
  () => props.open,
  (open) => {
    if (open) draft.value = props.initialId ? { id: props.initialId } : {};
  },
  { immediate: true }
);
</script>

<style scoped>
.id-def-card {
  width: min(560px, 94vw);
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

.id-def-body {
  overflow: auto;
  margin: 4px 0 12px;
}
</style>
