<template>
  <div class="lvgl-widget-inspector">
    <div v-if="!node" class="note">{{ t("lvgl.inspector.selectWidget") }}</div>
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
      :expand-groups="expandGroups"
      @update="$emit('update', $event)"
      @field-edit="$emit('field-edit', $event)"
    />
    <div v-else class="note">{{ t("lvgl.inspector.loadingSchema") }}</div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import LvglWidgetInspectorGeneric from "./LvglWidgetInspectorGeneric.vue";
import LvglRawYamlEditor from "./LvglRawYamlEditor.vue";
import { lvglWidgetByType } from "../../utils/lvglWidgets";

const { t } = useI18n();

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
  },
  // Open the Style/Layout/States/Parts/Events sections by default (used in the
  // roomier edit modal).
  expandGroups: {
    type: Boolean,
    default: false
  }
});

defineEmits(["update", "field-edit"]);

const widgetSchema = computed(() => {
  const type = props.node?.type;
  if (!type || !lvglWidgetByType(type)) return null;
  return props.widgetSchemas?.[type] || null;
});
</script>
