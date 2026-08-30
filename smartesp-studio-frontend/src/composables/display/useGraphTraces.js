import { computed, ref } from "vue";
import { colorToCss } from "../../utils/displayColor";

// Trace CRUD + per-trace color-picker state for a multi-trace graph element.
export function useGraphTraces(emit, selectedElement) {
  const traceColorPickerOpen = ref(false);
  const activeTraceIndex = ref(null);

  const addTrace = () => {
    const next = [
      ...(selectedElement.value?.traces || []),
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
    const next = [...(selectedElement.value?.traces || [])];
    const current = next[index] || {};
    next[index] = { ...current, [key]: value };
    emit("update", { traces: next });
  };

  const removeTrace = (index) => {
    const next = [...(selectedElement.value?.traces || [])];
    next.splice(index, 1);
    emit("update", { traces: next });
  };

  const traceColorSwatch = (value) => colorToCss(value || "", "#ffffff");

  const activeTraceColor = computed(() => {
    const index = activeTraceIndex.value;
    if (index === null || index === undefined) return "";
    const traces = selectedElement.value?.traces || [];
    return traces[index]?.color || "";
  });

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

  return {
    traceColorPickerOpen,
    addTrace,
    updateTrace,
    removeTrace,
    traceColorSwatch,
    activeTraceColor,
    openTraceColorPicker,
    handleTraceColorClose,
    handleTraceColorSelect
  };
}
