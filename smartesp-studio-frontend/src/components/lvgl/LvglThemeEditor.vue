<template>
  <div class="lvgl-theme-editor">
    <p class="note">{{ t("lvgl.theme.intro") }}</p>

    <div class="lvgl-theme-editor__add">
      <select v-model="pendingType" :aria-label="t('lvgl.theme.addType')">
        <option value="">{{ t("lvgl.theme.addType") }}</option>
        <option v-for="type in addableTypes" :key="type" :value="type">{{ type }}</option>
      </select>
      <button type="button" class="secondary compact" :disabled="!pendingType" @click="addType">+</button>
    </div>

    <p v-if="!activeTypes.length" class="note">{{ t("lvgl.theme.empty") }}</p>

    <details
      v-for="type in activeTypes"
      :key="type"
      class="lvgl-theme-editor__type"
      :open="type === lastAdded"
    >
      <summary>
        <span>{{ type }}</span>
        <button type="button" class="secondary compact" @click.stop.prevent="removeType(type)">
          {{ t("lvgl.theme.remove") }}
        </button>
      </summary>
      <SchemaField
        v-for="field in styleFields"
        :key="field.key"
        :field="field"
        :path="['theme', type]"
        :value="modelValue[type] || {}"
        :root-value="modelValue[type] || {}"
        :id-index="idIndex"
        @update="(payload) => emit('update', payload)"
      />
    </details>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import SchemaField from "../SchemaField.vue";
import { LVGL_WIDGET_TYPES } from "../../utils/lvglWidgets";

const props = defineProps({
  // lvgl.options.theme -- widget type -> style props
  modelValue: { type: Object, default: () => ({}) },
  // resolved lvgl_style_props.json fields
  styleFields: { type: Array, default: () => [] },
  idIndex: { type: Array, default: () => [] }
});

const emit = defineEmits(["update"]);

const { t } = useI18n();

const ALL_TYPES = ["obj", ...[...LVGL_WIDGET_TYPES].sort((a, b) => a.localeCompare(b))];

// Types a user opened this session but hasn't set a prop on yet -- setDeep would
// prune an empty `theme.<type>`, so keep them visible locally.
const locallyAdded = ref([]);
const lastAdded = ref("");
const pendingType = ref("");

const activeTypes = computed(() => {
  const present = new Set([...Object.keys(props.modelValue || {}), ...locallyAdded.value]);
  return ALL_TYPES.filter((type) => present.has(type));
});

const addableTypes = computed(() => ALL_TYPES.filter((type) => !activeTypes.value.includes(type)));

const addType = () => {
  const type = pendingType.value;
  if (type && !activeTypes.value.includes(type)) {
    locallyAdded.value.push(type);
    lastAdded.value = type;
  }
  pendingType.value = "";
};

const removeType = (type) => {
  locallyAdded.value = locallyAdded.value.filter((entry) => entry !== type);
  if (props.modelValue && Object.prototype.hasOwnProperty.call(props.modelValue, type)) {
    emit("update", { path: ["theme", type], value: undefined });
  }
};
</script>

<style scoped>
.lvgl-theme-editor__add {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}

.lvgl-theme-editor__add select {
  width: auto;
  flex: 1;
}

.lvgl-theme-editor__type {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
}

.lvgl-theme-editor__type > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  cursor: pointer;
}
</style>
