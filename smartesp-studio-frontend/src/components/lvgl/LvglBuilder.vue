<template>
  <div class="components-header">
    <div class="components-title">
      <h2>LVGL</h2>
      <a
        class="filter-help"
        href="https://esphome.io/components/lvgl/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Documentation"
      >
        ?
      </a>
    </div>
  </div>

  <div class="module-card__body lvgl-builder">
    <div class="lvgl-grid">
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
          <span v-if="!pages.length" class="note">No pages yet.</span>
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
            <select v-model="widgetTypeToAdd" class="lvgl-widget-type-select" :disabled="activePageIndex < 0">
              <option v-for="widget in LVGL_WIDGETS" :key="widget.type" :value="widget.type">{{ widget.label }}</option>
            </select>
            <button
              type="button"
              class="secondary compact"
              :disabled="activePageIndex < 0"
              @click="addWidget(widgetTypeToAdd)"
            >
              Add
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
    </div>

    <div class="lvgl-grid">
      <section class="lvgl-config-panel">
        <div class="lvgl-config-panel__header">
          <h4>Canvas</h4>
        </div>
        <LvglCanvas
          :page="pages[activePageIndex] || null"
          :canvas-width="canvasW"
          :canvas-height="canvasH"
          :selected-id="selectedWidgetId"
          @select="selectedWidgetId = $event"
          @move="handleCanvasMove"
          @resize-canvas="handleCanvasResize"
        />
      </section>

      <section class="lvgl-config-panel lvgl-config-panel--inspector">
        <div class="lvgl-config-panel__header">
          <h4>Form</h4>
        </div>
        <LvglWidgetInspector
          :node="selectedWidget"
          :widget-schemas="widgetSchemas"
          :id-index="idIndex"
          :page-index="activePageIndex"
          @update="handleInspectorUpdate"
          @field-edit="emit('field-edit', $event)"
        />
      </section>
    </div>

    <section v-if="showYaml" class="lvgl-config-panel lvgl-yaml-section">
      <div class="lvgl-config-panel__header">
        <h4>YAML</h4>
        <button type="button" class="secondary compact" :disabled="!yamlDirty" @click="resetYaml">Reset</button>
      </div>
      <p class="note">
        Edits the <code>lvgl:</code> block only. Applying re-parses it against the widget schemas --
        keys outside a curated schema are kept verbatim, comments and formatting are not preserved.
      </p>
      <textarea
        v-model="yamlDraft"
        class="lvgl-yaml-editor"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        @input="yamlDirty = true"
      ></textarea>
      <div class="lvgl-yaml-editor__bar">
        <button type="button" class="secondary compact" :disabled="applying || !yamlDirty" @click="applyYaml">Apply</button>
        <span v-if="yamlError" class="lvgl-yaml-editor__error">{{ yamlError }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import LvglWidgetTreeItem from "./LvglWidgetTreeItem.vue";
import LvglWidgetInspector from "./LvglWidgetInspector.vue";
import LvglCanvas from "./LvglCanvas.vue";
import { LVGL_WIDGETS, lvglWidgetDefaults } from "../../utils/lvglWidgets";
import { buildLvglYamlLines } from "../../utils/schemaLvglYaml";
import { parseLvglSection } from "../../utils/yamlLvglImport";
import { parseYamlText } from "../../utils/yamlProjectImport";
import { modeLevelRank } from "../../utils/schemaModeLevel";
import {
  loadActionCatalog,
  loadActionDefinition,
  loadConditionCatalog,
  loadConditionDefinition,
  loadSchemaByPath
} from "../../utils/schemaLoader";

const props = defineProps({
  lvglConfig: {
    type: Object,
    default: null
  },
  // type -> loaded widget schema (BuilderView.lvglWidgetSchemas).
  widgetSchemas: {
    type: Object,
    default: () => ({})
  },
  idIndex: {
    type: Array,
    default: () => []
  },
  // { pageIndex, uiId, token } pushed by BuilderView when a YAML preview line is
  // clicked -- selects the matching page + widget so the inspector can be pulsed.
  externalSelect: {
    type: Object,
    default: null
  },
  // Builder mode level -- the YAML block only shows from "Advanced" up.
  activeModeLevel: {
    type: String,
    default: "Simple"
  }
});

const emit = defineEmits(["update", "field-edit"]);

const activePageIndex = ref(0);
const selectedWidgetId = ref("");
const widgetTypeToAdd = ref(LVGL_WIDGETS[0]?.type || "label");

const yamlDraft = ref("");
const yamlDirty = ref(false);
const yamlError = ref("");
const applying = ref(false);
const canvasW = ref(240);
const canvasH = ref(320);

const showYaml = computed(() => modeLevelRank(props.activeModeLevel) >= modeLevelRank("Advanced"));

const serializedLvgl = computed(() =>
  buildLvglYamlLines(props.lvglConfig, props.widgetSchemas)
    .map((line) => line.text)
    .join("\n")
);

// Keep the YAML box mirroring canvas/form edits until the user types into it;
// then it holds their draft until Apply or Reset.
watch(
  serializedLvgl,
  (next) => {
    if (!yamlDirty.value) yamlDraft.value = next;
  },
  { immediate: true }
);

const resetYaml = () => {
  yamlDirty.value = false;
  yamlError.value = "";
  yamlDraft.value = serializedLvgl.value;
};

// Same loader bundle importYamlToProjectConfig feeds parseLvglSection, but built
// straight from the (cached) schema loaders so the LVGL tab stays self-contained.
const lvglSchemaContext = {
  loadWidgetSchema: (type) => loadSchemaByPath(`components/lvgl/widgets/${type}.json`),
  loadActionCatalog,
  loadActionDefinition,
  loadConditionCatalog,
  loadConditionDefinition
};

const applyYaml = async () => {
  yamlError.value = "";
  const parsed = parseYamlText(yamlDraft.value);
  if (!parsed.ok) {
    yamlError.value = parsed.error?.message || "Invalid YAML.";
    return;
  }
  const rawLvgl = parsed.document?.lvgl;
  if (rawLvgl === undefined) {
    yamlError.value = "No lvgl: block found.";
    return;
  }
  applying.value = true;
  try {
    const next = await parseLvglSection(rawLvgl, lvglSchemaContext);
    if (!next) {
      yamlError.value = "lvgl: must be a YAML object.";
      return;
    }
    emit("update", next);
    selectedWidgetId.value = "";
    activePageIndex.value = Math.min(activePageIndex.value, Math.max(0, next.pages.length - 1));
    yamlDirty.value = false;
  } finally {
    applying.value = false;
  }
};

let uiIdCounter = 0;
const nextUiId = () => {
  uiIdCounter += 1;
  return `lvgl-widget-new-${uiIdCounter}`;
};

const emptyLvglConfig = () => ({ displays: [], touchscreens: [], bufferSize: "", bgColor: "", pages: [] });

const pages = computed(() => props.lvglConfig?.pages || []);
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

// The config-frame panel is always mounted, so lazily seed an empty lvgl config
// on first render instead of on a modal open.
onMounted(() => {
  if (!props.lvglConfig) {
    emit("update", emptyLvglConfig());
  }
});

watch(
  () => props.externalSelect,
  (sel) => {
    if (!sel) return;
    if (sel.pageIndex >= 0 && sel.pageIndex < pages.value.length) {
      activePageIndex.value = sel.pageIndex;
    }
    if (findWidgetById(activePageWidgets.value, sel.uiId)) {
      selectedWidgetId.value = sel.uiId;
    }
  }
);

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

const addWidget = (type) => {
  const current = props.lvglConfig;
  if (!current || activePageIndex.value < 0 || !type) return;
  const newWidget = { uiId: nextUiId(), type, common: {}, props: lvglWidgetDefaults(type), children: [] };
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

const handleCanvasMove = ({ uiId, x, y }) => {
  const current = props.lvglConfig;
  if (!current || !uiId) return;
  const target = findWidgetById(pages.value[activePageIndex.value]?.widgets, uiId);
  if (!target) return;
  const nextNode = { ...target, common: { ...(target.common || {}), x, y } };
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value ? { ...page, widgets: replaceWidgetById(page.widgets, uiId, nextNode) } : page
  );
  emit("update", { ...current, pages: nextPages });
  const scopeId = `lvgl:page:${activePageIndex.value}:widget:${uiId}`;
  emit("field-edit", { scopeId, path: ["x"] });
  emit("field-edit", { scopeId, path: ["y"] });
};

const handleCanvasResize = ({ dim, value }) => {
  if (dim === "width") canvasW.value = value;
  else if (dim === "height") canvasH.value = value;
};
</script>

<style scoped>
.lvgl-builder {
  min-width: 0;
}

.lvgl-grid {
  display: grid;
  grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.lvgl-grid + .lvgl-grid {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.lvgl-yaml-section {
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.lvgl-yaml-editor {
  min-height: 260px;
  width: 100%;
  resize: vertical;
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.5;
  tab-size: 2;
  white-space: pre;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

.lvgl-yaml-editor__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lvgl-yaml-editor__error {
  color: var(--danger, #c0392b);
  font-size: 12px;
}

.lvgl-page-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  min-height: 120px;
  align-content: flex-start;
}

.lvgl-page-item {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--navy);
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
}

.lvgl-page-item:hover {
  background: var(--border);
}

.lvgl-page-item.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
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

.lvgl-widget-type-select {
  min-width: 0;
  flex: 1;
}

.lvgl-widget-tree {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  min-height: 120px;
}

@media (max-width: 900px) {
  .lvgl-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
