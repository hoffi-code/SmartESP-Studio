<template>
  <div>
    <div>
      <label for="shapeType">Shape</label>
      <select id="shapeType" :value="selectedElement.shapeType" @change="updateText('shapeType', $event)">
        <option value="line">Line</option>
        <option value="rect">Rectangle</option>
        <option value="circle">Circle</option>
        <option value="triangle">Triangle</option>
        <option value="polygon5">Pentagon</option>
        <option value="polygon6">Hexagon</option>
        <option value="polygon7">Heptagon</option>
        <option value="polygon8">Octagon</option>
      </select>
    </div>

    <div>
      <label for="rotation">Rotation</label>
      <select id="rotation" :value="selectedElement.rotation" @change="updateNumber('rotation', $event)">
        <option v-for="option in rotationOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>

    <div v-if="selectedElement.shapeType !== 'line'">
      <label for="filled">Filled</label>
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
        <label for="posX">X</label>
        <input id="posX" type="number" :value="selectedElement.x" @input="updateNumber('x', $event)" />
      </div>
      <div class="display-inspector__field">
        <label for="posY">Y</label>
        <input id="posY" type="number" :value="selectedElement.y" @input="updateNumber('y', $event)" />
      </div>
      <span class="display-inspector__group-divider"></span>
      <div class="display-inspector__field">
        <label for="sizeW">W</label>
        <input id="sizeW" type="number" :value="selectedElement.w" @input="updateNumber('w', $event)" />
      </div>
      <div class="display-inspector__field">
        <label for="sizeH">H</label>
        <input id="sizeH" type="number" :value="selectedElement.h" @input="updateNumber('h', $event)" />
      </div>
    </div>

    <div v-if="showColorPicker" class="display-icon-picker">
      <label for="shapeColor">Color</label>
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
import ColorPickerModal from "../ColorPickerModal.vue";
import { colorToCss } from "../../utils/displayColor";

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
  if (shape === "line") return "Line uses X/Y and W/H as end point.";
  if (shape === "rect") return "Rectangle uses X/Y and W/H.";
  if (shape === "circle") return "Circle uses X/Y and W/H as bounds.";
  if (shape === "triangle") return "Triangle uses X/Y and W/H as bounds.";
  if (shape?.startsWith("polygon")) return "Polygon uses X/Y and W/H as bounds.";
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
