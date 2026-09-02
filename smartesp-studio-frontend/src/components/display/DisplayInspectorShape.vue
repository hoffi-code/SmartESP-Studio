<template>
  <div>
    <div>
      <label for="shapeType">{{ t('display.shape.label') }}</label>
      <select id="shapeType" :value="selectedElement.shapeType" @change="updateText('shapeType', $event)">
        <option value="line">{{ t('display.shape.line') }}</option>
        <option value="rect">{{ t('display.shape.rectangle') }}</option>
        <option value="circle">{{ t('display.shape.circle') }}</option>
        <option value="triangle">{{ t('display.shape.triangle') }}</option>
        <option value="polygon5">{{ t('display.shape.pentagon') }}</option>
        <option value="polygon6">{{ t('display.shape.hexagon') }}</option>
        <option value="polygon7">{{ t('display.shape.heptagon') }}</option>
        <option value="polygon8">{{ t('display.shape.octagon') }}</option>
      </select>
    </div>

    <div>
      <label for="rotation">{{ t('display.shape.rotation') }}</label>
      <select id="rotation" :value="selectedElement.rotation" @change="updateNumber('rotation', $event)">
        <option v-for="option in rotationOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>

    <div v-if="selectedElement.shapeType !== 'line'">
      <label for="filled">{{ t('display.shape.filled') }}</label>
      <input
        id="filled"
        type="checkbox"
        class="schema-checkbox"
        :checked="selectedElement.filled"
        @change="updateBool('filled', $event)"
      />
    </div>

    <div class="display-inspector__row display-inspector__row--quad">
      <div class="display-inspector__field">
        <label for="posX">{{ t('display.field.x') }}</label>
        <input id="posX" type="number" :value="selectedElement.x" @input="updateNumber('x', $event)" />
      </div>
      <div class="display-inspector__field">
        <label for="posY">{{ t('display.field.y') }}</label>
        <input id="posY" type="number" :value="selectedElement.y" @input="updateNumber('y', $event)" />
      </div>
      <span class="display-inspector__group-divider"></span>
      <div class="display-inspector__field">
        <label for="sizeW">{{ t('display.field.w') }}</label>
        <input id="sizeW" type="number" :value="selectedElement.w" @input="updateNumber('w', $event)" />
      </div>
      <div class="display-inspector__field">
        <label for="sizeH">{{ t('display.field.h') }}</label>
        <input id="sizeH" type="number" :value="selectedElement.h" @input="updateNumber('h', $event)" />
      </div>
    </div>

    <div v-if="showColorPicker" class="display-icon-picker">
      <label for="shapeColor">{{ t('display.field.color') }}</label>
      <div class="schema-icon-row">
        <input
          id="shapeColor"
          type="text"
          :value="colorInputValue"
          placeholder="#RRGGBB"
          @input="updateText('color', $event)"
        />
        <button type="button" class="secondary compact schema-icon-btn" @click="openColorPicker">
          <span class="schema-color-icon" :style="{ backgroundColor: colorSwatch }"></span>
        </button>
      </div>
      <ColorPickerModal
        :open="colorPickerOpen"
        :selected="colorInputValue"
        @close="handleColorClose"
        @select="handleColorSelect"
      />
    </div>

    <div v-if="shapeHint" class="note">{{ shapeHint }}</div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ColorPickerModal from "../ColorPickerModal.vue";
import { colorToCss } from "../../utils/displayColor";

const { t } = useI18n();

const props = defineProps({
  selectedElement: {
    type: Object,
    required: true
  },
  isMonochrome: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["update"]);

const rotationOptions = [0, 90, 180, 270];
const colorPickerOpen = ref(false);

const showColorPicker = computed(() => !props.isMonochrome);

const shapeHint = computed(() => {
  const shape = props.selectedElement?.shapeType;
  if (shape === "line") return t("display.shape.hintLine");
  if (shape === "rect") return t("display.shape.hintRect");
  if (shape === "circle") return t("display.shape.hintCircle");
  if (shape === "triangle") return t("display.shape.hintTriangle");
  if (shape?.startsWith("polygon")) return t("display.shape.hintPolygon");
  return "";
});

const colorInputValue = computed(() => props.selectedElement?.color || "");

const colorSwatch = computed(() => {
  if (!colorInputValue.value) return "#ffffff";
  return colorToCss(colorInputValue.value, "#ffffff");
});

const updateNumber = (key, event) => {
  const value = Number(event.target.value);
  if (Number.isNaN(value)) return;
  emit("update", { [key]: value });
};

const updateText = (key, event) => {
  emit("update", { [key]: event.target.value });
};

const updateBool = (key, event) => {
  emit("update", { [key]: event.target.checked });
};

const openColorPicker = () => {
  colorPickerOpen.value = true;
};

const handleColorClose = () => {
  colorPickerOpen.value = false;
};

const handleColorSelect = (value) => {
  emit("update", { color: value || "" });
  colorPickerOpen.value = false;
};
</script>
