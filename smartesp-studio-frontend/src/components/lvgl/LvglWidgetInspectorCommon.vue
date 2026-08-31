<template>
  <div class="lvgl-inspector-common">
    <SchemaField
      v-for="field in COMMON_FIELDS"
      :key="field.key"
      :field="field"
      :path="[]"
      :value="common"
      @update="handleFieldUpdate"
    />
  </div>
</template>

<script setup>
import SchemaField from "../SchemaField.vue";

defineProps({
  common: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(["update"]);

// Position/size fields every LVGL widget type shares -- reused unchanged by each future widget
// inspector panel (button/image/...), unlike the type-specific fields below it.
const COMMON_FIELDS = [
  { key: "id", type: "id", required: false, placeholder: "widget_id" },
  { key: "x", type: "text", required: false, placeholder: "0" },
  { key: "y", type: "text", required: false, placeholder: "0" },
  { key: "width", type: "text", required: false, placeholder: "SIZE_CONTENT" },
  { key: "height", type: "text", required: false, placeholder: "SIZE_CONTENT" },
  {
    key: "align",
    type: "select",
    required: false,
    options: ["TOP_LEFT", "TOP_MID", "TOP_RIGHT", "LEFT_MID", "CENTER", "RIGHT_MID", "BOTTOM_LEFT", "BOTTOM_MID", "BOTTOM_RIGHT"]
  }
];

const handleFieldUpdate = ({ path, value }) => {
  const key = path?.[0];
  if (!key) return;
  emit("update", { [key]: value });
};
</script>
