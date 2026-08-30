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

      <template v-else>
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

        <div v-if="selectedElement.type === 'graph' && !selectedElement.useTraces">
          <label for="graphSensor">Sensor ID *</label>
          <select
            id="graphSensor"
            :value="selectedElement.sensor"
            :class="{ 'field-error': graphSensorRequiredError }"
            @change="updateText('sensor', $event)"
          >
            <option value="">Select sensor</option>
            <option v-for="entry in graphSensorOptions" :key="entry.id" :value="entry.id">
              {{ entry.label }}
            </option>
          </select>
          <div v-if="graphSensorRequiredError" class="field-error-text">
            {{ graphSensorErrorText }}
          </div>
        </div>

        <template v-if="selectedElement.type === 'graph'">
          <div>
            <label for="graphId">Graph ID *</label>
            <input
              id="graphId"
              type="text"
              :value="selectedElement.graphId"
              placeholder="graph_id"
              :class="{ 'field-error': graphIdRequiredError }"
              @input="updateText('graphId', $event)"
            />
            <div v-if="graphIdRequiredError" class="field-error-text">
              Please provide a graph ID.
            </div>
          </div>

          <div class="display-inspector__row">
            <div>
              <label for="graphDuration">Duration *</label>
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
              <label for="graphBorder">Border</label>
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
              <label for="graphXGrid">X grid</label>
              <input
                id="graphXGrid"
                type="text"
                :value="selectedElement.xGrid"
                placeholder="10min"
                @input="updateText('xGrid', $event)"
              />
            </div>
            <div>
              <label for="graphYGrid">Y grid</label>
              <input
                id="graphYGrid"
                type="text"
                :value="selectedElement.yGrid"
                placeholder="1.0"
                @input="updateText('yGrid', $event)"
              />
            </div>
          </div>

          <div class="display-inspector__row">
            <div>
              <label for="graphMinRange">Min range</label>
              <input
                id="graphMinRange"
                type="number"
                :value="selectedElement.minRange"
                placeholder="0"
                @input="updateNumber('minRange', $event)"
              />
            </div>
            <div>
              <label for="graphMaxRange">Max range</label>
              <input
                id="graphMaxRange"
                type="number"
                :value="selectedElement.maxRange"
                placeholder="100"
                @input="updateNumber('maxRange', $event)"
              />
            </div>
          </div>

          <div class="display-inspector__row">
            <div>
              <label for="graphMinValue">Min value</label>
              <input
                id="graphMinValue"
                type="number"
                :value="selectedElement.minValue"
                placeholder="0"
                @input="updateNumber('minValue', $event)"
              />
            </div>
            <div>
              <label for="graphMaxValue">Max value</label>
              <input
                id="graphMaxValue"
                type="number"
                :value="selectedElement.maxValue"
                placeholder="100"
                @input="updateNumber('maxValue', $event)"
              />
            </div>
          </div>

          <div>
            <label for="graphUseTraces">Use multiple traces</label>
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
              <label for="graphLineType">Line type</label>
              <select
                id="graphLineType"
                :value="selectedElement.lineType || 'SOLID'"
                @change="updateText('lineType', $event)"
              >
                <option value="SOLID">SOLID</option>
                <option value="DOTTED">DOTTED</option>
                <option value="DASHED">DASHED</option>
              </select>
            </div>
            <div>
              <label for="graphLineThickness">Thickness</label>
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
              <label for="graphColor">Color</label>
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
              <ColorPickerModal
                :open="colorPickerOpen"
                :selected="colorInputValue"
                @close="handleColorClose"
                @select="handleColorSelect"
              />
            </div>
            <div>
              <label for="graphContinuous">Continuous</label>
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
              <strong>Traces</strong>
              <button type="button" class="secondary compact" @click="addTrace">Add trace</button>
            </div>
            <div v-if="!selectedElement.traces?.length" class="note">No traces added.</div>
            <div v-for="(trace, index) in selectedElement.traces" :key="index" class="display-trace-card">
              <div class="display-inspector__row">
                <div>
                  <label :for="`traceSensor_${index}`">Sensor</label>
                  <select
                    :id="`traceSensor_${index}`"
                    :value="trace.sensor || ''"
                    @change="updateTrace(index, 'sensor', $event.target.value)"
                  >
                    <option value="">Select sensor</option>
                    <option v-for="entry in graphSensorOptions" :key="entry.id" :value="entry.id">
                      {{ entry.label }}
                    </option>
                  </select>
                </div>
                <div>
                  <label :for="`traceName_${index}`">Name</label>
                  <input
                    :id="`traceName_${index}`"
                    type="text"
                    :value="trace.name || ''"
                    @input="updateTrace(index, 'name', $event.target.value)"
                  />
                </div>
              </div>
              <div class="display-inspector__row">
                <div>
                  <label :for="`traceLineType_${index}`">Line type</label>
                  <select
                    :id="`traceLineType_${index}`"
                    :value="trace.lineType || 'SOLID'"
                    @change="updateTrace(index, 'lineType', $event.target.value)"
                  >
                    <option value="SOLID">SOLID</option>
                    <option value="DOTTED">DOTTED</option>
                    <option value="DASHED">DASHED</option>
                  </select>
                </div>
                <div>
                  <label :for="`traceThickness_${index}`">Thickness</label>
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
                  <label :for="`traceColor_${index}`">Color</label>
                  <div class="schema-icon-row">
                    <input
                      :id="`traceColor_${index}`"
                      type="text"
                      :value="trace.color || ''"
                      placeholder="#RRGGBB"
                      @input="updateTrace(index, 'color', $event.target.value)"
                    />
                    <button
                      type="button"
                      class="secondary compact schema-icon-btn"
                      @click="openTraceColorPicker(index)"
                    >
                      <span
                        class="schema-color-icon"
                        :style="{ backgroundColor: traceColorSwatch(trace.color) }"
                      ></span>
                    </button>
                  </div>
                </div>
                <div>
                  <label :for="`traceContinuous_${index}`">Continuous</label>
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
                <button type="button" class="secondary compact" @click="removeTrace(index)">Remove</button>
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
            <label for="graphLegend">Legend</label>
            <input
              id="graphLegend"
              type="checkbox"
              class="schema-checkbox"
              :checked="Boolean(selectedElement.legendEnabled)"
              @change="handleLegendToggle"
            />
          </div>

          <div v-if="selectedElement.legendEnabled" class="display-legend">
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

            <div
              v-if="(selectedElement.legendNameFontSource || 'local') === 'local'"
              class="display-inspector__row"
            >
              <div>
                <label for="legendNameFontFile">Name font</label>
                <select
                  id="legendNameFontFile"
                  :value="selectedElement.legendNameFontFile"
                  @change="handleLegendNameFontFileChange"
                >
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

            <div
              v-else
              class="display-inspector__row"
            >
              <div>
                <label for="legendNameFontFamily">Name family</label>
                <select
                  id="legendNameFontFamily"
                  :value="selectedElement.legendNameFontFamily"
                  @change="handleLegendNameFontFamilyChange"
                >
                  <option value="">Select family</option>
                  <option v-for="font in googleFonts" :key="font.family" :value="font.family">
                    {{ font.family }}
                  </option>
                </select>
              </div>
              <div>
                <label for="legendNameFontVariant">Variant</label>
                <select
                  id="legendNameFontVariant"
                  :value="selectedElement.legendNameFontVariant || 'regular'"
                  @change="handleLegendNameFontVariantChange"
                >
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

            <div
              v-if="(selectedElement.legendValueFontSource || 'local') === 'local'"
              class="display-inspector__row"
            >
              <div>
                <label for="legendValueFontFile">Value font</label>
                <select
                  id="legendValueFontFile"
                  :value="selectedElement.legendValueFontFile"
                  @change="handleLegendValueFontFileChange"
                >
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

            <div
              v-else
              class="display-inspector__row"
            >
              <div>
                <label for="legendValueFontFamily">Value family</label>
                <select
                  id="legendValueFontFamily"
                  :value="selectedElement.legendValueFontFamily"
                  @change="handleLegendValueFontFamilyChange"
                >
                  <option value="">Select family</option>
                  <option v-for="font in googleFonts" :key="font.family" :value="font.family">
                    {{ font.family }}
                  </option>
                </select>
              </div>
              <div>
                <label for="legendValueFontVariant">Variant</label>
                <select
                  id="legendValueFontVariant"
                  :value="selectedElement.legendValueFontVariant || 'regular'"
                  @change="handleLegendValueFontVariantChange"
                >
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
                <select
                  id="legendShowValues"
                  :value="selectedElement.legendShowValues || 'AUTO'"
                  @change="updateText('legendShowValues', $event)"
                >
                  <option value="NONE">NONE</option>
                  <option value="AUTO">AUTO</option>
                  <option value="BESIDE">BESIDE</option>
                  <option value="BELOW">BELOW</option>
                </select>
              </div>
              <div>
                <label for="legendDirection">Direction</label>
                <select
                  id="legendDirection"
                  :value="selectedElement.legendDirection || 'AUTO'"
                  @change="updateText('legendDirection', $event)"
                >
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
      </template>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from "vue";
import ColorPickerModal from "../ColorPickerModal.vue";
import DisplayInspectorShape from "./DisplayInspectorShape.vue";
import DisplayInspectorIcon from "./DisplayInspectorIcon.vue";
import DisplayInspectorText from "./DisplayInspectorText.vue";
import DisplayInspectorImage from "./DisplayInspectorImage.vue";
import DisplayInspectorAnimation from "./DisplayInspectorAnimation.vue";
import { colorToCss } from "../../utils/displayColor";
import { useDisplayFontControls } from "../../composables/display/useDisplayFontControls";

const props = defineProps({
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

const colorPickerOpen = ref(false);
const traceColorPickerOpen = ref(false);
const activeTraceIndex = ref(null);

const {
  visibleLocalFonts,
  findVisibleLocalFont,
  formatFileOptionLabel,
  buildFontSourcePatch,
  buildLocalFontPatch,
  buildGoogleFamilyPatch,
  buildGoogleVariantPatch,
  buildDefaultFontDescriptor
} = useDisplayFontControls({
  localFonts: computed(() => props.localFonts),
  googleFonts: computed(() => props.googleFonts),
  assetsBase: computed(() => props.assetsBase)
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

const addTrace = () => {
  const next = [
    ...(props.selectedElement?.traces || []),
    {
      sensor: "",
      name: "",
      lineType: "SOLID",
      lineThickness: 3,
      continuous: false,
      color: ""
    }
  ];
  emit("update", { traces: next });
};

const updateTrace = (index, key, value) => {
  const next = [...(props.selectedElement?.traces || [])];
  const current = next[index] || {};
  next[index] = { ...current, [key]: value };
  emit("update", { traces: next });
};

const removeTrace = (index) => {
  const next = [...(props.selectedElement?.traces || [])];
  next.splice(index, 1);
  emit("update", { traces: next });
};

const colorInputValue = computed(() => props.selectedElement?.color || "");

const colorSwatch = computed(() => {
  if (!colorInputValue.value) return "#ffffff";
  return colorToCss(colorInputValue.value, "#ffffff");
});

const traceColorSwatch = (value) => colorToCss(value || "", "#ffffff");

const activeTraceColor = computed(() => {
  const index = activeTraceIndex.value;
  if (index === null || index === undefined) return "";
  const traces = props.selectedElement?.traces || [];
  return traces[index]?.color || "";
});

const graphSensorOptions = computed(() =>
  (props.dynamicIds || [])
    .filter((entry) => entry.domain === "sensor")
    .map((entry) => ({ id: entry.id, label: entry.label }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

const graphIdRequiredError = computed(() => {
  if (props.selectedElement?.type !== "graph") return false;
  return !String(props.selectedElement?.graphId || "").trim();
});

const graphDurationRequiredError = computed(() => {
  if (props.selectedElement?.type !== "graph") return false;
  return !String(props.selectedElement?.duration || "").trim();
});

const graphSensorRequiredError = computed(() => {
  if (props.selectedElement?.type !== "graph") return false;
  if (props.selectedElement?.useTraces) return false;
  if (!graphSensorOptions.value.length) return true;
  const selected = props.selectedElement?.sensor || "";
  if (!selected) return true;
  return !graphSensorOptions.value.some((entry) => entry.id === selected);
});

const graphSensorErrorText = computed(() => {
  if (!graphSensorOptions.value.length) return "No sensor IDs available.";
  return "Please select a sensor ID.";
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

const openTraceColorPicker = (index) => {
  activeTraceIndex.value = index;
  traceColorPickerOpen.value = true;
};

const handleTraceColorClose = () => {
  traceColorPickerOpen.value = false;
  activeTraceIndex.value = null;
};

const handleTraceColorSelect = (value) => {
  const index = activeTraceIndex.value;
  if (index !== null && index !== undefined) {
    updateTrace(index, "color", value || "");
  }
  traceColorPickerOpen.value = false;
  activeTraceIndex.value = null;
};

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

.display-inspector__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.display-inspector__row input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.display-inspector__row input[type="number"]::-webkit-outer-spin-button,
.display-inspector__row input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.display-inspector__row--quad {
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto repeat(2, minmax(0, 1fr));
  align-items: end;
}

.display-inspector__field {
  min-width: 0;
}

.display-inspector__group-divider {
  width: 1px;
  height: 48px;
  background: var(--border);
  align-self: center;
}

.field-error {
  border-color: #ef4444;
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.4);
}

.field-error-text {
  margin-top: 4px;
  color: #ef4444;
  font-size: 11px;
}

select.field-error {
  color: var(--navy);
}

.display-trace-list {
  display: grid;
  gap: 10px;
}

.display-trace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.display-trace-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
  display: grid;
  gap: 10px;
}

.display-trace-actions {
  display: flex;
  justify-content: flex-end;
}

.display-legend {
  display: grid;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
}

.display-icon-picker input {
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
