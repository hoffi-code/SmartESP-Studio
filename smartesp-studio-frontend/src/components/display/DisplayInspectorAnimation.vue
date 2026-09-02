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

    <div>
      <label for="animationId">{{ t('display.animation.idLabel') }}</label>
      <input
        id="animationId"
        type="text"
        :value="selectedElement.animationId"
        placeholder="animation_id"
        :class="{ 'field-error': animationIdRequiredError }"
        @input="updateText('animationId', $event)"
      />
      <div v-if="animationIdRequiredError" class="field-error-text">
        {{ t('display.animation.idRequired') }}
      </div>
    </div>

    <div>
      <label for="animationFile">{{ t('display.animation.fileLabel') }}</label>
      <select
        id="animationFile"
        :value="selectedElement.animationFile"
        :class="{ 'field-error': animationFileRequiredError }"
        @change="handleAnimationFileChange"
      >
        <option value="">{{ t('display.option.selectAnimation') }}</option>
        <option v-for="file in animationFiles" :key="file" :value="file" :title="file">
          {{ formatFileOptionLabel(file) }}
        </option>
      </select>
      <div v-if="animationFileRequiredError" class="field-error-text">
        {{ animationFileErrorText }}
      </div>
    </div>

    <div>
      <label for="animationType">{{ t('display.animation.type') }}</label>
      <select id="animationType" :value="selectedAnimationType" @change="handleAnimationTypeChange">
        <option v-for="type in imageTypes" :key="`animation-type-${type}`" :value="type">{{ type }}</option>
      </select>
    </div>

    <div>
      <label for="animationTransparency">{{ t('display.animation.transparency') }}</label>
      <select
        id="animationTransparency"
        :value="selectedElement.animationTransparency || 'opaque'"
        @change="updateText('animationTransparency', $event)"
      >
        <option v-for="value in animationTransparencyOptions" :key="`animation-transparency-${value}`" :value="value">
          {{ value }}
        </option>
      </select>
    </div>

    <div v-if="supportsInvertAlpha">
      <label for="animationInvertAlpha">invert_alpha</label>
      <select
        id="animationInvertAlpha"
        :value="Boolean(selectedElement.animationInvertAlpha).toString()"
        @change="updateBoolSelect('animationInvertAlpha', $event)"
      >
        <option value="true">TRUE</option>
        <option value="false">FALSE</option>
      </select>
    </div>

    <div v-if="supportsDither">
      <label for="animationDither">{{ t('display.animation.dither') }}</label>
      <select
        id="animationDither"
        :value="selectedElement.animationDither || 'NONE'"
        @change="updateText('animationDither', $event)"
      >
        <option v-for="value in ditherValues" :key="`animation-dither-${value}`" :value="value">{{ value }}</option>
      </select>
    </div>

    <div v-if="supportsByteOrder">
      <label for="animationByteOrder">byte_order</label>
      <select
        id="animationByteOrder"
        :value="selectedElement.animationByteOrder || 'big_endian'"
        @change="updateText('animationByteOrder', $event)"
      >
        <option v-for="value in byteOrderValues" :key="`animation-byte-order-${value}`" :value="value">{{ value }}</option>
      </select>
    </div>

    <div class="display-inspector__row">
      <div>
        <label for="animationLoop">{{ t('display.animation.loop') }}</label>
        <select
          id="animationLoop"
          :value="Boolean(selectedElement.loopEnabled).toString()"
          @change="updateBoolSelect('loopEnabled', $event)"
        >
          <option value="true">TRUE</option>
          <option value="false">FALSE</option>
        </select>
      </div>
      <div>
        <label for="animationAuto">{{ t('display.animation.autoAnimate') }}</label>
        <select
          id="animationAuto"
          :value="Boolean(selectedElement.autoAnimate).toString()"
          @change="updateBoolSelect('autoAnimate', $event)"
        >
          <option value="true">TRUE</option>
          <option value="false">FALSE</option>
        </select>
      </div>
    </div>

    <div v-if="selectedElement.autoAnimate">
      <label for="animationInterval">{{ t('display.animation.interval') }}</label>
      <input
        id="animationInterval"
        type="number"
        :value="selectedElement.intervalMs"
        placeholder="200"
        @input="updateNumber('intervalMs', $event)"
      />
    </div>

    <div v-if="selectedElement.loopEnabled" class="display-inspector__row">
      <div>
        <label for="animationLoopStart">{{ t('display.animation.startFrame') }}</label>
        <input
          id="animationLoopStart"
          type="number"
          :value="selectedElement.loopStart"
          placeholder="0"
          @input="updateNumber('loopStart', $event)"
        />
      </div>
      <div>
        <label for="animationLoopEnd">{{ t('display.animation.endFrame') }}</label>
        <input
          id="animationLoopEnd"
          type="number"
          :value="selectedElement.loopEnd"
          placeholder="10"
          @input="updateNumber('loopEnd', $event)"
        />
      </div>
    </div>

    <div v-if="selectedElement.loopEnabled">
      <label for="animationLoopRepeat">{{ t('display.animation.repeat') }}</label>
      <input
        id="animationLoopRepeat"
        type="number"
        :value="selectedElement.loopRepeat"
        placeholder="0"
        @input="updateNumber('loopRepeat', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  DISPLAY_DITHER_VALUES,
  DISPLAY_IMAGE_TYPES,
  DISPLAY_BYTE_ORDER_VALUES,
  normalizeAnimationElementEncoding
} from "../../utils/displayImageEncoding";
import { useDisplayImageField } from "../../composables/display/useDisplayImageField";
import { useElementPatch } from "../../composables/display/useElementPatch";

const { t } = useI18n();

const props = defineProps({
  selectedElement: {
    type: Object,
    required: true
  },
  images: {
    type: Array,
    default: () => []
  },
  assetsBase: {
    type: String,
    default: "/"
  },
  screenW: {
    type: Number,
    default: 0
  },
  screenH: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(["update"]);

const selectedElementRef = computed(() => props.selectedElement);
const { updateNumber, updateText, updateBoolSelect } = useElementPatch(emit, selectedElementRef, {
  lockAspectRatioOnResize: true
});

const {
  selectedType: selectedAnimationType,
  transparencyOptions: animationTransparencyOptions,
  supportsInvertAlpha,
  supportsDither,
  supportsByteOrder,
  buildTypeChangePatch,
  probeAndScale
} = useDisplayImageField({
  selectedElement: selectedElementRef,
  screenW: computed(() => props.screenW),
  screenH: computed(() => props.screenH),
  normalizeEncoding: normalizeAnimationElementEncoding,
  typeKey: "animationType"
});

const imageTypes = DISPLAY_IMAGE_TYPES;
const ditherValues = DISPLAY_DITHER_VALUES;
const byteOrderValues = DISPLAY_BYTE_ORDER_VALUES;

const formatFileOptionLabel = (value, maxLength = 28) => {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

const animationFiles = computed(() =>
  (props.images || [])
    .map((item) => item?.file || "")
    .filter((file) => file.toLowerCase().endsWith(".gif"))
    .sort((a, b) => a.localeCompare(b))
);

const animationIdRequiredError = computed(() => !String(props.selectedElement?.animationId || "").trim());

const animationFileRequiredError = computed(() => {
  if (!animationFiles.value.length) return true;
  const selected = props.selectedElement?.animationFile || "";
  if (!selected) return true;
  return !animationFiles.value.includes(selected);
});

const animationFileErrorText = computed(() => {
  if (!animationFiles.value.length) return t("display.animation.noFiles");
  return t("display.animation.selectFile");
});

const handleAnimationTypeChange = (event) => {
  emit("update", buildTypeChangePatch(event.target.value));
};

const handleAnimationFileChange = (event) => {
  const file = event.target.value;
  const animationUrl = file ? `${props.assetsBase}images/${file}` : "";
  emit("update", { animationFile: file, animationUrl });
  probeAndScale(animationUrl, (sizePatch) => emit("update", sizePatch));
};
</script>
