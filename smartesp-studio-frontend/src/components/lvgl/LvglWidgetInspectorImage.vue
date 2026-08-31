<template>
  <div class="lvgl-widget-inspector-panel">
    <LvglWidgetInspectorCommon :common="node.common || {}" @update="handleCommonUpdate" />
    <SchemaField
      v-for="field in IMAGE_FIELDS"
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

const IMAGE_FIELDS = [
  { key: "src", label: "Image", type: "id_ref", required: false, domain: "image", placeholder: "image_id" },
  { key: "image_recolor", label: "Recolor", type: "text", required: false, placeholder: "0xFFFFFF" },
  { key: "image_recolor_opa", label: "Recolor opacity", type: "text", required: false, placeholder: "100%" }
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
