<template>
  <aside class="display-inspector" :class="{ 'display-inspector--flat': variant === 'flat' }">
    <div v-if="showHeader" class="display-inspector__header">
      <h4>Inspector</h4>
      <span v-if="selectedElement" class="display-inspector__type">{{ selectedElement.type }}</span>
    </div>

    <div v-if="!selectedElement" class="note">Select an element on the canvas.</div>

    <div v-else class="display-inspector__form">
      <DisplayInspectorShape
        v-if="selectedElement.type === 'shape'"
        :selected-element="selectedElement"
        :is-monochrome="isMonochrome"
        @update="handleUpdate"
      />

      <DisplayInspectorIcon
        v-else-if="selectedElement.type === 'icon'"
        :selected-element="selectedElement"
        :is-monochrome="isMonochrome"
        :mdi-icons="mdiIcons"
        @update="handleUpdate"
      />

      <DisplayInspectorText
        v-else-if="selectedElement.type === 'text'"
        :selected-element="selectedElement"
        :is-monochrome="isMonochrome"
        :local-fonts="localFonts"
        :google-fonts="googleFonts"
        :assets-base="assetsBase"
        :dynamic-ids="dynamicIds"
        @update="handleUpdate"
      />

      <DisplayInspectorImage
        v-else-if="selectedElement.type === 'image'"
        :selected-element="selectedElement"
        :images="images"
        :assets-base="assetsBase"
        :screen-w="screenW"
        :screen-h="screenH"
        @update="handleUpdate"
      />

      <DisplayInspectorAnimation
        v-else-if="selectedElement.type === 'animation'"
        :selected-element="selectedElement"
        :images="images"
        :assets-base="assetsBase"
        :screen-w="screenW"
        :screen-h="screenH"
        @update="handleUpdate"
      />

      <DisplayInspectorGraph
        v-else-if="selectedElement.type === 'graph'"
        :selected-element="selectedElement"
        :is-monochrome="isMonochrome"
        :dynamic-ids="dynamicIds"
        :local-fonts="localFonts"
        :google-fonts="googleFonts"
        :assets-base="assetsBase"
        @update="handleUpdate"
      />
    </div>
  </aside>
</template>

<script setup>
import DisplayInspectorShape from "./DisplayInspectorShape.vue";
import DisplayInspectorIcon from "./DisplayInspectorIcon.vue";
import DisplayInspectorText from "./DisplayInspectorText.vue";
import DisplayInspectorImage from "./DisplayInspectorImage.vue";
import DisplayInspectorAnimation from "./DisplayInspectorAnimation.vue";
import DisplayInspectorGraph from "./DisplayInspectorGraph.vue";

defineProps({
  selectedElement: {
    type: Object,
    default: null
  },
  screenW: {
    type: Number,
    default: 0
  },
  screenH: {
    type: Number,
    default: 0
  },
  isMonochrome: {
    type: Boolean,
    default: true
  },
  images: {
    type: Array,
    default: () => []
  },
  localFonts: {
    type: Array,
    default: () => []
  },
  googleFonts: {
    type: Array,
    default: () => []
  },
  assetsBase: {
    type: String,
    default: "/"
  },
  dynamicIds: {
    type: Array,
    default: () => []
  },
  mdiIcons: {
    type: Array,
    default: () => []
  },
  variant: {
    type: String,
    default: "card"
  },
  showHeader: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["update"]);

const handleUpdate = (patch) => {
  emit("update", patch);
};

</script>

<style scoped>
.display-inspector {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  background: #f8fafc;
  display: grid;
  gap: 12px;
  align-content: start;
}

.display-inspector--flat {
  border: none;
  padding: 0;
  background: transparent;
}

.display-inspector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.display-inspector__header h4 {
  margin: 0;
  font-size: 14px;
}

.display-inspector__type {
  background: var(--navy);
  color: #f8fafc;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  font-weight: 700;
}

.display-inspector__form {
  display: grid;
  gap: 10px;
}

:deep(.display-inspector__row) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

:deep(.display-inspector__row input[type="number"]) {
  appearance: textfield;
  -moz-appearance: textfield;
}

:deep(.display-inspector__row input[type="number"]::-webkit-outer-spin-button),
:deep(.display-inspector__row input[type="number"]::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

:deep(.display-inspector__row--quad) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto repeat(2, minmax(0, 1fr));
  align-items: end;
}

:deep(.display-inspector__field) {
  min-width: 0;
}

:deep(.display-inspector__group-divider) {
  width: 1px;
  height: 48px;
  background: var(--border);
  align-self: center;
}

:deep(.field-error) {
  border-color: #ef4444;
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.4);
}

:deep(.field-error-text) {
  margin-top: 4px;
  color: #ef4444;
  font-size: 11px;
}

:deep(select.field-error) {
  color: var(--navy);
}

:deep(.display-trace-list) {
  display: grid;
  gap: 10px;
}

:deep(.display-trace-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

:deep(.display-trace-card) {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
  display: grid;
  gap: 10px;
}

:deep(.display-trace-actions) {
  display: flex;
  justify-content: flex-end;
}

:deep(.display-legend) {
  display: grid;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
}

:deep(.display-icon-picker input) {
  cursor: text;
}

:deep(.schema-icon-row) {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: stretch;
  width: 100%;
}

:deep(.schema-icon-row input) {
  min-width: 0;
}

:deep(.schema-icon-btn) {
  width: auto;
  height: 100%;
  aspect-ratio: 1 / 1;
  padding: 0;
  border-radius: 4px;
  background: var(--accent);
  border: 1px solid var(--accent-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

:deep(.schema-icon-btn img) {
  width: 18px;
  height: 18px;
  filter: brightness(0) invert(1);
}

:deep(.schema-color-icon) {
  width: 18px;
  height: 18px;
  display: inline-block;
  mask-image: url("https://cdn.jsdelivr.net/npm/@mdi/svg/svg/palette.svg");
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-image: url("https://cdn.jsdelivr.net/npm/@mdi/svg/svg/palette.svg");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}

</style>
