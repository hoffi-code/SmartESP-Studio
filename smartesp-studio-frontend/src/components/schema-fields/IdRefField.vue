<template>
  <div class="schema-id schema-id-ref">
    <input
      :id="inputId"
      type="text"
      :value="modelValue"
      :placeholder="field.placeholder"
      :class="{ 'field-invalid': idRefError }"
      @focus="onFocus"
      @blur="scheduleClose"
      @input="onInput"
    />
    <span class="schema-id-ref-chevron" aria-hidden="true"></span>
    <button
      v-if="canCreate"
      type="button"
      class="secondary compact schema-id-ref__add"
      :title="t('schema.idRef.create')"
      @click="onCreate"
    >
      +
    </button>
    <div v-if="open && menuOptions.length" class="id-ref-list">
      <button
        v-for="option in menuOptions"
        :key="option"
        type="button"
        class="id-ref-option"
        :class="{ 'id-ref-option--empty': option === ID_REF_EMPTY_OPTION }"
        @mousedown.prevent="selectOption(option)"
      >
        {{ option }}
      </button>
    </div>
    <div v-if="idRefError" class="field-error">{{ idRefError }}</div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from "vue";
import { useI18n } from "vue-i18n";

import {
  ID_REF_EMPTY_OPTION,
  buildIdRefMenuOptions,
  buildIdRefOptions,
  isIdRefEmptyOption
} from "../../utils/schemaIdRefs";

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: String, default: "" },
  inputId: { type: String, required: true },
  idIndex: { type: Array, default: () => [] },
  contextComponentId: { type: String, default: "" },
  contextScopeId: { type: String, default: "" }
});

const emit = defineEmits(["update:model-value"]);

const { t } = useI18n();

// Provided by BuilderView: async (domain, { initialName }) => Promise<newId | null>.
// Absent in isolated specs / non-builder contexts -> no "+" button.
const requestIdDefinition = inject("requestIdDefinition", null);
const canCreate = computed(
  () => Boolean(props.field?.creatable) && typeof requestIdDefinition === "function"
);

// Extra option source for ids that never enter the project idIndex (LVGL built-in
// fonts, group names in use). Provided by LvglBuilder for its subtree only.
const idRefOptionProvider = inject("idRefOptionProvider", null);
const extraOptions = computed(() =>
  typeof idRefOptionProvider === "function" ? idRefOptionProvider(props.field) || [] : []
);

const onCreate = async () => {
  const newId = await requestIdDefinition(props.field?.domain || "", { initialName: props.modelValue || "" });
  if (newId) emit("update:model-value", newId);
};

const open = ref(false);
const query = ref("");

const idOptions = computed(() => {
  const fromIndex = buildIdRefOptions({
    idIndex: props.idIndex,
    domain: props.field?.domain || "",
    contextComponentId: props.contextComponentId,
    contextScopeId: props.contextScopeId,
    allowSelfReference: Boolean(props.field?.allowSelfReference)
  });
  if (!extraOptions.value.length) return fromIndex;
  return [...new Set([...fromIndex, ...extraOptions.value])].sort((a, b) => a.localeCompare(b));
});

const filteredOptions = computed(() => {
  const term = query.value.trim().toLowerCase();
  if (!term) return idOptions.value;
  return idOptions.value.filter((option) => option.toLowerCase().includes(term));
});

const menuOptions = computed(() => buildIdRefMenuOptions(filteredOptions.value));

const idRefError = computed(() => {
  if (props.field?.required !== true) return "";
  if (props.field?.allowFreeText === true) return "";
  if (!idOptions.value.length) return t("schema.idRef.noMatch");
  const value = props.modelValue;
  if (!value || typeof value !== "string") return "";
  const match = idOptions.value.some((option) => option.toLowerCase() === value.toLowerCase());
  return match ? "" : t("schema.idRef.noMatch");
});

const onInput = (event) => {
  const value = event.target.value;
  query.value = value;
  emit("update:model-value", value);
};

const onFocus = () => {
  query.value = props.modelValue || "";
  open.value = true;
};

const scheduleClose = () => {
  window.setTimeout(() => {
    open.value = false;
  }, 150);
};

const selectOption = (value) => {
  if (isIdRefEmptyOption(value)) {
    open.value = false;
    return;
  }
  emit("update:model-value", value);
  query.value = value;
  open.value = false;
};
</script>
