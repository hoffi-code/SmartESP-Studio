<template>
  <div
    class="lvgl-widget-inspector-panel"
    :data-schema-scope-id="widgetScopeId"
    data-schema-target="scope"
    data-schema-field-path=""
  >
    <LvglWidgetInspectorCommon :common="node.common || {}" :scope-id="widgetScopeId" @update="handleCommonUpdate" />
    <SchemaField
      v-for="field in settingFields"
      :key="field.key"
      :field="field"
      :path="[]"
      :value="node.props || {}"
      :root-value="node.props || {}"
      :id-index="idIndex"
      :context-scope-id="widgetScopeId"
      @update="handlePropsUpdate"
    />
    <p v-if="!settingFields.length && !triggerFields.length" class="note">
      No type-specific settings for this widget.
    </p>
    <p v-if="extraKeys.length" class="note">
      Kept as-is (not editable here): {{ extraKeys.join(", ") }}
    </p>
    <details v-if="styleFields.length" class="lvgl-widget-inspector-panel__section" :open="expandGroups">
      <summary>Style</summary>
      <SchemaField
        v-for="field in styleFields"
        :key="field.key"
        :field="field"
        :path="[]"
        :value="node.props || {}"
        :root-value="node.props || {}"
        :id-index="idIndex"
        :context-scope-id="widgetScopeId"
        @update="handlePropsUpdate"
      />
    </details>
    <details v-if="layoutFields.length" class="lvgl-widget-inspector-panel__section" :open="expandGroups">
      <summary>Layout</summary>
      <p class="note">Flex/grid container setup, per-cell placement and <code>align_to</code>.</p>
      <SchemaField
        v-for="field in layoutFields"
        :key="field.key"
        :field="field"
        :path="[]"
        :value="node.props || {}"
        :root-value="node.props || {}"
        :id-index="idIndex"
        :context-scope-id="widgetScopeId"
        @update="handlePropsUpdate"
      />
    </details>
    <details v-if="stateFields.length" class="lvgl-widget-inspector-panel__section" :open="expandGroups">
      <summary>States</summary>
      <p class="note">Per-state style overrides (pressed, checked, ...).</p>
      <SchemaField
        v-for="field in stateFields"
        :key="field.key"
        :field="field"
        :path="[]"
        :value="node.props || {}"
        :root-value="node.props || {}"
        :id-index="idIndex"
        :context-scope-id="widgetScopeId"
        @update="handlePropsUpdate"
      />
    </details>
    <details v-if="partFields.length" class="lvgl-widget-inspector-panel__section" :open="expandGroups">
      <summary>Parts</summary>
      <p class="note">Style overrides for widget sub-parts (indicator, knob, ...).</p>
      <SchemaField
        v-for="field in partFields"
        :key="field.key"
        :field="field"
        :path="[]"
        :value="node.props || {}"
        :root-value="node.props || {}"
        :id-index="idIndex"
        :context-scope-id="widgetScopeId"
        @update="handlePropsUpdate"
      />
    </details>
    <details v-if="triggerFields.length" class="lvgl-widget-inspector-panel__section" :open="expandGroups">
      <summary>Events</summary>
      <SchemaField
        v-for="field in triggerFields"
        :key="field.key"
        :field="field"
        :path="[]"
        :value="node.props || {}"
        :root-value="node.props || {}"
        :id-index="idIndex"
        :context-scope-id="widgetScopeId"
        @update="handlePropsUpdate"
      />
    </details>
  </div>
</template>

<script setup>
import { computed } from "vue";
import SchemaField from "../SchemaField.vue";
import LvglWidgetInspectorCommon from "./LvglWidgetInspectorCommon.vue";
import { COMMON_FIELD_KEYS, lvglWidgetParts } from "../../utils/lvglWidgets";

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  // Loaded (extends-resolved) widget schema for node.type.
  schema: {
    type: Object,
    default: null
  },
  // Project id index so id_ref fields (image src, ...) get options.
  idIndex: {
    type: Array,
    default: () => []
  },
  // Index of the page holding this widget -- must match the scopeId the yaml
  // preview stamps on this widget's lines (see schemaLvglYaml.widgetScopeId).
  pageIndex: {
    type: Number,
    default: 0
  },
  // Render the Style/Layout/States/Parts/Events <details> open (edit modal).
  expandGroups: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update", "field-edit"]);

const widgetScopeId = computed(() => `lvgl:page:${props.pageIndex}:widget:${props.node.uiId}`);

// The Common panel owns id/x/y/width/height/align; everything else in the schema
// is rendered here against node.props. Action-list triggers (on_*) are grouped
// into a collapsed "Events" section so the main form stays readable.
const typeSpecificFields = computed(() =>
  (props.schema?.fields || []).filter((field) => field?.key && !COMMON_FIELD_KEYS.has(field.key))
);

const isTriggerField = (field) =>
  field?.type === "list" && field?.item?.extends === "base_actions.json";
const isStyleField = (field) => field?.group === "style";
const isStateField = (field) => field?.group === "states";
const isPartField = (field) => field?.group === "parts";
const isLayoutField = (field) => field?.group === "layout";
const isGroupedField = (field) =>
  isTriggerField(field) ||
  isStyleField(field) ||
  isStateField(field) ||
  isPartField(field) ||
  isLayoutField(field);

const settingFields = computed(() =>
  typeSpecificFields.value.filter((field) => !isGroupedField(field))
);
const styleFields = computed(() => typeSpecificFields.value.filter(isStyleField));
const layoutFields = computed(() => typeSpecificFields.value.filter(isLayoutField));
const stateFields = computed(() => typeSpecificFields.value.filter(isStateField));
// Only the parts the selected widget type actually has -- the shared schema
// resolves a style block for every part, which would otherwise all show here.
const allowedParts = computed(() => new Set(lvglWidgetParts(props.node?.type)));
const partFields = computed(() =>
  typeSpecificFields.value.filter((field) => isPartField(field) && allowedParts.value.has(field.key))
);
const triggerFields = computed(() => typeSpecificFields.value.filter(isTriggerField));
const extraKeys = computed(() => Object.keys(props.node?.extra || {}));

const handleCommonUpdate = (patch) => {
  emit("update", { ...props.node, common: { ...(props.node.common || {}), ...patch } });
  Object.keys(patch || {}).forEach((key) => emit("field-edit", { scopeId: widgetScopeId.value, path: [key] }));
};

// Nested style blocks (a state/part -> a style prop) arrive with a deep path,
// e.g. ["pressed", "bg_color"]. Rebuild the props object immutably along that
// path; an emptied leaf/branch is pruned so the block doesn't serialize as `{}`.
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

const handlePropsUpdate = ({ path, value }) => {
  if (!path?.length) return;
  emit("update", { ...props.node, props: setDeep(props.node.props, path, value) });
  emit("field-edit", { scopeId: widgetScopeId.value, path: [path[0]] });
};
</script>

<style scoped>
.lvgl-widget-inspector-panel__section {
  margin-top: 10px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.lvgl-widget-inspector-panel__section > summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
}
</style>
