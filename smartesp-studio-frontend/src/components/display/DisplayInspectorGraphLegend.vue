<template>
  <div class="display-legend">
    <div class="display-inspector__row">
      <div>
        <label for="legendNameFontSource">Name font source</label>
        <select
          id="legendNameFontSource"
          :value="selectedElement.legendNameFontSource || 'local'"
          @change="handleLegendNameFontSourceChange"
        >
          <option value="local">Local</option>
          <option value="google">Google Fonts</option>
        </select>
      </div>
      <div>
        <label for="legendValueFontSource">Value font source</label>
        <select
          id="legendValueFontSource"
          :value="selectedElement.legendValueFontSource || 'local'"
          @change="handleLegendValueFontSourceChange"
        >
          <option value="local">Local</option>
          <option value="google">Google Fonts</option>
        </select>
      </div>
    </div>

    <div v-if="(selectedElement.legendNameFontSource || 'local') === 'local'" class="display-inspector__row">
      <div>
        <label for="legendNameFontFile">Name font</label>
        <select id="legendNameFontFile" :value="selectedElement.legendNameFontFile" @change="handleLegendNameFontFileChange">
          <option value="">Select font</option>
          <option v-for="font in visibleLocalFonts" :key="font.file" :value="font.file" :title="font.file">
            {{ formatFileOptionLabel(font.file) }}
          </option>
        </select>
      </div>
      <div>
        <label for="legendNameFontSize">Name size</label>
        <input
          id="legendNameFontSize"
          type="number"
          :value="selectedElement.legendNameFontSize || 10"
          @input="updateNumber('legendNameFontSize', $event)"
        />
      </div>
    </div>

    <div v-else class="display-inspector__row">
      <div>
        <label for="legendNameFontFamily">Name family</label>
        <select id="legendNameFontFamily" :value="selectedElement.legendNameFontFamily" @change="handleLegendNameFontFamilyChange">
          <option value="">Select family</option>
          <option v-for="font in googleFonts" :key="font.family" :value="font.family">
            {{ font.family }}
          </option>
        </select>
      </div>
      <div>
        <label for="legendNameFontVariant">Variant</label>
        <select id="legendNameFontVariant" :value="selectedElement.legendNameFontVariant || 'regular'" @change="handleLegendNameFontVariantChange">
          <option
            v-for="variant in googleFonts.find((item) => item.family === selectedElement.legendNameFontFamily)?.variants || []"
            :key="variant"
            :value="variant"
          >
            {{ variant }}
          </option>
        </select>
      </div>
      <div>
        <label for="legendNameFontSizeGoogle">Name size</label>
        <input
          id="legendNameFontSizeGoogle"
          type="number"
          :value="selectedElement.legendNameFontSize || 10"
          @input="updateNumber('legendNameFontSize', $event)"
        />
      </div>
    </div>

    <div v-if="(selectedElement.legendValueFontSource || 'local') === 'local'" class="display-inspector__row">
      <div>
        <label for="legendValueFontFile">Value font</label>
        <select id="legendValueFontFile" :value="selectedElement.legendValueFontFile" @change="handleLegendValueFontFileChange">
          <option value="">Select font</option>
          <option v-for="font in visibleLocalFonts" :key="font.file" :value="font.file" :title="font.file">
            {{ formatFileOptionLabel(font.file) }}
          </option>
        </select>
      </div>
      <div>
        <label for="legendValueFontSize">Value size</label>
        <input
          id="legendValueFontSize"
          type="number"
          :value="selectedElement.legendValueFontSize || 8"
          @input="updateNumber('legendValueFontSize', $event)"
        />
      </div>
    </div>

    <div v-else class="display-inspector__row">
      <div>
        <label for="legendValueFontFamily">Value family</label>
        <select id="legendValueFontFamily" :value="selectedElement.legendValueFontFamily" @change="handleLegendValueFontFamilyChange">
          <option value="">Select family</option>
          <option v-for="font in googleFonts" :key="font.family" :value="font.family">
            {{ font.family }}
          </option>
        </select>
      </div>
      <div>
        <label for="legendValueFontVariant">Variant</label>
        <select id="legendValueFontVariant" :value="selectedElement.legendValueFontVariant || 'regular'" @change="handleLegendValueFontVariantChange">
          <option
            v-for="variant in googleFonts.find((item) => item.family === selectedElement.legendValueFontFamily)?.variants || []"
            :key="variant"
            :value="variant"
          >
            {{ variant }}
          </option>
        </select>
      </div>
      <div>
        <label for="legendValueFontSizeGoogle">Value size</label>
        <input
          id="legendValueFontSizeGoogle"
          type="number"
          :value="selectedElement.legendValueFontSize || 8"
          @input="updateNumber('legendValueFontSize', $event)"
        />
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="legendWidth">Legend width</label>
        <input
          id="legendWidth"
          type="number"
          :value="selectedElement.legendWidth"
          placeholder="80"
          @input="updateNumber('legendWidth', $event)"
        />
      </div>
      <div>
        <label for="legendHeight">Legend height</label>
        <input
          id="legendHeight"
          type="number"
          :value="selectedElement.legendHeight"
          placeholder="32"
          @input="updateNumber('legendHeight', $event)"
        />
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="legendBorder">Legend border</label>
        <input
          id="legendBorder"
          type="checkbox"
          class="schema-checkbox"
          :checked="selectedElement.legendBorder !== false"
          @change="updateBool('legendBorder', $event)"
        />
      </div>
      <div>
        <label for="legendShowLines">Show lines</label>
        <input
          id="legendShowLines"
          type="checkbox"
          class="schema-checkbox"
          :checked="selectedElement.legendShowLines !== false"
          @change="updateBool('legendShowLines', $event)"
        />
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="legendShowValues">Show values</label>
        <select id="legendShowValues" :value="selectedElement.legendShowValues || 'AUTO'" @change="updateText('legendShowValues', $event)">
          <option value="NONE">NONE</option>
          <option value="AUTO">AUTO</option>
          <option value="BESIDE">BESIDE</option>
          <option value="BELOW">BELOW</option>
        </select>
      </div>
      <div>
        <label for="legendDirection">Direction</label>
        <select id="legendDirection" :value="selectedElement.legendDirection || 'AUTO'" @change="updateText('legendDirection', $event)">
          <option value="AUTO">AUTO</option>
          <option value="HORIZONTAL">HORIZONTAL</option>
          <option value="VERTICAL">VERTICAL</option>
        </select>
      </div>
    </div>

    <div>
      <label for="legendShowUnits">Show units</label>
      <input
        id="legendShowUnits"
        type="checkbox"
        class="schema-checkbox"
        :checked="selectedElement.legendShowUnits !== false"
        @change="updateBool('legendShowUnits', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useDisplayFontControls } from "../../composables/display/useDisplayFontControls";
import { useElementPatch } from "../../composables/display/useElementPatch";

const props = defineProps({
  selectedElement: {
    type: Object,
    required: true
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
  }
});

const emit = defineEmits(["update"]);

const selectedElementRef = computed(() => props.selectedElement);
const { updateNumber, updateText, updateBool } = useElementPatch(emit, selectedElementRef);

const { visibleLocalFonts, findVisibleLocalFont, formatFileOptionLabel, buildFontSourcePatch, buildLocalFontPatch, buildGoogleFamilyPatch, buildGoogleVariantPatch } =
  useDisplayFontControls({
    localFonts: computed(() => props.localFonts),
    googleFonts: computed(() => props.googleFonts),
    assetsBase: computed(() => props.assetsBase)
  });

const handleLegendNameFontSourceChange = (event) => {
  emit("update", buildFontSourcePatch("legendName", event.target.value));
};

const handleLegendValueFontSourceChange = (event) => {
  emit("update", buildFontSourcePatch("legendValue", event.target.value));
};

const handleLegendNameFontFileChange = (event) => {
  const font = findVisibleLocalFont(event.target.value);
  emit("update", buildLocalFontPatch("legendName", font));
};

const handleLegendValueFontFileChange = (event) => {
  const font = findVisibleLocalFont(event.target.value);
  emit("update", buildLocalFontPatch("legendValue", font));
};

const handleLegendNameFontFamilyChange = (event) => {
  const family = props.googleFonts.find((item) => item.family === event.target.value);
  emit("update", buildGoogleFamilyPatch("legendName", family));
};

const handleLegendValueFontFamilyChange = (event) => {
  const family = props.googleFonts.find((item) => item.family === event.target.value);
  emit("update", buildGoogleFamilyPatch("legendValue", family));
};

const handleLegendNameFontVariantChange = (event) => {
  const variant = event.target.value;
  const family = props.googleFonts.find((item) => item.family === props.selectedElement?.legendNameFontFamily);
  emit("update", buildGoogleVariantPatch("legendName", family, variant));
};

const handleLegendValueFontVariantChange = (event) => {
  const variant = event.target.value;
  const family = props.googleFonts.find((item) => item.family === props.selectedElement?.legendValueFontFamily);
  emit("update", buildGoogleVariantPatch("legendValue", family, variant));
};
</script>
