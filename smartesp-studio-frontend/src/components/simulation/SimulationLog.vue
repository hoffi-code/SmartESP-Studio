<template>
  <div class="sim-log">
    <p v-if="!entries.length" class="sim-log__empty">{{ t("builder.simulation.log.empty") }}</p>

    <div v-for="entry in entries" :key="entry.id" class="sim-log__row">
      <span class="sim-log__tick">{{ formatTick(entry.tick) }}</span>

      <span class="sim-log__chip" :class="chipClass(entry.kind)">{{ chipLabel(entry.kind) }}</span>

      <span class="sim-log__flow">
        <span v-if="entry.sourceLabel" class="sim-log__source">{{ entry.sourceLabel }}</span>
        <span v-if="entry.triggerKey" class="sim-log__arrow">→</span>
        <span v-if="entry.triggerKey" class="sim-log__trigger-key">{{ entry.triggerKey }}</span>
        <span v-if="entry.text && entry.kind !== 'manual'" class="sim-log__arrow">→</span>
        <code v-if="entry.text && entry.kind !== 'manual'" class="sim-log__action">{{ entry.text }}</code>
      </span>

      <div v-if="entry.kind === 'manual' && isRunResolvable(entry.runId)" class="sim-log__manual">
        <span class="sim-log__manual-label">
          {{ entry.text === "lambda" ? t("builder.simulation.log.resolveLambda") : t("builder.simulation.log.resolveCondition") }}
        </span>
        <template v-if="entry.text === 'condition'">
          <button type="button" class="sim-btn sim-btn--yes" @click="resumeManual(entry.runId, true)">
            {{ t("builder.simulation.log.true") }}
          </button>
          <button type="button" class="sim-btn sim-btn--no" @click="resumeManual(entry.runId, false)">
            {{ t("builder.simulation.log.false") }}
          </button>
        </template>
        <template v-else>
          <input v-model="manualDrafts[entry.runId]" type="text" class="sim-manual-input" />
          <button type="button" class="sim-btn" @click="resumeManual(entry.runId, manualDrafts[entry.runId])">
            {{ t("builder.simulation.log.submit") }}
          </button>
        </template>
      </div>

      <div v-else-if="entry.kind === 'manual' && isFilterResolvable(entry.manualFilterId)" class="sim-log__manual">
        <span class="sim-log__manual-label">{{ t("builder.simulation.log.resolveFilter") }}</span>
        <input v-model="manualFilterDrafts[entry.manualFilterId]" type="text" class="sim-manual-input" />
        <button
          type="button"
          class="sim-btn"
          @click="resolveManualFilter(entry.manualFilterId, Number(manualFilterDrafts[entry.manualFilterId]) || 0)"
        >
          {{ t("builder.simulation.log.submit") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps({
  simulation: { type: Object, required: true }
});

const entries = computed(() => [...props.simulation.log.value].reverse());

const manualDrafts = reactive({});
const manualFilterDrafts = reactive({});

const isRunResolvable = (runId) =>
  runId !== undefined && props.simulation.runs.value.some((run) => run.id === runId && run.status === "manual");

const isFilterResolvable = (manualFilterId) =>
  manualFilterId !== undefined && props.simulation.manualFilters.value.some((entry) => entry.id === manualFilterId);

const resumeManual = (runId, value) => props.simulation.resumeManual(runId, value);
const resolveManualFilter = (manualFilterId, value) => props.simulation.resolveManualFilter(manualFilterId, value);

const formatTick = (ms) => {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const CHIP_LABEL_KEYS = {
  trigger: "builder.simulation.log.trigger",
  executed: "builder.simulation.log.executed",
  skipped: "builder.simulation.log.skipped",
  manual: "builder.simulation.log.manual",
  "filter-drop": "builder.simulation.log.filterDrop",
  value: "builder.simulation.log.value"
};
const chipLabel = (kind) => t(CHIP_LABEL_KEYS[kind] || kind);

const CHIP_CLASSES = {
  trigger: "sim-log__chip--trigger",
  executed: "sim-log__chip--executed",
  skipped: "sim-log__chip--skipped",
  manual: "sim-log__chip--manual",
  "filter-drop": "sim-log__chip--drop",
  value: "sim-log__chip--value"
};
const chipClass = (kind) => CHIP_CLASSES[kind] || "";
</script>

<style scoped>
.sim-log {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
}

.sim-log__empty {
  color: #64748b;
  padding: 12px 4px;
}

.sim-log__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 5px 8px;
  border-bottom: 1px solid #eef2f6;
}

.sim-log__tick {
  font-variant-numeric: tabular-nums;
  color: #94a3b8;
  min-width: 42px;
}

.sim-log__chip {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 999px;
  color: #ffffff;
  background: #94a3b8;
}

.sim-log__chip--trigger {
  background: var(--brand-blue, #2563eb);
}
.sim-log__chip--executed {
  background: var(--brand-green, #15a34a);
}
.sim-log__chip--skipped {
  background: #94a3b8;
}
.sim-log__chip--manual {
  background: var(--brand-amber, #f59e0b);
}
.sim-log__chip--drop {
  background: #ef4444;
}
.sim-log__chip--value {
  background: var(--accent, #0e7c8a);
}

.sim-log__flow {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
}

.sim-log__arrow {
  color: #cbd5e1;
}

.sim-log__action {
  background: #f1f5f9;
  border-radius: 4px;
  padding: 1px 6px;
}

.sim-log__manual {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.sim-log__manual-label {
  font-size: 0.72rem;
  color: #b16b02;
}

.sim-manual-input {
  width: 90px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px 6px;
}

.sim-btn {
  border: 1px solid var(--accent, #0e7c8a);
  background: #ffffff;
  color: var(--accent, #0e7c8a);
  border-radius: 6px;
  padding: 2px 10px;
  font-size: 0.72rem;
  cursor: pointer;
}

.sim-btn--yes {
  border-color: var(--brand-green, #15a34a);
  color: var(--brand-green, #15a34a);
}

.sim-btn--no {
  border-color: #ef4444;
  color: #ef4444;
}
</style>
