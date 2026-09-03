<template>
  <div class="schema-variable-map">
    <p v-if="!modelValue.length" class="note">{{ t("schema.variableMap.empty") }}</p>
    <div v-for="(entry, index) in modelValue" :key="index" class="schema-variable-map__row">
      <input
        :id="index === 0 ? inputId : undefined"
        type="text"
        :value="entry.name"
        :placeholder="t('schema.variableMap.namePlaceholder')"
        :aria-label="t('schema.variableMap.nameLabel')"
        @input="updateRow(index, { name: $event.target.value })"
      />
      <select
        :value="entry.type"
        :aria-label="t('schema.variableMap.typeLabel')"
        @change="updateRow(index, { type: $event.target.value })"
      >
        <option v-for="option in VARIABLE_TYPES" :key="option" :value="option">{{ option }}</option>
      </select>
      <button type="button" class="secondary compact" @click="removeRow(index)">
        {{ t("common.delete") }}
      </button>
    </div>
    <button type="button" class="secondary compact btn-standard" @click="addRow">
      {{ t("schema.variableMap.add") }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// ESPHome-Enum aus api.ACTIONS_SCHEMA.variables -- feste Liste, kein freier Text.
const VARIABLE_TYPES = ["bool", "int", "float", "string", "bool[]", "int[]", "float[]", "string[]"];

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  inputId: { type: String, default: "" }
});

const emit = defineEmits(["update:model-value"]);

const updateRow = (index, patch) => {
  const next = props.modelValue.map((entry, entryIndex) =>
    entryIndex === index ? { ...entry, ...patch } : entry
  );
  emit("update:model-value", next);
};

const removeRow = (index) => {
  emit(
    "update:model-value",
    props.modelValue.filter((_, entryIndex) => entryIndex !== index)
  );
};

const addRow = () => {
  emit("update:model-value", [...props.modelValue, { name: "", type: VARIABLE_TYPES[0] }]);
};
</script>

<style scoped>
.schema-variable-map {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schema-variable-map__row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 6px;
  align-items: center;
}
</style>
