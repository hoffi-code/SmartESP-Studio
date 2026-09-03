<template>
  <div class="components-header">
    <div class="components-title">
      <h2>LVGL</h2>
      <a
        class="filter-help"
        href="https://esphome.io/components/lvgl/"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('lvgl.builder.docs')"
      >
        ?
      </a>
    </div>
  </div>

  <div class="module-card__body lvgl-builder">
    <section v-if="topLevelSchema" class="lvgl-config-panel lvgl-settings-section">
      <details>
        <summary>{{ t("lvgl.builder.settings") }}</summary>
        <p class="note">{{ t("lvgl.builder.settingsNote") }}</p>
        <template v-for="field in topLevelSchema.fields" :key="field.key">
          <LvglThemeEditor
            v-if="field.key === 'theme'"
            :model-value="lvglOptions.theme || {}"
            :style-fields="styleFieldsSchema?.fields || []"
            :id-index="idIndex"
            @update="handleOptionUpdate"
          />
          <SchemaField
            v-else
            :field="field"
            :path="[]"
            :value="lvglOptions"
            :root-value="lvglOptions"
            :id-index="idIndex"
            @update="handleOptionUpdate"
          />
        </template>
        <p v-if="unmodeledOptionKeys.length" class="note">
          {{ t("lvgl.builder.unmodeledOptions", { keys: unmodeledOptionKeys.join(", ") }) }}
        </p>
      </details>
    </section>

    <div class="lvgl-grid">
      <section class="lvgl-config-panel">
        <div class="lvgl-config-panel__header">
          <h4>{{ t("lvgl.builder.pages") }}</h4>
          <button type="button" class="secondary compact" @click="addPage">{{ t("lvgl.builder.addPage") }}</button>
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
          <span v-if="!pages.length" class="note">{{ t("lvgl.builder.noPages") }}</span>
        </div>
        <button
          v-if="activePageIndex >= 0 && pages.length"
          type="button"
          class="secondary compact"
          @click="removeActivePage"
        >
          {{ t("lvgl.builder.removePage") }}
        </button>
      </section>

      <section class="lvgl-config-panel">
        <div class="lvgl-config-panel__header">
          <h4>{{ t("lvgl.builder.widgets") }}</h4>
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
              {{ t("lvgl.builder.add") }}
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
            @add-group="handleAddGroup"
          />
          <div v-if="!activePageWidgets.length" class="note">{{ t("lvgl.builder.noWidgets") }}</div>
        </div>
        <div v-if="selectedGroup" class="lvgl-tree-actions">
          <input
            v-if="selectedGroup.key === 'tabs'"
            class="lvgl-tab-name"
            :value="selectedGroupEntry?.name || ''"
            :placeholder="t('lvgl.builder.tabNamePlaceholder')"
            @input="renameSelectedGroup($event.target.value)"
          />
          <template v-if="selectedGroup.key === 'tiles'">
            <input
              class="lvgl-tile-meta"
              type="number"
              :value="selectedGroupEntry?.row ?? 0"
              :title="t('lvgl.builder.tileRow')"
              @input="patchSelectedGroup({ row: Number($event.target.value) })"
            />
            <input
              class="lvgl-tile-meta"
              type="number"
              :value="selectedGroupEntry?.column ?? 0"
              :title="t('lvgl.builder.tileColumn')"
              @input="patchSelectedGroup({ column: Number($event.target.value) })"
            />
            <input
              class="lvgl-tab-name"
              :value="Array.isArray(selectedGroupEntry?.dir) ? selectedGroupEntry.dir.join(', ') : selectedGroupEntry?.dir || ''"
              :placeholder="t('lvgl.builder.tileDirPlaceholder')"
              @input="patchSelectedGroup({ dir: $event.target.value.split(',').map((s) => s.trim()).filter(Boolean) })"
            />
          </template>
          <button type="button" class="secondary compact" :title="t('lvgl.builder.addWidgetToGroup')" @click="addWidget(widgetTypeToAdd)">{{ t("lvgl.builder.addWidgetShort") }}</button>
          <button type="button" class="secondary compact" @click="removeSelectedWidget">{{ t("lvgl.builder.remove") }}</button>
        </div>
        <div v-else-if="selectedWidget" class="lvgl-tree-actions">
          <button type="button" class="secondary compact" :disabled="!canMoveUp" :title="t('lvgl.builder.moveUp')" @click="moveSelected(-1)">↑</button>
          <button type="button" class="secondary compact" :disabled="!canMoveDown" :title="t('lvgl.builder.moveDown')" @click="moveSelected(1)">↓</button>
          <button type="button" class="secondary compact" :disabled="!canIndent" :title="t('lvgl.builder.nest')" @click="indentSelected">⇥</button>
          <button type="button" class="secondary compact" :disabled="!canOutdent" :title="t('lvgl.builder.outdent')" @click="outdentSelected">⇤</button>
          <button type="button" class="secondary compact" :title="t('lvgl.builder.addChild')" @click="addChildWidget(widgetTypeToAdd)">{{ t("lvgl.builder.addChildShort") }}</button>
          <select
            v-if="selectedWidgetOwnerGroups"
            class="lvgl-move-group"
            :title="t('lvgl.builder.moveToGroup')"
            @change="moveSelectedToGroup($event.target.value); $event.target.selectedIndex = 0"
          >
            <option value="">{{ t("lvgl.builder.moveToGroupPlaceholder") }}</option>
            <option v-for="g in selectedWidgetOwnerGroups.groups" :key="g.uiId" :value="g.uiId">
              {{ selectedWidgetOwnerGroups.key === "tabs" ? t("lvgl.tree.groupTab") : t("lvgl.tree.groupTile") }} {{ g.name || g.id || "" }}
            </option>
            <option value="__root">{{ t("lvgl.builder.pageRoot") }}</option>
          </select>
          <button type="button" class="secondary compact" @click="removeSelectedWidget">{{ t("lvgl.builder.remove") }}</button>
        </div>
      </section>
    </div>

    <div class="lvgl-grid lvgl-grid--stacked">
      <section class="lvgl-config-panel">
        <div class="lvgl-config-panel__header">
          <h4>{{ t("lvgl.builder.canvasPreview") }}</h4>
          <button type="button" class="secondary compact" @click="openEditor">{{ t("lvgl.builder.edit") }}</button>
        </div>
        <div class="lvgl-canvas-preview">
          <LvglCanvas
            :page="pages[activePageIndex] || null"
            :canvas-width="canvasW"
            :canvas-height="canvasH"
            :selected-id="selectedWidgetId"
            :interactive="false"
            :display-palette="displayPalette"
            :simulated-state="simulatedState"
            @select="selectedWidgetId = $event"
          />
        </div>
      </section>

      <section class="lvgl-config-panel lvgl-config-panel--inspector">
        <div class="lvgl-config-panel__header">
          <h4>{{ t("lvgl.builder.form") }}</h4>
        </div>
        <LvglWidgetInspector
          :node="selectedWidget"
          :widget-schemas="widgetSchemas"
          :id-index="idIndex"
          :page-index="activePageIndex"
          @update="handleInspectorUpdate"
          @field-edit="emit('field-edit', $event)"
        />

        <template v-if="showYaml">
          <div class="lvgl-config-panel__header lvgl-form-yaml__header">
            <h4>{{ t("lvgl.builder.yaml") }}</h4>
            <button type="button" class="secondary compact" :disabled="!yamlDirty" @click="resetYaml">{{ t("lvgl.builder.reset") }}</button>
          </div>
          <p class="note">{{ t("lvgl.builder.yamlNote") }}</p>
          <textarea
            v-model="yamlDraft"
            class="lvgl-yaml-editor"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="yamlDirty = true"
          ></textarea>
          <div class="lvgl-yaml-editor__bar">
            <button type="button" class="secondary compact" :disabled="applying || !yamlDirty" @click="applyYaml">{{ t("lvgl.builder.apply") }}</button>
            <span v-if="yamlError" class="lvgl-yaml-editor__error">{{ yamlError }}</span>
          </div>
        </template>
      </section>
    </div>

    <div v-if="editorOpen" class="lvgl-editor-modal">
      <div class="lvgl-editor-modal__backdrop" @click="editorOpen = false" />
      <div class="lvgl-editor-modal__dialog" role="dialog" aria-modal="true" :aria-label="t('lvgl.builder.editorTitle')">
        <div class="lvgl-editor-modal__head">
          <h3>{{ t("lvgl.builder.editorHeading", { page: pages[activePageIndex]?.id || `page_${activePageIndex}` }) }}</h3>
          <button type="button" class="secondary compact" @click="editorOpen = false">{{ t("lvgl.builder.close") }}</button>
        </div>
        <div class="lvgl-editor-modal__body">
          <div class="lvgl-editor-modal__canvas">
            <LvglCanvas
              :page="pages[activePageIndex] || null"
              :canvas-width="canvasW"
              :canvas-height="canvasH"
              :selected-id="selectedWidgetId"
              :display-palette="displayPalette"
              :simulated-state="simulatedState"
              @select="selectedWidgetId = $event"
              @move="handleCanvasMove"
              @resize-canvas="handleCanvasResize"
            />
          </div>
          <div class="lvgl-editor-modal__form">
            <LvglWidgetInspector
              :node="selectedWidget"
              :widget-schemas="widgetSchemas"
              :id-index="idIndex"
              :page-index="activePageIndex"
              :expand-groups="true"
              @update="handleInspectorUpdate"
              @field-edit="emit('field-edit', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import LvglWidgetTreeItem from "./LvglWidgetTreeItem.vue";
import LvglWidgetInspector from "./LvglWidgetInspector.vue";
import LvglThemeEditor from "./LvglThemeEditor.vue";
import LvglCanvas from "./LvglCanvas.vue";
import SchemaField from "../SchemaField.vue";
import { LVGL_WIDGETS, lvglWidgetDefaults } from "../../utils/lvglWidgets";
import { LVGL_BUILTIN_FONTS, collectLvglGroupNames, collectLvglWidgetIds } from "../../utils/lvglIds";
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

const { t } = useI18n();

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
  },
  // { monochrome, background, backgroundOpacity, foreground } from BuilderView --
  // forwarded to both LvglCanvas instances so the preview reflects the display.
  displayPalette: {
    type: Object,
    default: () => ({})
  },
  // P8 live binding: simulationEntityState.js entityState map, forwarded to both
  // LvglCanvas instances. Absent outside the Simulation tab.
  simulatedState: {
    type: Object,
    default: null
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

// The interactive canvas + full parameter form live in a modal; the inline panel
// is a static preview that opens it.
const editorOpen = ref(false);
const openEditor = () => {
  editorOpen.value = true;
};
const onKeydown = (event) => {
  if (event.key === "Escape") editorOpen.value = false;
};
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

// Extra id_ref options for the LVGL subtree: built-in fonts (never a font: component)
// and group names already in use. Covers the Settings panel and the widget-inspector modal.
const lvglGroupNames = computed(() => collectLvglGroupNames(props.lvglConfig));
const lvglWidgetIds = computed(() => collectLvglWidgetIds(props.lvglConfig));
provide("idRefOptionProvider", (field) => {
  if (field?.optionsProvider === "lvglGroups") return lvglGroupNames.value;
  if (field?.domain === "font") return LVGL_BUILTIN_FONTS;
  if (field?.domain === "lvgl") return lvglWidgetIds.value;
  return [];
});

// Curated top-level lvgl: options for the Settings panel. Everything the schema
// doesn't model still round-trips via lvglConfig.options (see parseLvglSection).
const topLevelSchema = ref(null);
const styleFieldsSchema = ref(null);
const lvglOptions = computed(() => props.lvglConfig?.options || {});
const modeledOptionKeys = computed(
  () => new Set((topLevelSchema.value?.fields || []).map((field) => field.key))
);
const unmodeledOptionKeys = computed(() =>
  Object.keys(lvglOptions.value).filter((key) => !modeledOptionKeys.value.has(key))
);

const setDeep = (source, path, value) => {
  const [head, ...rest] = path;
  const next = { ...(source || {}) };
  if (!rest.length) {
    if (value === undefined || value === "" || value === null) delete next[head];
    else next[head] = value;
    return next;
  }
  const child = setDeep(next[head], rest, value);
  if (child && Object.keys(child).length) next[head] = child;
  else delete next[head];
  return next;
};

const handleOptionUpdate = ({ path, value }) => {
  if (!path?.length) return;
  const current = props.lvglConfig || emptyLvglConfig();
  emit("update", { ...current, options: setDeep(current.options, path, value) });
};

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

const emptyLvglConfig = () => ({
  displays: [],
  touchscreens: [],
  bufferSize: "",
  bgColor: "",
  options: {},
  pages: []
});

const pages = computed(() => props.lvglConfig?.pages || []);
const activePageWidgets = computed(() => pages.value[activePageIndex.value]?.widgets || []);

// All child-widget arrays hanging off a node: its own `children` plus every
// tabview `tabs[].widgets` / tileview `tiles[].widgets` group.
const groupsOf = (node) => node?.tabs || node?.tiles || null;
const childListsOf = (node) => [node?.children || [], ...(groupsOf(node) || []).map((g) => g.widgets || [])];

const findWidgetById = (nodes, uiId) => {
  for (const node of nodes || []) {
    if (node.uiId === uiId) return node;
    for (const list of childListsOf(node)) {
      const found = findWidgetById(list, uiId);
      if (found) return found;
    }
  }
  return null;
};

// Rebuild a node with each of its child-widget arrays passed through `mapList`.
const withMappedChildLists = (node, mapList) => {
  const next = { ...node, children: mapList(node.children || []) };
  const key = node.tabs ? "tabs" : node.tiles ? "tiles" : null;
  if (key) next[key] = node[key].map((g) => ({ ...g, widgets: mapList(g.widgets || []) }));
  return next;
};

const selectedWidget = computed(() => findWidgetById(activePageWidgets.value, selectedWidgetId.value));

// Selecting a tab/tile group row: { owner, key, index } locating the group.
const findGroup = (nodes, uiId) => {
  for (const node of nodes || []) {
    const key = node.tabs ? "tabs" : node.tiles ? "tiles" : null;
    if (key) {
      const index = node[key].findIndex((g) => g.uiId === uiId);
      if (index !== -1) return { owner: node, key, index };
    }
    for (const list of childListsOf(node)) {
      const found = findGroup(list, uiId);
      if (found) return found;
    }
  }
  return null;
};
const selectedGroup = computed(() =>
  selectedWidgetId.value ? findGroup(activePageWidgets.value, selectedWidgetId.value) : null
);

// Return a shallow clone of `node` with one group's widgets transformed.
const mapGroupWidgets = (node, groupUiId, fn) => {
  const key = node.tabs ? "tabs" : node.tiles ? "tiles" : null;
  if (!key) return node;
  return { ...node, [key]: node[key].map((g) => (g.uiId === groupUiId ? { ...g, widgets: fn(g.widgets || []) } : g)) };
};

// Append a freshly built widget into the selected group's `widgets`.
const addGroupWidget = (type) => {
  const ctx = selectedGroup.value;
  if (!ctx || !type) return;
  const child = { uiId: nextUiId(), type, common: {}, props: lvglWidgetDefaults(type), children: [] };
  const ownerUiId = ctx.owner.uiId;
  const groupUiId = selectedWidgetId.value;
  mutateActivePageWidgets((widgets) => {
    const owner = findWidgetById(widgets, ownerUiId);
    return owner
      ? replaceWidgetById(widgets, ownerUiId, mapGroupWidgets(owner, groupUiId, (list) => [...list, child]))
      : widgets;
  });
  selectedWidgetId.value = child.uiId;
};

const selectedGroupEntry = computed(() => {
  const ctx = selectedGroup.value;
  return ctx ? ctx.owner[ctx.key][ctx.index] : null;
});

const mapOwnerGroups = (ownerUiId, fn) => {
  mutateActivePageWidgets((widgets) => {
    const owner = findWidgetById(widgets, ownerUiId);
    if (!owner) return widgets;
    const key = owner.tabs ? "tabs" : "tiles";
    return replaceWidgetById(widgets, ownerUiId, { ...owner, [key]: fn(owner[key] || [], key) });
  });
};

const handleAddGroup = (ownerUiId) => {
  mapOwnerGroups(ownerUiId, (list, key) => {
    const entry =
      key === "tabs"
        ? { uiId: nextUiId(), name: `Tab ${list.length + 1}`, widgets: [] }
        : { uiId: nextUiId(), row: list.length, column: 0, widgets: [] };
    return [...list, entry];
  });
};

const patchSelectedGroup = (patch) => {
  const ctx = selectedGroup.value;
  if (!ctx) return;
  const groupUiId = selectedWidgetId.value;
  mapOwnerGroups(ctx.owner.uiId, (list) => list.map((g) => (g.uiId === groupUiId ? { ...g, ...patch } : g)));
};
const renameSelectedGroup = (name) => patchSelectedGroup({ name });

// When the selected widget lives inside a tab/tile group: the owner + its groups,
// so it can be moved to a sibling group or back to the page.
const selectedWidgetOwnerGroups = computed(() => {
  const owner = selectedContext.value?.parent;
  const key = owner?.tabs ? "tabs" : owner?.tiles ? "tiles" : null;
  return key ? { ownerUiId: owner.uiId, key, groups: owner[key] } : null;
});

const moveSelectedToGroup = (targetUiId) => {
  const info = selectedWidgetOwnerGroups.value;
  const widget = selectedWidget.value;
  if (!targetUiId || !info || !widget) return;
  const wUiId = selectedWidgetId.value;
  mutateActivePageWidgets((widgets) => {
    const without = removeWidgetById(widgets, wUiId);
    if (targetUiId === "__root") return [...without, widget];
    const owner = findWidgetById(without, info.ownerUiId);
    return owner
      ? replaceWidgetById(without, info.ownerUiId, mapGroupWidgets(owner, targetUiId, (list) => [...list, widget]))
      : widgets;
  });
};

// The config-frame panel is always mounted, so lazily seed an empty lvgl config
// on first render instead of on a modal open.
onMounted(async () => {
  if (!props.lvglConfig) {
    emit("update", emptyLvglConfig());
  }
  try {
    topLevelSchema.value = await loadSchemaByPath("components/lvgl/lvgl_top_level.json");
  } catch {
    topLevelSchema.value = null;
  }
  try {
    styleFieldsSchema.value = await loadSchemaByPath("components/base_component/lvgl_style_props.json");
  } catch {
    styleFieldsSchema.value = null;
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
  // With a tab/tile group selected, the new widget goes into that group.
  if (selectedGroup.value) {
    addGroupWidget(type);
    return;
  }
  const newWidget = { uiId: nextUiId(), type, common: {}, props: lvglWidgetDefaults(type), children: [] };
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value ? { ...page, widgets: [...(page.widgets || []), newWidget] } : page
  );
  emit("update", { ...current, pages: nextPages });
};

const removeWidgetById = (nodes, uiId) =>
  (nodes || [])
    .filter((node) => node.uiId !== uiId)
    .map((node) => withMappedChildLists(node, (list) => removeWidgetById(list, uiId)));

const removeSelectedWidget = () => {
  const current = props.lvglConfig;
  if (!current || !selectedWidgetId.value) return;
  const ctx = selectedGroup.value;
  if (ctx) {
    const ownerUiId = ctx.owner.uiId;
    mutateActivePageWidgets((widgets) => {
      const owner = findWidgetById(widgets, ownerUiId);
      if (!owner) return widgets;
      const key = owner.tabs ? "tabs" : "tiles";
      return replaceWidgetById(widgets, ownerUiId, {
        ...owner,
        [key]: owner[key].filter((g) => g.uiId !== selectedWidgetId.value)
      });
    });
    selectedWidgetId.value = "";
    return;
  }
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value ? { ...page, widgets: removeWidgetById(page.widgets, selectedWidgetId.value) } : page
  );
  emit("update", { ...current, pages: nextPages });
  selectedWidgetId.value = "";
};

const replaceWidgetById = (nodes, uiId, nextNode) =>
  (nodes || []).map((node) =>
    node.uiId === uiId
      ? nextNode
      : withMappedChildLists(node, (list) => replaceWidgetById(list, uiId, nextNode))
  );

// --- tree structure ops (all return a new top-level widgets array) ---

const addChildById = (nodes, parentUiId, child) =>
  (nodes || []).map((node) =>
    node.uiId === parentUiId
      ? { ...node, children: [...(node.children || []), child] }
      : { ...node, children: addChildById(node.children, parentUiId, child) }
  );

// Swap uiId with its sibling `delta` positions away, at whatever depth it sits
// (own children or a tab/tile group's widgets).
const reorderSibling = (nodes, uiId, delta) => {
  const list = nodes || [];
  const idx = list.findIndex((node) => node.uiId === uiId);
  if (idx !== -1) {
    const target = idx + delta;
    if (target < 0 || target >= list.length) return list;
    const next = list.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  }
  return list.map((node) => withMappedChildLists(node, (sub) => reorderSibling(sub, uiId, delta)));
};

// Move uiId to be the last child of its immediately-preceding sibling.
const indentNode = (nodes, uiId) => {
  const list = nodes || [];
  const idx = list.findIndex((node) => node.uiId === uiId);
  if (idx > 0) {
    const prev = list[idx - 1];
    const next = list.slice();
    next[idx - 1] = { ...prev, children: [...(prev.children || []), list[idx]] };
    next.splice(idx, 1);
    return next;
  }
  if (idx === 0) return list;
  return list.map((node) => withMappedChildLists(node, (sub) => indentNode(sub, uiId)));
};

// Move uiId out of its parent, to sit right after the parent among its siblings.
const outdentNode = (nodes, uiId) => {
  const list = nodes || [];
  const next = [];
  for (const node of list) {
    let moved = null;
    const stripped = withMappedChildLists(node, (sub) => {
      const i = sub.findIndex((c) => c.uiId === uiId);
      if (i === -1) return outdentNode(sub, uiId);
      const copy = sub.slice();
      [moved] = copy.splice(i, 1);
      return copy;
    });
    next.push(stripped);
    if (moved) next.push(moved);
  }
  return next;
};

const mutateActivePageWidgets = (fn) => {
  const current = props.lvglConfig;
  if (!current || activePageIndex.value < 0) return;
  const nextPages = current.pages.map((page, index) =>
    index === activePageIndex.value ? { ...page, widgets: fn(page.widgets || []) } : page
  );
  emit("update", { ...current, pages: nextPages });
};

// Sibling list + position of the selected widget within the active page tree
// (own children or a tab/tile group's widgets).
const findSiblingContext = (nodes, uiId, parent = null) => {
  const list = nodes || [];
  const idx = list.findIndex((node) => node.uiId === uiId);
  if (idx !== -1) return { siblings: list, index: idx, parent };
  for (const node of list) {
    for (const sub of childListsOf(node)) {
      const found = findSiblingContext(sub, uiId, node);
      if (found) return found;
    }
  }
  return null;
};

const selectedContext = computed(() =>
  selectedWidgetId.value ? findSiblingContext(activePageWidgets.value, selectedWidgetId.value) : null
);
const canMoveUp = computed(() => (selectedContext.value?.index ?? 0) > 0);
const canMoveDown = computed(() => {
  const ctx = selectedContext.value;
  return Boolean(ctx) && ctx.index < ctx.siblings.length - 1;
});
const canIndent = computed(() => canMoveUp.value);
const canOutdent = computed(() => Boolean(selectedContext.value?.parent));

const addChildWidget = (type) => {
  if (!selectedWidgetId.value || !type) return;
  const child = { uiId: nextUiId(), type, common: {}, props: lvglWidgetDefaults(type), children: [] };
  mutateActivePageWidgets((widgets) => addChildById(widgets, selectedWidgetId.value, child));
  selectedWidgetId.value = child.uiId;
};

const moveSelected = (delta) =>
  mutateActivePageWidgets((widgets) => reorderSibling(widgets, selectedWidgetId.value, delta));
const indentSelected = () =>
  mutateActivePageWidgets((widgets) => indentNode(widgets, selectedWidgetId.value));
const outdentSelected = () =>
  mutateActivePageWidgets((widgets) => outdentNode(widgets, selectedWidgetId.value));

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

/* row 2: preview on top, form below */
.lvgl-grid--stacked {
  grid-template-columns: minmax(0, 1fr);
}

.lvgl-form-yaml__header {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: 12px;
}

.lvgl-canvas-preview {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
}

.lvgl-editor-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lvgl-editor-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
}

.lvgl-editor-modal__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(1100px, 100%);
  max-height: 100%;
  background: var(--card, #fff);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.lvgl-editor-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.lvgl-editor-modal__head h3 {
  margin: 0;
  font-size: 15px;
}

.lvgl-editor-modal__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 360px);
  gap: 16px;
  padding: 16px;
  overflow: auto;
}

.lvgl-editor-modal__form {
  min-width: 0;
  overflow: auto;
}

@media (max-width: 860px) {
  .lvgl-editor-modal__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

.lvgl-settings-section {
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
  margin-bottom: 12px;
}

.lvgl-settings-section > details > summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
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

.lvgl-tree-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.lvgl-tab-name {
  flex: 1 1 90px;
  min-width: 0;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.lvgl-tile-meta {
  width: 48px;
  font-size: 12px;
  padding: 3px 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

.lvgl-move-group {
  font-size: 12px;
  padding: 2px 4px;
}

@media (max-width: 900px) {
  .lvgl-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
