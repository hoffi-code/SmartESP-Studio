import { computed } from "vue";
import { allowedTransparencyForType, supportsByteOrder, supportsDither, supportsInvertAlpha } from "../../utils/displayImageEncoding";

// Shared encoding + probe-and-autosize logic for image/animation elements.
// `normalizeEncoding` is normalizeImageElementEncoding or normalizeAnimationElementEncoding,
// `typeKey` is the encoding field it derives ("imageType" / "animationType").
export function useDisplayImageField({ selectedElement, screenW, screenH, normalizeEncoding, typeKey }) {
  const selectedType = computed(() => normalizeEncoding(selectedElement.value || {})[typeKey]);

  const transparencyOptions = computed(() => allowedTransparencyForType(selectedType.value));
  const elementSupportsInvertAlpha = computed(() => supportsInvertAlpha(selectedType.value));
  const elementSupportsDither = computed(() => supportsDither(selectedType.value));
  const elementSupportsByteOrder = computed(() => supportsByteOrder(selectedType.value));

  const buildTypeChangePatch = (value) =>
    normalizeEncoding({ ...(selectedElement.value || {}), [typeKey]: value });

  const probeAndScale = (url, onScaled) => {
    if (!url) return;
    const probe = new Image();
    probe.src = url;
    probe.onload = () => {
      const width = probe.naturalWidth || probe.width || 0;
      const height = probe.naturalHeight || probe.height || 0;
      if (!width || !height) return;
      let nextW = width;
      let nextH = height;
      const maxW = Number(screenW.value || 0);
      const maxH = Number(screenH.value || 0);
      if (maxW > 0 && maxH > 0 && (width > maxW || height > maxH)) {
        const scale = Math.min(maxW / width, maxH / height, 1);
        nextW = Math.max(1, Math.round(width * scale));
        nextH = Math.max(1, Math.round(height * scale));
      }
      onScaled({ w: nextW, h: nextH });
    };
  };

  return {
    selectedType,
    transparencyOptions,
    supportsInvertAlpha: elementSupportsInvertAlpha,
    supportsDither: elementSupportsDither,
    supportsByteOrder: elementSupportsByteOrder,
    buildTypeChangePatch,
    probeAndScale
  };
}
