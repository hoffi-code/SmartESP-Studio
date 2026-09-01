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
import { computed, ref } from "vue";
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

const open = ref(false);
const query = ref("");

const idOptions = computed(() =>
  buildIdRefOptions({
    idIndex: props.idIndex,
    domain: props.field?.domain || "",
    contextComponentId: props.contextComponentId,
    contextScopeId: props.contextScopeId,
    allowSelfReference: Boolean(props.field?.allowSelfReference)
  })
);

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
