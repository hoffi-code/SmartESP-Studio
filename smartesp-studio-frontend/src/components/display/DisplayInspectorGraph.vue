<template>
  <div>
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

    <div v-if="!selectedElement.useTraces">
      <label for="graphSensor">{{ t('display.graph.sensorId') }}</label>
      <select
        id="graphSensor"
        :value="selectedElement.sensor"
        :class="{ 'field-error': graphSensorRequiredError }"
        @change="updateText('sensor', $event)"
      >
        <option value="">{{ t('display.option.selectSensor') }}</option>
        <option v-for="entry in graphSensorOptions" :key="entry.id" :value="entry.id">
          {{ entry.label }}
        </option>
      </select>
      <div v-if="graphSensorRequiredError" class="field-error-text">
        {{ graphSensorErrorText }}
      </div>
    </div>

    <div>
      <label for="graphId">{{ t('display.graph.graphId') }}</label>
      <input
        id="graphId"
        type="text"
        :value="selectedElement.graphId"
        placeholder="graph_id"
        :class="{ 'field-error': graphIdRequiredError }"
        @input="updateText('graphId', $event)"
      />
      <div v-if="graphIdRequiredError" class="field-error-text">
        {{ t('display.graph.graphIdRequired') }}
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="graphDuration">{{ t('display.graph.duration') }}</label>
        <input
          id="graphDuration"
          type="text"
          :value="selectedElement.duration"
          placeholder="24h"
          :class="{ 'field-error': graphDurationRequiredError }"
          @input="updateText('duration', $event)"
        />
      </div>
      <div>
        <label for="graphBorder">{{ t('display.graph.border') }}</label>
        <input
          id="graphBorder"
          type="checkbox"
          class="schema-checkbox"
          :checked="selectedElement.border !== false"
          @change="updateBool('border', $event)"
        />
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="graphXGrid">{{ t('display.graph.xGrid') }}</label>
        <input id="graphXGrid" type="text" :value="selectedElement.xGrid" placeholder="10min" @input="updateText('xGrid', $event)" />
      </div>
      <div>
        <label for="graphYGrid">{{ t('display.graph.yGrid') }}</label>
        <input id="graphYGrid" type="text" :value="selectedElement.yGrid" placeholder="1.0" @input="updateText('yGrid', $event)" />
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="graphMinRange">{{ t('display.graph.minRange') }}</label>
        <input id="graphMinRange" type="number" :value="selectedElement.minRange" placeholder="0" @input="updateNumber('minRange', $event)" />
      </div>
      <div>
        <label for="graphMaxRange">{{ t('display.graph.maxRange') }}</label>
        <input id="graphMaxRange" type="number" :value="selectedElement.maxRange" placeholder="100" @input="updateNumber('maxRange', $event)" />
      </div>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="graphMinValue">{{ t('display.graph.minValue') }}</label>
        <input id="graphMinValue" type="number" :value="selectedElement.minValue" placeholder="0" @input="updateNumber('minValue', $event)" />
      </div>
      <div>
        <label for="graphMaxValue">{{ t('display.graph.maxValue') }}</label>
        <input id="graphMaxValue" type="number" :value="selectedElement.maxValue" placeholder="100" @input="updateNumber('maxValue', $event)" />
      </div>
    </div>

    <div>
      <label for="graphUseTraces">{{ t('display.graph.useTraces') }}</label>
      <input
        id="graphUseTraces"
        type="checkbox"
        class="schema-checkbox"
        :checked="Boolean(selectedElement.useTraces)"
        @change="updateBool('useTraces', $event)"
      />
    </div>

    <div v-if="!selectedElement.useTraces" class="display-inspector__row">
      <div>
        <label for="graphLineType">{{ t('display.field.lineType') }}</label>
        <select id="graphLineType" :value="selectedElement.lineType || 'SOLID'" @change="updateText('lineType', $event)">
          <option value="SOLID">SOLID</option>
          <option value="DOTTED">DOTTED</option>
          <option value="DASHED">DASHED</option>
        </select>
      </div>
      <div>
        <label for="graphLineThickness">{{ t('display.field.thickness') }}</label>
        <input
          id="graphLineThickness"
          type="number"
          :value="selectedElement.lineThickness || 3"
          @input="updateNumber('lineThickness', $event)"
        />
      </div>
    </div>

    <div v-if="!selectedElement.useTraces" class="display-inspector__row">
      <div v-if="!isMonochrome" class="display-icon-picker">
        <label for="graphColor">{{ t('display.field.color') }}</label>
        <div class="schema-icon-row">
          <input
            id="graphColor"
            type="text"
            :value="selectedElement.color"
            placeholder="#RRGGBB"
            @input="updateText('color', $event)"
          />
          <button type="button" class="secondary compact schema-icon-btn" @click="openColorPicker">
            <span class="schema-color-icon" :style="{ backgroundColor: colorSwatch }"></span>
          </button>
        </div>
        <ColorPickerModal :open="colorPickerOpen" :selected="colorInputValue" @close="handleColorClose" @select="handleColorSelect" />
      </div>
      <div>
        <label for="graphContinuous">{{ t('display.field.continuous') }}</label>
        <input
          id="graphContinuous"
          type="checkbox"
          class="schema-checkbox"
          :checked="Boolean(selectedElement.continuous)"
          @change="updateBool('continuous', $event)"
        />
      </div>
    </div>

    <div v-else class="display-trace-list">
      <div class="display-trace-header">
        <strong>{{ t('display.graph.traces') }}</strong>
        <button type="button" class="secondary compact" @click="addTrace">{{ t('display.graph.addTrace') }}</button>
      </div>
      <div v-if="!selectedElement.traces?.length" class="note">{{ t('display.graph.noTraces') }}</div>
      <div v-for="(trace, index) in selectedElement.traces" :key="index" class="display-trace-card">
        <div class="display-inspector__row">
          <div>
            <label :for="`traceSensor_${index}`">{{ t('display.field.sensor') }}</label>
            <select :id="`traceSensor_${index}`" :value="trace.sensor || ''" @change="updateTrace(index, 'sensor', $event.target.value)">
              <option value="">{{ t('display.option.selectSensor') }}</option>
              <option v-for="entry in graphSensorOptions" :key="entry.id" :value="entry.id">
                {{ entry.label }}
              </option>
            </select>
          </div>
          <div>
            <label :for="`traceName_${index}`">{{ t('display.field.name') }}</label>
            <input :id="`traceName_${index}`" type="text" :value="trace.name || ''" @input="updateTrace(index, 'name', $event.target.value)" />
          </div>
        </div>
        <div class="display-inspector__row">
          <div>
            <label :for="`traceLineType_${index}`">{{ t('display.field.lineType') }}</label>
            <select :id="`traceLineType_${index}`" :value="trace.lineType || 'SOLID'" @change="updateTrace(index, 'lineType', $event.target.value)">
              <option value="SOLID">SOLID</option>
              <option value="DOTTED">DOTTED</option>
              <option value="DASHED">DASHED</option>
            </select>
          </div>
          <div>
            <label :for="`traceThickness_${index}`">{{ t('display.field.thickness') }}</label>
            <input
              :id="`traceThickness_${index}`"
              type="number"
              :value="trace.lineThickness ?? 3"
              @input="updateTrace(index, 'lineThickness', Number($event.target.value))"
            />
          </div>
        </div>
        <div class="display-inspector__row">
          <div v-if="!isMonochrome" class="display-icon-picker">
            <label :for="`traceColor_${index}`">{{ t('display.field.color') }}</label>
            <div class="schema-icon-row">
              <input
                :id="`traceColor_${index}`"
                type="text"
                :value="trace.color || ''"
                placeholder="#RRGGBB"
                @input="updateTrace(index, 'color', $event.target.value)"
              />
              <button type="button" class="secondary compact schema-icon-btn" @click="openTraceColorPicker(index)">
                <span class="schema-color-icon" :style="{ backgroundColor: traceColorSwatch(trace.color) }"></span>
              </button>
            </div>
          </div>
          <div>
            <label :for="`traceContinuous_${index}`">{{ t('display.field.continuous') }}</label>
            <input
              :id="`traceContinuous_${index}`"
              type="checkbox"
              class="schema-checkbox"
              :checked="Boolean(trace.continuous)"
              @change="updateTrace(index, 'continuous', $event.target.checked)"
            />
          </div>
        </div>
        <div class="display-trace-actions">
          <button type="button" class="secondary compact" @click="removeTrace(index)">{{ t('display.action.remove') }}</button>
        </div>
      </div>
      <ColorPickerModal
        :open="traceColorPickerOpen"
        :selected="activeTraceColor"
        @close="handleTraceColorClose"
        @select="handleTraceColorSelect"
      />
    </div>

    <div>
      <label for="graphLegend">{{ t('display.graph.legend') }}</label>
      <input
        id="graphLegend"
        type="checkbox"
        class="schema-checkbox"
        :checked="Boolean(selectedElement.legendEnabled)"
        @change="handleLegendToggle"
      />
    </div>

    <DisplayInspectorGraphLegend
      v-if="selectedElement.legendEnabled"
      :selected-element="selectedElement"
      :local-fonts="localFonts"
      :google-fonts="googleFonts"
      :assets-base="assetsBase"
      @update="handleUpdate"
    />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ColorPickerModal from "../ColorPickerModal.vue";
import DisplayInspectorGraphLegend from "./DisplayInspectorGraphLegend.vue";
import { colorToCss } from "../../utils/displayColor";
import { useDisplayFontControls } from "../../composables/display/useDisplayFontControls";
import { useElementPatch } from "../../composables/display/useElementPatch";
import { useGraphTraces } from "../../composables/display/useGraphTraces";

const { t } = useI18n();

const props = defineProps({
  selectedElement: {
    type: Object,
    required: true
  },
  isMonochrome: {
    type: Boolean,
    default: true
  },
  dynamicIds: {
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
  }
});

const emit = defineEmits(["update"]);

const handleUpdate = (patch) => {
  emit("update", patch);
};

const selectedElementRef = computed(() => props.selectedElement);
const { updateNumber, updateText, updateBool } = useElementPatch(emit, selectedElementRef);

const { buildDefaultFontDescriptor } = useDisplayFontControls({
  localFonts: computed(() => props.localFonts),
  googleFonts: computed(() => props.googleFonts),
  assetsBase: computed(() => props.assetsBase)
});

const {
  traceColorPickerOpen,
  addTrace,
  updateTrace,
  removeTrace,
  traceColorSwatch,
  activeTraceColor,
  openTraceColorPicker,
  handleTraceColorClose,
  handleTraceColorSelect
} = useGraphTraces(emit, selectedElementRef);

const colorPickerOpen = ref(false);

const graphSensorOptions = computed(() =>
  (props.dynamicIds || [])
    .filter((entry) => entry.domain === "sensor")
    .map((entry) => ({ id: entry.id, label: entry.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

const graphIdRequiredError = computed(() => !String(props.selectedElement?.graphId || "").trim());

const graphDurationRequiredError = computed(() => !String(props.selectedElement?.duration || "").trim());

const graphSensorRequiredError = computed(() => {
  if (props.selectedElement?.useTraces) return false;
  if (!graphSensorOptions.value.length) return true;
  const selected = props.selectedElement?.sensor || "";
  if (!selected) return true;
  return !graphSensorOptions.value.some((entry) => entry.id === selected);
});

const graphSensorErrorText = computed(() => {
  if (!graphSensorOptions.value.length) return t("display.graph.noSensorIds");
  return t("display.graph.selectSensorId");
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

const handleLegendToggle = (event) => {
  const enabled = event.target.checked;
  if (!enabled) {
    emit("update", { legendEnabled: false });
    return;
  }
  const patch = { legendEnabled: true };
  const nameSet = props.selectedElement?.legendNameFontFile || props.selectedElement?.legendNameFontFamily;
  const valueSet = props.selectedElement?.legendValueFontFile || props.selectedElement?.legendValueFontFamily;
  if (!nameSet) {
    const font = buildDefaultFontDescriptor(props.selectedElement?.legendNameFontSize || 10);
    if (font) {
      patch.legendNameFontSource = font.source;
      patch.legendNameFontFamily = font.family;
      patch.legendNameFontFile = font.file;
      patch.legendNameFontVariant = font.variant;
      patch.legendNameFontUrl = font.url;
      patch.legendNameFontWeight = font.weight;
      patch.legendNameFontStyle = font.style;
    }
  }
  if (!valueSet) {
    const font = buildDefaultFontDescriptor(props.selectedElement?.legendValueFontSize || 8);
    if (font) {
      patch.legendValueFontSource = font.source;
      patch.legendValueFontFamily = font.family;
      patch.legendValueFontFile = font.file;
      patch.legendValueFontVariant = font.variant;
      patch.legendValueFontUrl = font.url;
      patch.legendValueFontWeight = font.weight;
      patch.legendValueFontStyle = font.style;
    }
  }
  emit("update", patch);
};
</script>
