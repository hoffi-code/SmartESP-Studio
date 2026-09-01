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
      @add-group="$emit('add-group', $event)"
    />

    <template v-if="node.tabs || node.tiles">
      <template v-for="(group, gi) in node.tabs || node.tiles" :key="group.uiId || gi">
        <button
          type="button"
          class="lvgl-tree-node__group"
          :class="{ active: group.uiId === selectedId }"
          :style="{ paddingLeft: `${8 + (depth + 1) * 16}px` }"
          @click="$emit('select', group.uiId)"
        >
          {{ node.tabs ? t("lvgl.tree.tab") : t("lvgl.tree.tile") }} · {{ group.name || group.id || gi }}
        </button>
        <LvglWidgetTreeItem
          v-for="child in group.widgets || []"
          :key="child.uiId"
          :node="child"
          :depth="depth + 2"
          :selected-id="selectedId"
          @select="$emit('select', $event)"
          @add-group="$emit('add-group', $event)"
        />
      </template>
      <button
        type="button"
        class="lvgl-tree-node__add-group"
        :style="{ paddingLeft: `${8 + (depth + 1) * 16}px` }"
        @click="$emit('add-group', node.uiId)"
      >
        {{ node.tabs ? t("lvgl.tree.addTab") : t("lvgl.tree.addTile") }}
      </button>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

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

defineEmits(["select", "add-group"]);
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

.lvgl-tree-node__group {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--navy);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
  padding: 3px 8px;
  cursor: pointer;
  border-radius: 6px;
}

.lvgl-tree-node__group:hover {
  background: var(--border);
}

.lvgl-tree-node__group.active {
  background: var(--accent);
  color: #fff;
  opacity: 1;
}

.lvgl-tree-node__add-group {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 10px;
  padding: 2px 8px;
  cursor: pointer;
}

.lvgl-tree-node__add-group:hover {
  text-decoration: underline;
}
</style>
