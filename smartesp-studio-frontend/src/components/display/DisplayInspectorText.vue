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

    <div>
      <label for="textMode">Mode</label>
      <select
        id="textMode"
        :value="selectedElement.textMode || 'static'"
        @change="updateText('textMode', $event)"
      >
        <option v-for="option in dynamicModeOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-if="(selectedElement.textMode || 'static') === 'static'">
      <label for="textValue">Text</label>
      <input
        id="textValue"
        type="text"
        :value="selectedElement.text"
        @input="updateText('text', $event)"
      />
    </div>

    <div v-if="(selectedElement.textMode || 'static') === 'dynamic'">
      <label for="dynamicId">Source ID</label>
      <select
        id="dynamicId"
        :value="selectedElement.dynamicId"
        :class="{ 'field-error': dynamicIdRequiredError }"
        @change="updateText('dynamicId', $event)"
      >
        <option value="">Select ID</option>
        <option v-for="entry in dynamicIdOptions" :key="entry.id" :value="entry.id">
          {{ entry.label }}
        </option>
      </select>
      <div v-if="dynamicIdRequiredError" class="field-error-text">
        {{ dynamicIdErrorText }}
      </div>
    </div>

    <div v-if="(selectedElement.textMode || 'static') === 'dynamic'" class="display-inspector__row">
      <div>
        <label for="prefix">Prefix</label>
        <input id="prefix" type="text" :value="selectedElement.prefix" @input="updateText('prefix', $event)" />
      </div>
      <div>
        <label for="suffix">Suffix</label>
        <input id="suffix" type="text" :value="selectedElement.suffix" @input="updateText('suffix', $event)" />
      </div>
    </div>

    <div v-if="(selectedElement.textMode || 'static') === 'dynamic'" class="display-inspector__row">
      <div v-if="isNumericDomain(selectedElement.dynamicDomain)">
        <label for="format">Format</label>
        <input id="format" type="text" :value="selectedElement.format" @input="updateText('format', $event)" />
      </div>
    </div>

    <div
      v-if="(selectedElement.textMode || 'static') === 'dynamic' && isBinaryDomain(selectedElement.dynamicDomain)"
      class="display-inspector__row"
    >
      <div>
        <label for="onLabel">On label</label>
        <input id="onLabel" type="text" :value="selectedElement.onLabel" @input="updateText('onLabel', $event)" />
      </div>
      <div>
        <label for="offLabel">Off label</label>
        <input id="offLabel" type="text" :value="selectedElement.offLabel" @input="updateText('offLabel', $event)" />
      </div>
    </div>

    <div>
      <label for="wrap">Wrap text</label>
      <select
        id="wrap"
        :value="(selectedElement.wrap !== false).toString()"
        @change="updateBoolSelect('wrap', $event)"
      >
        <option value="true">TRUE</option>
        <option value="false">FALSE</option>
      </select>
    </div>

    <div v-if="!isMonochrome" class="display-icon-picker">
      <label for="elementColor">Color</label>
      <div class="schema-icon-row">
        <input
          id="elementColor"
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

    <div>
      <label for="fontSource">Font source</label>
      <select id="fontSource" :value="selectedElement.fontSource || 'local'" @change="handleFontSourceChange">
        <option value="local">Local</option>
        <option value="google">Google Fonts</option>
      </select>
    </div>

    <div v-if="(selectedElement.fontSource || 'local') === 'local'">
      <label for="fontLocal">Font</label>
      <select id="fontLocal" :value="selectedElement.fontFile" @change="handleLocalFontChange">
        <option v-for="font in visibleLocalFonts" :key="font.file" :value="font.file" :title="font.file">
          {{ formatFileOptionLabel(font.file) }}
        </option>
      </select>
    </div>

    <div v-if="selectedElement.fontSource === 'google'" class="display-inspector__row">
      <div>
        <label for="fontFamily">Font family</label>
        <select id="fontFamily" :value="selectedElement.fontFamily" @change="handleGoogleFamilyChange">
          <option v-for="font in googleFonts" :key="font.family" :value="font.family">
            {{ font.family }}
          </option>
        </select>
      </div>
      <div>
        <label for="fontVariant">Variant</label>
        <select id="fontVariant" :value="selectedElement.fontVariant" @change="handleGoogleVariantChange">
          <option
            v-for="variant in googleFonts.find((item) => item.family === selectedElement.fontFamily)?.variants || []"
            :key="variant"
            :value="variant"
          >
            {{ variant }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import ColorPickerModal from "../ColorPickerModal.vue";
import { colorToCss } from "../../utils/displayColor";
import { useDisplayFontControls } from "../../composables/display/useDisplayFontControls";
import { useElementPatch } from "../../composables/display/useElementPatch";

const props = defineProps({
  selectedElement: {
    type: Object,
    required: true
  },
  isMonochrome: {
    type: Boolean,
    default: true
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
  }
});

const emit = defineEmits(["update"]);

const selectedElementRef = computed(() => props.selectedElement);
const { updateNumber, updateText, updateBoolSelect } = useElementPatch(emit, selectedElementRef);

const {
  visibleLocalFonts,
  findVisibleLocalFont,
  formatFileOptionLabel,
  buildFontSourcePatch,
  buildLocalFontPatch,
  buildGoogleFamilyPatch,
  buildGoogleVariantPatch
} = useDisplayFontControls({
  localFonts: computed(() => props.localFonts),
  googleFonts: computed(() => props.googleFonts),
  assetsBase: computed(() => props.assetsBase)
});

const colorPickerOpen = ref(false);

const dynamicModeOptions = [
  { value: "static", label: "Static text" },
  { value: "dynamic", label: "Dynamic value" }
];

const isNumericDomain = (domain) => ["sensor", "number"].includes(domain);
const isBinaryDomain = (domain) => ["binary_sensor", "switch"].includes(domain);

const dynamicIdOptions = computed(() => {
  const domain = props.selectedElement?.dynamicDomain || "";
  const list = props.dynamicIds || [];
  if (!domain) return list;
  return list.filter((entry) => entry.domain === domain);
});

const dynamicIdRequiredError = computed(() => {
  if ((props.selectedElement?.textMode || "static") !== "dynamic") return false;
  if (!dynamicIdOptions.value.length) return true;
  const selected = props.selectedElement?.dynamicId || "";
  if (!selected) return true;
  return !dynamicIdOptions.value.some((entry) => entry.id === selected);
});

const dynamicIdErrorText = computed(() => {
  if (!dynamicIdOptions.value.length) return "No source IDs available.";
  return "Please select a source ID.";
});

const colorInputValue = computed(() => props.selectedElement?.color || "");

const colorSwatch = computed(() => {
  if (!colorInputValue.value) return "#ffffff";
  return colorToCss(colorInputValue.value, "#ffffff");
});

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

const handleFontSourceChange = (event) => {
  emit("update", buildFontSourcePatch("", event.target.value));
};

const handleLocalFontChange = (event) => {
  const font = findVisibleLocalFont(event.target.value);
  emit("update", buildLocalFontPatch("", font));
};

const handleGoogleFamilyChange = (event) => {
  const family = props.googleFonts.find((item) => item.family === event.target.value);
  emit("update", buildGoogleFamilyPatch("", family));
};

const handleGoogleVariantChange = (event) => {
  const variant = event.target.value;
  const family = props.googleFonts.find((item) => item.family === props.selectedElement?.fontFamily);
  emit("update", buildGoogleVariantPatch("", family, variant));
};
</script>
