<template>
  <div>
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

    <div class="display-icon-picker">
      <label for="iconValue">Icon</label>
      <div class="schema-icon-row">
        <input
          id="iconValue"
          type="text"
          :value="iconInputValue"
          :class="{ 'field-error': iconRequiredError }"
          placeholder="mdi:home-thermometer"
          @input="updateText('icon', $event)"
        />
        <button type="button" class="secondary compact schema-icon-btn" @click="openIconPicker">
          <img
            :src="iconButtonUrl"
            alt="Add icon"
          />
        </button>
      </div>
      <div v-if="iconRequiredError" class="field-error-text">
        {{ iconErrorText }}
      </div>
      <IconPicker
        :open="iconPickerOpen"
        :selected="iconName"
        :initial-query="iconQuery"
        @close="handleIconClose"
        @select="handleIconSelect"
      />
    </div>
    <div v-if="!isMonochrome" class="display-icon-picker">
      <label for="iconColor">Color</label>
      <div class="schema-icon-row">
        <input
          id="iconColor"
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
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import IconPicker from "../IconPicker.vue";
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
  },
  mdiIcons: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["update"]);

const iconPickerOpen = ref(false);
const colorPickerOpen = ref(false);

const updateNumber = (key, event) => {
  const value = Number(event.target.value);
  if (Number.isNaN(value)) return;
  if (["w", "h"].includes(key)) {
    const currentW = Number(props.selectedElement?.w || 0);
    const currentH = Number(props.selectedElement?.h || 0);
    const ratio = currentH ? currentW / currentH : 1;
    const nextValue = Math.max(1, Math.round(value));
    if (key === "w") {
      const nextH = Math.max(1, Math.round(nextValue / (ratio || 1)));
      emit("update", { w: nextValue, h: nextH });
      return;
    }
    const nextW = Math.max(1, Math.round(nextValue * (ratio || 1)));
    emit("update", { w: nextW, h: nextValue });
    return;
  }
  emit("update", { [key]: value });
};

const updateText = (key, event) => {
  emit("update", { [key]: event.target.value });
};

const iconInputValue = computed(() => {
  const value = props.selectedElement?.icon || "";
  if (!value || value === "placeholder") return "";
  return value;
});

const iconName = computed(() => {
  const value = props.selectedElement?.icon || "";
  if (!value || value === "placeholder") return "";
  return value.startsWith("mdi:") ? value.slice(4) : value;
});

const iconQuery = computed(() => iconName.value);

const iconButtonUrl = computed(() => {
  if (!iconName.value) {
    return "https://cdn.jsdelivr.net/npm/@mdi/svg/svg/emoticon-plus-outline.svg";
  }
  return `https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${iconName.value}.svg`;
});

const iconRequiredError = computed(() => {
  if (!props.mdiIcons?.length) return true;
  const value = iconName.value || "";
  if (!value.trim()) return true;
  return !props.mdiIcons.some((icon) => icon.toLowerCase() === value.toLowerCase());
});

const iconErrorText = computed(() => {
  if (!props.mdiIcons?.length) return "No MDI icons available.";
  if (!iconName.value) return "Please select an icon.";
  return "Invalid MDI icon name.";
});

const colorInputValue = computed(() => props.selectedElement?.color || "");

const colorSwatch = computed(() => {
  if (!colorInputValue.value) return "#ffffff";
  return colorToCss(colorInputValue.value, "#ffffff");
});

const openIconPicker = () => {
  iconPickerOpen.value = true;
};

const handleIconClose = () => {
  iconPickerOpen.value = false;
};

const handleIconSelect = (name) => {
  emit("update", { icon: name ? `mdi:${name}` : "" });
  iconPickerOpen.value = false;
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
