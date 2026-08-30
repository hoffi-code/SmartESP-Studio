// Generic emit('update', patch) helpers shared by the DisplayInspector element panels.
export function useElementPatch(emit, selectedElement, { lockAspectRatioOnResize = false } = {}) {
  const updateNumber = (key, event) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    if (lockAspectRatioOnResize && ["w", "h"].includes(key)) {
      const currentW = Number(selectedElement.value?.w || 0);
      const currentH = Number(selectedElement.value?.h || 0);
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

  const updateBool = (key, event) => {
    emit("update", { [key]: event.target.checked });
  };

  const updateBoolSelect = (key, event, { invertAliasKey } = {}) => {
    const next = event.target.value === "true";
    if (invertAliasKey) {
      emit("update", { [key]: next, [invertAliasKey]: next });
      return;
    }
    emit("update", { [key]: next });
  };

  const updatePatch = (patch) => {
    emit("update", patch);
  };

  return { updateNumber, updateText, updateBool, updateBoolSelect, updatePatch };
}
