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
      <label for="imageValue">Image</label>
      <select
        id="imageValue"
        :value="selectedElement.image"
        :class="{ 'field-error': imageFileRequiredError }"
        @change="handleImageChange"
      >
        <option value="">Select image</option>
        <option v-for="image in images" :key="image.file" :value="image.file" :title="image.file">
          {{ formatFileOptionLabel(image.file) }}
        </option>
      </select>
      <div v-if="imageFileRequiredError" class="field-error-text">
        {{ imageFileErrorText }}
      </div>
    </div>

    <div>
      <label for="imageType">Image type</label>
      <select id="imageType" :value="selectedImageType" @change="handleImageTypeChange">
        <option v-for="type in imageTypes" :key="`image-type-${type}`" :value="type">{{ type }}</option>
      </select>
    </div>

    <div>
      <label for="imageTransparency">Transparency</label>
      <select
        id="imageTransparency"
        :value="selectedElement.imageTransparency || 'opaque'"
        @change="updateText('imageTransparency', $event)"
      >
        <option v-for="value in imageTransparencyOptions" :key="`image-transparency-${value}`" :value="value">
          {{ value }}
        </option>
      </select>
    </div>

    <div v-if="supportsInvertAlpha">
      <label for="imageInvertAlpha">invert_alpha</label>
      <select
        id="imageInvertAlpha"
        :value="Boolean(selectedElement.imageInvertAlpha ?? selectedElement.invert).toString()"
        @change="updateBoolSelect('imageInvertAlpha', $event, { invertAliasKey: 'invert' })"
      >
        <option value="true">TRUE</option>
        <option value="false">FALSE</option>
      </select>
    </div>

    <div v-if="supportsDither">
      <label for="imageDither">Dither</label>
      <select
        id="imageDither"
        :value="selectedElement.imageDither || 'NONE'"
        @change="updateText('imageDither', $event)"
      >
        <option v-for="value in ditherValues" :key="`image-dither-${value}`" :value="value">{{ value }}</option>
      </select>
    </div>

    <div v-if="supportsByteOrder">
      <label for="imageByteOrder">byte_order</label>
      <select
        id="imageByteOrder"
        :value="selectedElement.imageByteOrder || 'big_endian'"
        @change="updateText('imageByteOrder', $event)"
      >
        <option v-for="value in byteOrderValues" :key="`image-byte-order-${value}`" :value="value">{{ value }}</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  DISPLAY_DITHER_VALUES,
  DISPLAY_IMAGE_TYPES,
  DISPLAY_BYTE_ORDER_VALUES,
  normalizeImageElementEncoding
} from "../../utils/displayImageEncoding";
import { useDisplayImageField } from "../../composables/display/useDisplayImageField";
import { useElementPatch } from "../../composables/display/useElementPatch";

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
  selectedType: selectedImageType,
  transparencyOptions: imageTransparencyOptions,
  supportsInvertAlpha,
  supportsDither,
  supportsByteOrder,
  buildTypeChangePatch,
  probeAndScale
} = useDisplayImageField({
  selectedElement: selectedElementRef,
  screenW: computed(() => props.screenW),
  screenH: computed(() => props.screenH),
  normalizeEncoding: normalizeImageElementEncoding,
  typeKey: "imageType"
});

const imageTypes = DISPLAY_IMAGE_TYPES;
const ditherValues = DISPLAY_DITHER_VALUES;
const byteOrderValues = DISPLAY_BYTE_ORDER_VALUES;

const formatFileOptionLabel = (value, maxLength = 28) => {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

const imageFiles = computed(() =>
  (props.images || [])
    .map((item) => item?.file || "")
    .filter((file) => Boolean(file))
    .sort((a, b) => a.localeCompare(b))
);

const imageFileRequiredError = computed(() => {
  if (!imageFiles.value.length) return true;
  const selected = props.selectedElement?.image || "";
  if (!selected) return true;
  return !imageFiles.value.includes(selected);
});

const imageFileErrorText = computed(() => {
  if (!imageFiles.value.length) return "No image files available.";
  return "Please select an image file.";
});

const handleImageTypeChange = (event) => {
  emit("update", buildTypeChangePatch(event.target.value));
};

const handleImageChange = (event) => {
  const file = event.target.value;
  const image = props.images.find((item) => item.file === file);
  const imageUrl = image?.file ? `${props.assetsBase}images/${image.file}` : "";
  emit("update", { image: image?.file || "", imageUrl });
  probeAndScale(imageUrl, (sizePatch) => emit("update", sizePatch));
};
</script>
