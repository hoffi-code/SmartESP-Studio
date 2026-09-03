<template>
  <div class="sim-panel">
    <div class="sim-clock">
      <button type="button" class="sim-clock__toggle" :class="{ 'sim-clock__toggle--running': running }" @click="toggleClock">
        <span class="sim-clock__icon" :class="running ? 'sim-clock__icon--pause' : 'sim-clock__icon--play'"></span>
        {{ running ? t("builder.simulation.clock.pause") : t("builder.simulation.clock.play") }}
      </button>

      <div class="sim-clock__readout">
        <span class="sim-clock__dot" :class="{ 'sim-clock__dot--running': running }"></span>
        <span class="sim-clock__time">{{ formattedTick }}</span>
        <span class="sim-clock__state">{{ running ? t("builder.simulation.clock.running") : t("builder.simulation.clock.paused") }}</span>
      </div>

      <div class="sim-clock__speed">
        <span class="sim-clock__speed-label">{{ t("builder.simulation.clock.speed") }}</span>
        <button
          v-for="factor in [1, 2, 5, 10]"
          :key="factor"
          type="button"
          class="sim-clock__speed-btn"
          :class="{ 'sim-clock__speed-btn--active': speedFactor === factor }"
          @click="simulation.clock.setSpeed(factor)"
        >
          {{ factor }}x
        </button>
      </div>

      <button type="button" class="sim-clock__reset" @click="simulation.resetSimulation()">
        {{ t("builder.simulation.clock.reset") }}
      </button>
    </div>

    <div v-if="triggers.length" class="sim-triggers">
      <h3 class="sim-triggers__title">{{ t("builder.simulation.triggers.title") }}</h3>
      <div class="sim-triggers__strip">
        <div v-for="(trigger, index) in triggers" :key="index" class="sim-trigger-chip">
          <span class="sim-trigger-chip__source">{{ trigger.sourceLabel }}</span>
          <span class="sim-trigger-chip__arrow">→</span>
          <span class="sim-trigger-chip__key">{{ trigger.triggerKey }}</span>
          <span v-if="trigger.manual" class="sim-trigger-chip__manual" :title="t('builder.simulation.triggers.manualOnly')">
            ⚠
          </span>
          <button type="button" class="sim-trigger-chip__fire" @click="simulation.fireTrigger(trigger)">
            {{ t("builder.simulation.triggers.fire") }}
          </button>
        </div>
      </div>
    </div>
    <p v-else class="sim-triggers__empty">{{ t("builder.simulation.triggers.empty") }}</p>

    <div v-if="activeRuns.length" class="sim-active-runs">
      <h3 class="sim-triggers__title">{{ t("builder.simulation.triggers.active") }}</h3>
      <div class="sim-triggers__strip">
        <div v-for="run in activeRuns" :key="run.id" class="sim-trigger-chip sim-trigger-chip--active">
          <span class="sim-trigger-chip__source">{{ run.meta?.sourceLabel }}</span>
          <span class="sim-trigger-chip__arrow">→</span>
          <span class="sim-trigger-chip__key">{{ run.meta?.triggerKey }}</span>
          <span class="sim-trigger-chip__status">
            {{ run.status === "waiting" ? t("builder.simulation.triggers.waitingUntil", { tick: run.untilTick }) : t("builder.simulation.triggers.waitingManual") }}
          </span>
        </div>
      </div>
    </div>

    <div class="sim-body">
      <section class="sim-body__entities">
        <h3 class="sim-body__title">{{ t("builder.simulation.entities.title") }}</h3>
        <SimulationEntityTable :simulation="simulation" />
      </section>
      <section class="sim-body__log">
        <h3 class="sim-body__title">{{ t("builder.simulation.log.title") }}</h3>
        <SimulationLog :simulation="simulation" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import SimulationEntityTable from "./SimulationEntityTable.vue";
import SimulationLog from "./SimulationLog.vue";

const { t } = useI18n();

const props = defineProps({
  simulation: { type: Object, required: true }
});

// Sorgt dafuer, dass der Simulationszustand existiert, sobald der Tab geoeffnet wird --
// resetSimulation() wuerde sonst erst beim ersten Wertwechsel lazy laufen.
props.simulation.ensureInitialized();

const running = computed(() => props.simulation.clock.running.value);
const speedFactor = computed(() => props.simulation.clock.speedFactor.value);
const triggers = computed(() => props.simulation.triggers.value);
const activeRuns = computed(() => props.simulation.runs.value);

const toggleClock = () => (running.value ? props.simulation.clock.pause() : props.simulation.clock.play());

const formattedTick = computed(() => {
  const totalSeconds = Math.floor(props.simulation.clock.currentTick.value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});
</script>

<style scoped>
.sim-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sim-clock {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border: 1px solid var(--border, #d8e4e8);
  border-radius: 10px;
  background: #f8fbff;
}

.sim-clock__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--accent, #0e7c8a);
  background: var(--accent, #0e7c8a);
  color: #ffffff;
  border-radius: 8px;
  padding: 6px 14px;
  cursor: pointer;
  font-weight: 600;
}

.sim-clock__toggle--running {
  background: var(--brand-amber, #f59e0b);
  border-color: var(--brand-amber, #f59e0b);
}

.sim-clock__icon {
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 9px solid #ffffff;
}

.sim-clock__icon--pause {
  width: 8px;
  height: 12px;
  border: none;
  border-left: 3px solid #ffffff;
  border-right: 3px solid #ffffff;
}

.sim-clock__readout {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sim-clock__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
}

.sim-clock__dot--running {
  background: var(--brand-green, #15a34a);
  animation: sim-pulse 1.2s ease-in-out infinite;
}

@keyframes sim-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(21, 163, 74, 0.5);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(21, 163, 74, 0);
  }
}

.sim-clock__time {
  font-variant-numeric: tabular-nums;
  font-size: 1.1rem;
  font-weight: 600;
  color: #334155;
}

.sim-clock__state {
  font-size: 0.75rem;
  color: #64748b;
}

.sim-clock__speed {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sim-clock__speed-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-right: 4px;
}

.sim-clock__speed-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 0.75rem;
  cursor: pointer;
  color: #475569;
}

.sim-clock__speed-btn--active {
  background: var(--accent, #0e7c8a);
  border-color: var(--accent, #0e7c8a);
  color: #ffffff;
}

.sim-clock__reset {
  margin-left: auto;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  color: #475569;
}

.sim-triggers__title {
  font-size: 0.85rem;
  color: #475569;
  margin: 0 0 6px;
}

.sim-triggers__empty {
  color: #94a3b8;
  font-size: 0.85rem;
}

.sim-triggers__strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.sim-trigger-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  border: 1px solid var(--border, #d8e4e8);
  background: #ffffff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.78rem;
  white-space: nowrap;
}

.sim-trigger-chip--active {
  border-color: var(--brand-amber, #f59e0b);
  background: #fffbeb;
}

.sim-trigger-chip__source {
  color: #334155;
  font-weight: 600;
}

.sim-trigger-chip__arrow {
  color: #cbd5e1;
}

.sim-trigger-chip__key {
  color: var(--accent-strong, #0b6675);
}

.sim-trigger-chip__manual {
  color: var(--brand-amber, #f59e0b);
}

.sim-trigger-chip__status {
  color: #b16b02;
  font-size: 0.72rem;
}

.sim-trigger-chip__fire {
  border: none;
  background: var(--accent-line, #cde7ea);
  color: var(--accent-strong, #0b6675);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.72rem;
  cursor: pointer;
}

.sim-body {
  display: grid;
  grid-template-columns: minmax(280px, 1.1fr) minmax(280px, 1fr);
  gap: 16px;
  align-items: start;
}

.sim-body__title {
  font-size: 0.85rem;
  color: #475569;
  margin: 0 0 8px;
}

.sim-body__entities,
.sim-body__log {
  border: 1px solid var(--border, #d8e4e8);
  border-radius: 10px;
  padding: 12px;
  background: #ffffff;
  max-height: 60vh;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .sim-body {
    grid-template-columns: 1fr;
  }
}
</style>
