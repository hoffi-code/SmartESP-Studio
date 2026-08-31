<template>
  <div class="lvgl-widget-inspector-panel">
    <LvglWidgetInspectorCommon :common="node.common || {}" @update="handleCommonUpdate" />
    <SchemaField
      v-for="field in BUTTON_FIELDS"
      :key="field.key"
      :field="field"
      :path="[]"
      :value="node.props || {}"
      @update="handlePropsUpdate"
    />
  </div>
</template>

<script setup>
import SchemaField from "../SchemaField.vue";
import LvglWidgetInspectorCommon from "./LvglWidgetInspectorCommon.vue";

const props = defineProps({
  node: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(["update"]);

const BUTTON_FIELDS = [
  { key: "text", type: "text", required: false, placeholder: "Button text" },
  { key: "checkable", type: "boolean", required: false },
  { key: "bg_color", type: "text", required: false, placeholder: "0x000000" },
  {
    key: "on_click",
    label: "On click",
    type: "list",
    required: false,
    item: { type: "object", fields: [], extends: "base_actions.json" }
  }
];

const handleCommonUpdate = (patch) => {
  emit("update", { ...props.node, common: { ...(props.node.common || {}), ...patch } });
};

const handlePropsUpdate = ({ path, value }) => {
  const key = path?.[0];
  if (!key) return;
  emit("update", { ...props.node, props: { ...(props.node.props || {}), [key]: value } });
};
</script>
