import { computed, ref, watch } from "vue";

import { buildEntityStateMap, setEntityField, setEntityValue } from "../../utils/simulationEntityState";
import { collectSimulationTriggers } from "../../utils/simulationAutomation";
import { evaluateConditionList } from "../../utils/simulationConditions";
import { parseDuration } from "../../utils/simulationDuration";
import {
  intervalTriggers,
  resumeManualRun,
  resumeWaitingRun,
  startActionChain,
  triggersForEntity
} from "../../utils/simulationDriver";
import {
  FILTER_DROP,
  FILTER_MANUAL,
  FILTER_PENDING,
  applyBinarySensorFilter,
  applySensorFilter,
  runFilterChain
} from "../../utils/simulationFilters";
import { useVirtualClock } from "./useVirtualClock";

const LOG_LIMIT = 200;

let nextLogId = 1;
let nextManualFilterId = 1;

// Duenner ref-Wrapper um die reinen Funktionen aus simulationEntityState.js/
// simulationDriver.js/simulationFilters.js -- gleiches Muster wie useBuilderValidation.js
// -> builderValidationRules.js. Wird einmalig in BuilderView.vue instanziiert und wie
// idIndex als Prop an die Simulation-UI sowie an LvglCanvas/DisplayCanvas fuer die
// Live-Bindung (P8/P9) durchgereicht.
//
// Der Treiber verbindet hier die in P1-P6 einzeln getesteten Engine-Teile: eine Roh-
// wertaenderung laeuft durch die Filterkette einer Entity (simulationFilters.js), das
// Ergebnis loest passende Trigger aus (simulationAutomation.js/simulationDriver.js), deren
// Action-Ketten ueber mehrere Uhr-Ticks pausieren koennen (simulationExecutor.js). Ein
// Uhr-Tick (watch auf clock.currentTick) holt faellige Ereignisse ab (clock.drainDue) und
// setzt wartende Ketten/Filter fort.
export const useSimulation = ({ idIndex, config, automationSources }) => {
  const entityState = ref({});
  const initialized = ref(false);
  const clock = useVirtualClock();

  // entityId -> [{ ...Filter-Instanz-Zustand }] -- Index = Position in entity.filters,
  // ueber mehrere runFilterChain-Aufrufe hinweg wiederverwendet (delta/skip_initial/
  // Fenster-Puffer/zeitbasierte Filter brauchen das).
  const filterRuntimeState = ref({});
  // Aktive Action-Ketten (simulationDriver.js-runs), die gerade auf einen Uhr-Tick
  // (status "waiting") oder eine manuelle Eingabe (status "manual") warten. Fertige Laeufe
  // werden entfernt -- ihr Ausgang steht bereits im Log.
  const runs = ref([]);
  // Lambda-Sensor-/Binary-Sensor-Filter liefern nie automatisch -- ein Eintrag pro
  // wartendem manuellen Filterpunkt, damit die UI einen "Wert eingeben"-Dialog anbieten kann.
  const manualFilters = ref([]);
  // Flaches Log fuer die Datenfluss-Anzeige (P7): Trigger gefeuert, Action ausgefuehrt/
  // uebersprungen, Filter verworfen/manuell, Wert publiziert. Neueste Eintraege am Ende.
  const log = ref([]);

  // eventId -> { entityId, filterIndex }. Ausserhalb von entityState/filterRuntimeState
  // gehalten, weil scheduleAt()-Ereignisse aus simulationFilters.js selbst keine Entity
  // kennen (die Filterfunktionen sind rein value/config/state/ctx-basiert) -- der Treiber
  // muss sich diese Zuordnung deshalb selbst merken. Nicht reaktiv, reine Buchhaltung.
  const pendingFilterEvents = new Map();

  const resetSimulation = () => {
    entityState.value = buildEntityStateMap(idIndex.value, config.value);
    filterRuntimeState.value = {};
    pendingFilterEvents.clear();
    runs.value = [];
    manualFilters.value = [];
    log.value = [];
    clock.reset();
    initialized.value = true;
    armIntervalTriggers();
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

  const pushLog = (entry) => {
    log.value.push({ id: nextLogId++, tick: clock.currentTick.value, ...entry });
    if (log.value.length > LOG_LIMIT) log.value = log.value.slice(log.value.length - LOG_LIMIT);
  };

  const scriptsIndex = computed(() => {
    const map = {};
    (config.value?.automation?.script || []).forEach((entry) => {
      if (entry?.id) map[entry.id] = Array.isArray(entry.then) ? entry.then : [];
    });
    return map;
  });

  const triggers = computed(() => collectSimulationTriggers({ sources: automationSources?.value || [] }));
  const manualTriggers = computed(() => triggers.value.filter((trigger) => trigger.manual));

  const buildRunCtx = () => ({
    entityState: entityState.value,
    evaluateConditionList,
    clock,
    conditionCtx: {},
    scripts: scriptsIndex.value
  });

  const logRunEntries = (meta, entries) => {
    entries.forEach((step) => {
      if (step.type !== "executed" && step.type !== "skipped") return;
      pushLog({ ...meta, kind: step.type, text: step.action?.type || "" });
    });
  };

  // Haelt runs.value + Uhr-Planung/Log fuer den aktuellen Status eines Laufs synchron --
  // gemeinsamer Endpunkt fuer startActionChain/resumeManualRun/resumeWaitingRun.
  const activateRun = (run) => {
    if (run.status === "done") {
      runs.value = runs.value.filter((entry) => entry.id !== run.id);
      return;
    }
    if (!runs.value.some((entry) => entry.id === run.id)) runs.value.push(run);
    if (run.status === "waiting") {
      clock.scheduleAt(run.untilTick, "action-resume", { runId: run.id });
    } else if (run.status === "manual") {
      pushLog({
        ...run.meta,
        kind: "manual",
        text: run.manualReason === "lambda" ? "lambda" : "condition",
        runId: run.id
      });
    }
  };

  const fireTrigger = (trigger) => {
    const meta = { sourceLabel: trigger.sourceLabel, triggerKey: trigger.triggerKey };
    pushLog({ ...meta, kind: "trigger" });
    const { run, entries } = startActionChain(trigger.actions, buildRunCtx(), meta);
    logRunEntries(meta, entries);
    activateRun(run);
  };

  const fireTriggersForEntity = (entity) => {
    triggersForEntity(triggers.value, entity).forEach(fireTrigger);
  };

  // Setzt eine an lambda/einer unaufloesbaren Bedingung pausierte Action-Kette mit dem vom
  // Nutzer gelieferten Ergebnis fort ("Manuell ausloesen" in der UI).
  const resumeManual = (runId, value) => {
    const run = runs.value.find((entry) => entry.id === runId);
    if (!run) return;
    const entries = resumeManualRun(run, value);
    logRunEntries(run.meta, entries);
    activateRun(run);
  };

  const resumeWaiting = (run) => {
    const entries = resumeWaitingRun(run);
    logRunEntries(run.meta, entries);
    activateRun(run);
  };

  // interval: ist zeitgetrieben statt entity-getrieben -- eigene Uhr-Planung, relativ zum
  // faelligen Tick statt "jetzt" neu aufgesetzt, damit sich keine Drift aufbaut.
  const scheduleIntervalTick = (trigger, fromTick, explicitDurationMs) => {
    let durationMs = explicitDurationMs;
    if (durationMs === undefined) {
      const index = trigger.path?.[1];
      const item = (config.value?.automation?.interval || [])[index];
      durationMs = parseDuration(item?.interval, 0);
    }
    if (!durationMs || durationMs <= 0) return;
    clock.scheduleAt(fromTick + durationMs, "interval-trigger", { trigger, durationMs });
  };

  const armIntervalTriggers = () => {
    intervalTriggers(triggers.value).forEach((trigger) => scheduleIntervalTick(trigger, clock.currentTick.value));
  };

  const applyOneFor = (entity) => (entity.domain === "binary_sensor" ? applyBinarySensorFilter : applySensorFilter);

  const ensureFilterState = (entityId) => {
    if (!filterRuntimeState.value[entityId]) filterRuntimeState.value[entityId] = [];
    return filterRuntimeState.value[entityId];
  };

  const findPendingIndex = (runtimeState, fromIndex) => {
    for (let i = fromIndex; i < runtimeState.length; i += 1) {
      if (runtimeState[i]?.pendingId !== undefined) return i;
    }
    return -1;
  };

  const registerPendingFilterEvent = (entity, runtimeState, fromIndex) => {
    const index = findPendingIndex(runtimeState, fromIndex);
    if (index < 0) return;
    pendingFilterEvents.set(runtimeState[index].pendingId, { entityId: entity.id, filterIndex: index });
  };

  const finishFilterRun = (entity, result) => {
    if (result === FILTER_DROP) {
      pushLog({ sourceLabel: entity.id, kind: "filter-drop" });
      return;
    }
    if (result === FILTER_MANUAL) {
      const manualId = nextManualFilterId++;
      manualFilters.value.push({ id: manualId, entityId: entity.id });
      pushLog({ sourceLabel: entity.id, kind: "manual", text: "lambda-filter", manualFilterId: manualId });
      return;
    }
    if (result === FILTER_PENDING) return; // selbst ueber die Uhr eingeplant, siehe oben
    setEntityValue(entityState.value, entity.id, result);
    pushLog({ sourceLabel: entity.id, kind: "value", text: String(result) });
    fireTriggersForEntity(entity);
  };

  const runEntityFilters = (entity, rawValue, startIndex = 0) => {
    const filters = entity.filters || [];
    if (!filters.length) {
      setEntityValue(entityState.value, entity.id, rawValue);
      fireTriggersForEntity(entity);
      return;
    }
    const runtimeState = ensureFilterState(entity.id);
    const result = runFilterChain(filters, rawValue, runtimeState, { clock }, startIndex, applyOneFor(entity));
    if (result === FILTER_PENDING) registerPendingFilterEvent(entity, runtimeState, startIndex);
    finishFilterRun(entity, result);
  };

  // heartbeat/throttle_average emittieren periodisch, ohne dass ein neuer Rohwert
  // hereinkommt -- der Filter selbst plant sich beim normalen Kettendurchlauf nur EINMAL
  // ein (state.pendingId-Wache). Der Treiber liest deshalb bei Faelligkeit den zuletzt
  // gemerkten Wert direkt (state.lastValue bzw. den Mittelwert aus sum/count), setzt die
  // Kette dahinter fort und plant die naechste Periode selbst neu -- die Dauer dafuer
  // (config.period bzw. config.value) ist dieselbe wie in simulationFilters.js, hier
  // bewusst dupliziert statt die Filterfunktion erneut aufzurufen (die wuerde ohne echten
  // Rohwert nur wieder PENDING liefern, ohne den faelligen Wert zu publizieren).
  const handleFilterHeartbeat = (entityId, filterIndex) => {
    const entity = entityState.value[entityId];
    if (!entity) return;
    const filterEntry = (entity.filters || [])[filterIndex];
    const runtimeState = ensureFilterState(entityId);
    const state = runtimeState[filterIndex] || {};
    runtimeState[filterIndex] = state;
    state.pendingId = undefined;

    let published;
    let nextDurationMs;
    if (filterEntry?.type === "throttle_average") {
      published = state.count ? state.sum / state.count : 0;
      state.sum = 0;
      state.count = 0;
      nextDurationMs = parseDuration(filterEntry.config?.value);
    } else {
      published = state.lastValue ?? 0;
      nextDurationMs = parseDuration(filterEntry?.config?.period);
    }

    if (nextDurationMs > 0) {
      const eventId = clock.scheduleAt(clock.currentTick.value + nextDurationMs, "filter-heartbeat", {});
      state.pendingId = eventId;
      pendingFilterEvents.set(eventId, { entityId, filterIndex });
    }

    runEntityFilters(entity, published, filterIndex + 1);
  };

  // Lambda-Sensor-/Binary-Sensor-Filter sind meist der letzte Schritt vor der Publikation
  // (kein Interpreter im Projekt, siehe simulationFilters.js) -- der manuelle Fallback laesst
  // den Nutzer direkt den publizierten Wert liefern, statt die Restkette ab dort fortzusetzen.
  const resolveManualFilter = (manualId, value) => {
    const index = manualFilters.value.findIndex((entry) => entry.id === manualId);
    if (index < 0) return;
    const entry = manualFilters.value[index];
    manualFilters.value = manualFilters.value.filter((item) => item.id !== manualId);
    const entity = entityState.value[entry.entityId];
    if (!entity) return;
    setEntityValue(entityState.value, entity.id, value);
    pushLog({ sourceLabel: entity.id, kind: "value", text: String(value) });
    fireTriggersForEntity(entity);
  };

  // Roh-Wertaenderung eines Tier-1-Skalars (sensor/number/binary_sensor/switch/...) --
  // laeuft durch die Filterkette der Entity (leer = Passthrough) und loest bei einem
  // publizierten Ergebnis passende Trigger aus. globals/unsupported kennen keine Filter
  // und keine Trigger-Bindung, werden nur direkt gesetzt.
  const setValue = (id, value) => {
    ensureInitialized();
    const entity = entityState.value[id];
    if (!entity) return;
    if (entity.kind === "globals" || entity.kind === "unsupported") {
      setEntityValue(entityState.value, id, value);
      return;
    }
    runEntityFilters(entity, value);
  };

  // Manuelles Setzen eines struct-Feldes (light/cover/fan/climate/valve) in der Tabelle --
  // simuliert einen Zustandswechsel am Geraet selbst (z.B. jemand schaltet die Lampe von
  // Hand), keine Filterkette dafuer vorgesehen, loest aber genauso Trigger aus.
  const setField = (id, fieldKey, value) => {
    ensureInitialized();
    setEntityField(entityState.value, id, fieldKey, value);
    const entity = entityState.value[id];
    if (entity) fireTriggersForEntity(entity);
  };

  const processDueClockEvents = () => {
    const due = clock.drainDue();
    due.forEach((event) => {
      if (event.kind === "action-resume") {
        const run = runs.value.find((entry) => entry.id === event.payload.runId);
        if (run) resumeWaiting(run);
        return;
      }
      if (event.kind === "interval-trigger") {
        fireTrigger(event.payload.trigger);
        scheduleIntervalTick(event.payload.trigger, event.dueTick, event.payload.durationMs);
        return;
      }
      if (event.kind === "filter-resume") {
        const owner = pendingFilterEvents.get(event.id);
        pendingFilterEvents.delete(event.id);
        if (!owner) return;
        const entity = entityState.value[owner.entityId];
        if (entity) runEntityFilters(entity, event.payload.value, owner.filterIndex + 1);
        return;
      }
      if (event.kind === "filter-heartbeat") {
        const owner = pendingFilterEvents.get(event.id);
        pendingFilterEvents.delete(event.id);
        if (owner) handleFilterHeartbeat(owner.entityId, owner.filterIndex);
      }
    });
  };

  // flush: "sync" -- ein Uhr-Tick soll seine faelligen Ereignisse noch innerhalb desselben
  // Ticks abarbeiten, nicht erst nach dem naechsten DOM-Update-Zyklus.
  watch(clock.currentTick, processDueClockEvents, { flush: "sync" });

  return {
    entityState,
    entities,
    entityById,
    setValue,
    setField,
    resetSimulation,
    ensureInitialized,
    clock,
    log,
    runs,
    manualFilters,
    triggers,
    manualTriggers,
    fireTrigger,
    resumeManual,
    resolveManualFilter
  };
};
