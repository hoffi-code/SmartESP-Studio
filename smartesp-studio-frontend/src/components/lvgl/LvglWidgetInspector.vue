<template>
  <div class="lvgl-widget-inspector">
    <div v-if="!node" class="note">Select a widget to edit it.</div>
    <LvglRawYamlEditor
      v-else-if="node.type === 'unsupported'"
      :node="node"
      @update="$emit('update', $event)"
    />
    <LvglWidgetInspectorGeneric
      v-else-if="widgetSchema"
      :node="node"
      :schema="widgetSchema"
      :id-index="idIndex"
      :page-index="pageIndex"
      @update="$emit('update', $event)"
      @field-edit="$emit('field-edit', $event)"
    />
    <div v-else class="note">Loading widget schema...</div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import LvglWidgetInspectorGeneric from "./LvglWidgetInspectorGeneric.vue";
import LvglRawYamlEditor from "./LvglRawYamlEditor.vue";
import { lvglWidgetByType } from "../../utils/lvglWidgets";

const props = defineProps({
  node: {
    type: Object,
    default: null
  },
  // type -> loaded widget schema, from BuilderView's lvglWidgetSchemas.
  widgetSchemas: {
    type: Object,
    default: () => ({})
  },
  idIndex: {
    type: Array,
    default: () => []
  },
  // Index of the page holding this widget -- feeds the yaml-preview scopeId.
  pageIndex: {
    type: Number,
    default: 0
  }
});

defineEmits(["update", "field-edit"]);

const widgetSchema = computed(() => {
  const type = props.node?.type;
  if (!type || !lvglWidgetByType(type)) return null;
  return props.widgetSchemas?.[type] || null;
});
</script>
