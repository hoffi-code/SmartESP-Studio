<template>
  <div class="lvgl-tree-node">
    <button
      type="button"
      class="lvgl-tree-node__button"
      :class="{ active: node.uiId === selectedId }"
      :style="{ paddingLeft: `${8 + depth * 16}px` }"
      @click="$emit('select', node.uiId)"
    >
      <span class="lvgl-tree-node__type">{{ node.type }}</span>
      <span v-if="node.common?.id" class="lvgl-tree-node__id">{{ node.common.id }}</span>
      <span v-else-if="node.type === 'unsupported'" class="lvgl-tree-node__id">{{ node.originalType }}</span>
    </button>
    <LvglWidgetTreeItem
      v-for="child in node.children || []"
      :key="child.uiId"
      :node="child"
      :depth="depth + 1"
      :selected-id="selectedId"
      @select="$emit('select', $event)"
    />
  </div>
</template>

<script setup>
defineProps({
  node: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  selectedId: {
    type: String,
    default: ""
  }
});

defineEmits(["select"]);
</script>

<style scoped>
.lvgl-tree-node__button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--navy);
  font-weight: 500;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.lvgl-tree-node__button:hover {
  background: var(--border);
}

.lvgl-tree-node__button.active {
  background: var(--accent);
  color: #fff;
}

.lvgl-tree-node__type {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 11px;
}

.lvgl-tree-node__id {
  font-size: 12px;
  opacity: 0.8;
}
</style>
