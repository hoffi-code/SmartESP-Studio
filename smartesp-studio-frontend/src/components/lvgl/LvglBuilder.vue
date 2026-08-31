<template>
  <section class="lvgl-builder">
    <div class="lvgl-builder__trigger">
      <button type="button" class="secondary" @click="openModal">LVGL configurator</button>
      <span v-if="lvglConfig" class="note">{{ pageCount }} page(s), {{ widgetCount }} top-level widget(s)</span>
    </div>

    <div v-if="isOpen" class="lvgl-config-backdrop" @click.self="isOpen = false">
      <div class="lvgl-config-card" role="dialog" aria-modal="true">
        <header class="lvgl-config-header">
          <h3>LVGL configurator</h3>
        </header>

        <div class="lvgl-config-body">
          <section class="lvgl-config-panel">
            <div class="lvgl-config-panel__header">
              <h4>Pages</h4>
              <button type="button" class="secondary compact" @click="addPage">Add page</button>
            </div>
            <div class="lvgl-page-list">
              <button
                v-for="(page, index) in pages"
                :key="`${page.id || 'page'}-${index}`"
                type="button"
                class="lvgl-page-item"
                :class="{ active: index === activePageIndex }"
                @click="selectPage(index)"
              >
                {{ page.id || `page_${index}` }}
              </button>
              <div v-if="!pages.length" class="note">No pages yet.</div>
            </div>
            <button
              v-if="activePageIndex >= 0 && pages.length"
              type="button"
              class="secondary compact"
              @click="removeActivePage"
            >
              Remove page
            </button>
          </section>

          <section class="lvgl-config-panel">
            <div class="lvgl-config-panel__header">
              <h4>Widgets</h4>
              <div class="lvgl-config-panel__actions">
                <button type="button" class="secondary compact" :disabled="activePageIndex < 0" @click="addWidget('label')">
                  Add label
                </button>
              </div>
            </div>
            <div class="lvgl-widget-tree">
              <LvglWidgetTreeItem
                v-for="widget in activePageWidgets"
                :key="widget.uiId"
                :node="widget"
                :selected-id="selectedWidgetId"
                @select="selectedWidgetId = $event"
              />
              <div v-if="!activePageWidgets.length" class="note">No widgets on this page yet.</div>
            </div>
            <button v-if="selectedWidgetId" type="button" class="secondary compact" @click="removeSelectedWidget">
              Remove widget
            </button>
          </section>

          <section class="lvgl-config-panel lvgl-config-panel--inspector">
            <div class="lvgl-config-panel__header">
              <h4>Inspector</h4>
            </div>
            <LvglWidgetInspector :node="selectedWidget" @update="handleInspectorUpdate" />
          </section>
        </div>

        <div class="lvgl-config-footer">
          <button type="button" class="secondary compact" @click="isOpen = false">Close</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import LvglWidgetTreeItem from "./LvglWidgetTreeItem.vue";
import LvglWidgetInspector from "./LvglWidgetInspector.vue";

const props = defineProps({
  lvglConfig: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["update"]);

const isOpen = ref(false);
const activePageIndex = ref(0);
const selectedWidgetId = ref("");

let uiIdCounter = 0;
const nextUiId = () => {
  uiIdCounter += 1;
  return `lvgl-widget-new-${uiIdCounter}`;
};

const emptyLvglConfig = () => ({ displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] });

const pages = computed(() => props.lvglConfig?.pages || []);
const pageCount = computed(() => pages.value.length);
const widgetCount = computed(() => pages.value.reduce((total, page) => total + (page.widgets?.length || 0), 0));
const activePageWidgets = computed(() => pages.value[activePageIndex.value]?.widgets || []);

const findWidgetById = (nodes, uiId) => {
  for (const node of nodes || []) {
    if (node.uiId === uiId) return node;
    const found = findWidgetById(node.children, uiId);
    if (found) return found;
  }
  return null;
};

const selectedWidget = computed(() => findWidgetById(activePageWidgets.value, selectedWidgetId.value));

const openModal = () => {
  if (!props.lvglConfig) {
    emit("update", emptyLvglConfig());
  }
  isOpen.value = true;
};

const selectPage = (index) => {
  activePageIndex.value = index;
  selectedWidgetId.value = "";
};

const addPage = () => {
  const current = props.lvglConfig || emptyLvglConfig();
  const nextPages = [...(current.pages || []), { id: `page_${current.pages?.length || 0}`, widgets: [] }];
  emit("update", { ...current, pages: nextPages });
  activePageIndex.value = nextPages.length - 1;
  selectedWidgetId.value = "";
};

const removeActivePage = () => {
  const current = props.lvglConfig;
  if (!current) return;
  const nextPages = current.pages.filter((_, index) => index !== activePageIndex.value);
  emit("update", { ...current, pages: nextPages });
  activePageIndex.value = Math.min(activePageIndex.value, nextPages.length - 1);
  selectedWidgetId.value = "";
};

const NEW_WIDGET_DEFAULTS = {
  label: { text: "Label" }
};

const addWidget = (type) => {
  const current = props.lvglConfig;
  if (!current || activePageIndex.value < 0) return;
  const newWidget = { uiId: nextUiId(), type, common: {}, props: { ...(NEW_WIDGET_DEFAULTS[type] || {}) }, children: [] };
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value ? { ...page, widgets: [...(page.widgets || []), newWidget] } : page
  );
  emit("update", { ...current, pages: nextPages });
};

const removeWidgetById = (nodes, uiId) =>
  (nodes || [])
    .filter((node) => node.uiId !== uiId)
    .map((node) => ({ ...node, children: removeWidgetById(node.children, uiId) }));

const removeSelectedWidget = () => {
  const current = props.lvglConfig;
  if (!current || !selectedWidgetId.value) return;
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value ? { ...page, widgets: removeWidgetById(page.widgets, selectedWidgetId.value) } : page
  );
  emit("update", { ...current, pages: nextPages });
  selectedWidgetId.value = "";
};

const replaceWidgetById = (nodes, uiId, nextNode) =>
  (nodes || []).map((node) =>
    node.uiId === uiId ? nextNode : { ...node, children: replaceWidgetById(node.children, uiId, nextNode) }
  );

const handleInspectorUpdate = (nextNode) => {
  const current = props.lvglConfig;
  if (!current || !selectedWidgetId.value) return;
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value
      ? { ...page, widgets: replaceWidgetById(page.widgets, selectedWidgetId.value, nextNode) }
      : page
  );
  emit("update", { ...current, pages: nextPages });
};
</script>

<style scoped>
.lvgl-builder__trigger {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lvgl-config-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  z-index: 60;
}

.lvgl-config-card {
  width: min(1000px, 92vw);
  max-height: 85vh;
  background: #fff;
  border-radius: 14px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lvgl-config-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.lvgl-config-header h3 {
  margin: 0;
}

.lvgl-config-body {
  flex: 1;
  display: grid;
  grid-template-columns: 220px 1fr 1fr;
  gap: 14px;
  padding: 14px 18px;
  overflow: auto;
}

.lvgl-config-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.lvgl-config-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lvgl-config-panel__header h4 {
  margin: 0;
  font-size: 14px;
}

.lvgl-config-panel__actions {
  display: flex;
  gap: 6px;
}

.lvgl-page-list,
.lvgl-widget-tree {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  min-height: 120px;
}

.lvgl-page-item {
  text-align: left;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.lvgl-page-item:hover {
  background: var(--border);
}

.lvgl-page-item.active {
  background: var(--accent);
  color: #fff;
}

.lvgl-config-footer {
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
</style>
