<template>
  <div class="lvgl-widget-inspector">
    <LvglWidgetInspectorLabel v-if="node && node.type === 'label'" :node="node" @update="$emit('update', $event)" />
    <LvglWidgetInspectorButton v-else-if="node && node.type === 'button'" :node="node" @update="$emit('update', $event)" />
    <LvglWidgetInspectorImage v-else-if="node && node.type === 'image'" :node="node" @update="$emit('update', $event)" />
    <div v-else-if="node && node.type === 'unsupported'" class="note">
      {{ node.originalType }} widgets aren't editable yet -- kept as raw YAML on save.
    </div>
    <div v-else class="note">Select a widget to edit it.</div>
  </div>
</template>

<script setup>
import LvglWidgetInspectorLabel from "./LvglWidgetInspectorLabel.vue";
import LvglWidgetInspectorButton from "./LvglWidgetInspectorButton.vue";
import LvglWidgetInspectorImage from "./LvglWidgetInspectorImage.vue";

defineProps({
  node: {
    type: Object,
    default: null
  }
});

defineEmits(["update"]);
</script>
