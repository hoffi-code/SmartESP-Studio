import { computed, ref } from "vue";

import { buildEntityStateMap, setEntityField, setEntityValue } from "../../utils/simulationEntityState";

// Duenner ref-Wrapper um die reinen Funktionen in simulationEntityState.js -- gleiches
// Muster wie useBuilderValidation.js -> builderValidationRules.js. Wird einmalig in
// BuilderView.vue instanziiert und wie idIndex als Prop an die Simulation-UI sowie an
// LvglCanvas/DisplayCanvas fuer die Live-Bindung (P8/P9) durchgereicht.
export const useSimulation = ({ idIndex, config }) => {
  const entityState = ref({});
  const initialized = ref(false);

  const resetSimulation = () => {
    entityState.value = buildEntityStateMap(idIndex.value, config.value);
    initialized.value = true;
  };

  // Erster Zugriff baut den Zustand lazily auf -- Instanziierung in BuilderView passiert
  // unabhaengig davon, ob der Simulation-Tab je geoeffnet wird.
  const ensureInitialized = () => {
    if (!initialized.value) resetSimulation();
  };

  const entities = computed(() => {
    ensureInitialized();
    return Object.values(entityState.value);
  });

  const entityById = (id) => {
    ensureInitialized();
    return entityState.value[id] || null;
  };

  // ref() ist in Vue 3 fuer Objektwerte tief reaktiv -- direkte Mutation reicht, kein
  // Neuzuweisen des ganzen Maps noetig (gleiches Muster wie config.value.foo = x im Rest
  // des Projekts).
  const setValue = (id, value) => {
    ensureInitialized();
    setEntityValue(entityState.value, id, value);
  };

  const setField = (id, fieldKey, value) => {
    ensureInitialized();
    setEntityField(entityState.value, id, fieldKey, value);
  };

  return {
    entityState,
    entities,
    entityById,
    setValue,
    setField,
    resetSimulation,
    ensureInitialized
  };
};
