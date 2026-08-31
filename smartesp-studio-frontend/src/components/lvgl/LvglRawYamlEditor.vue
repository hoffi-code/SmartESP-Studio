<template>
  <div class="lvgl-raw-yaml-editor">
    <p class="note">
      {{ node.originalType }} isn't a builder-supported widget. Edit its raw YAML here --
      it's written back verbatim on save. Child widgets stay editable in the tree.
    </p>
    <textarea
      v-model="draft"
      class="lvgl-raw-yaml-editor__area"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      @input="dirty = true"
    ></textarea>
    <div class="lvgl-raw-yaml-editor__bar">
      <button type="button" class="secondary compact" :disabled="!dirty" @click="apply">Apply</button>
      <button type="button" class="secondary compact" :disabled="!dirty" @click="reset">Reset</button>
      <span v-if="error" class="lvgl-raw-yaml-editor__error">{{ error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { dump } from "js-yaml";
import { parseYamlText } from "../../utils/yamlProjectImport";

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(["update"]);

const draft = ref(props.node.rawYaml || "");
const dirty = ref(false);
const error = ref("");

// Re-seed when a different unsupported node gets selected.
watch(
  () => props.node.uiId,
  () => {
    draft.value = props.node.rawYaml || "";
    dirty.value = false;
    error.value = "";
  }
);

const reset = () => {
  draft.value = props.node.rawYaml || "";
  dirty.value = false;
  error.value = "";
};

const apply = () => {
  error.value = "";
  const parsed = parseYamlText(draft.value);
  if (!parsed.ok) {
    error.value = parsed.error?.message || "Invalid YAML.";
    return;
  }
  const doc = parsed.document;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    error.value = "Expected a single widget mapping (e.g. `chart:`).";
    return;
  }
  const keys = Object.keys(doc);
  if (keys.length !== 1) {
    error.value = "Exactly one top-level key expected.";
    return;
  }
  const [type] = keys;
  const value = doc[type] && typeof doc[type] === "object" ? { ...doc[type], widgets: undefined } : {};
  emit("update", {
    ...props.node,
    originalType: type,
    rawYaml: dump({ [type]: value }).trimEnd()
  });
  dirty.value = false;
};
</script>

<style scoped>
.lvgl-raw-yaml-editor__area {
  width: 100%;
  min-height: 160px;
  resize: vertical;
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.5;
  tab-size: 2;
  white-space: pre;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

.lvgl-raw-yaml-editor__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.lvgl-raw-yaml-editor__error {
  color: var(--danger, #c0392b);
  font-size: 12px;
}
</style>
