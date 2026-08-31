<template>
  <div class="lvgl-widget-inspector-panel">
    <LvglWidgetInspectorCommon :common="node.common || {}" @update="handleCommonUpdate" />
    <SchemaField
      v-for="field in typeSpecificFields"
      :key="field.key"
      :field="field"
      :path="[]"
      :value="node.props || {}"
      :root-value="node.props || {}"
      :id-index="idIndex"
      @update="handlePropsUpdate"
    />
    <p v-if="!typeSpecificFields.length" class="note">No type-specific settings for this widget.</p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import SchemaField from "../SchemaField.vue";
import LvglWidgetInspectorCommon from "./LvglWidgetInspectorCommon.vue";
import { COMMON_FIELD_KEYS } from "../../utils/lvglWidgets";

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  // Loaded (extends-resolved) widget schema for node.type.
  schema: {
    type: Object,
    default: null
  },
  // Project id index so id_ref fields (image src, ...) get options.
  idIndex: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["update"]);

// The Common panel owns id/x/y/width/height/align; everything else in the schema
// is rendered here against node.props.
const typeSpecificFields = computed(() =>
  (props.schema?.fields || []).filter((field) => field?.key && !COMMON_FIELD_KEYS.has(field.key))
);

const handleCommonUpdate = (patch) => {
  emit("update", { ...props.node, common: { ...(props.node.common || {}), ...patch } });
};

const handlePropsUpdate = ({ path, value }) => {
  const key = path?.[0];
  if (!key) return;
  emit("update", { ...props.node, props: { ...(props.node.props || {}), [key]: value } });
};
</script>
