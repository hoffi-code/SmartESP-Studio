<template>
  <div class="lvgl-widget-inspector-panel">
    <LvglWidgetInspectorCommon :common="node.common || {}" @update="handleCommonUpdate" />
    <SchemaField
      v-for="field in LABEL_FIELDS"
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

const LABEL_FIELDS = [
  { key: "text", type: "text", required: false, placeholder: "Label text" },
  { key: "text_color", type: "text", required: false, placeholder: "0xFFFFFF" },
  { key: "bg_color", type: "text", required: false, placeholder: "0x000000" }
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
