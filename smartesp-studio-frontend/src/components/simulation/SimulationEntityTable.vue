<template>
  <div class="sim-entities">
    <p v-if="!entities.length" class="sim-entities__empty">{{ t("builder.simulation.entities.empty") }}</p>

    <div v-for="entity in entities" :key="entity.id" class="sim-entity" :class="{ 'sim-entity--dim': entity.kind === 'unsupported' }">
      <div class="sim-entity__id">
        <span class="sim-entity__domain-badge" :class="domainBadgeClass(entity.domain)">{{ entity.domain }}</span>
        <code>{{ entity.id }}</code>
        <span v-if="entity.filters?.length" class="sim-entity__filters-badge">
          {{ t("builder.simulation.entities.filtersBadge", { count: entity.filters.length }) }}
        </span>
      </div>

      <div class="sim-entity__control">
        <span v-if="entity.kind === 'unsupported'" class="sim-entity__unsupported">
          {{ t("builder.simulation.entities.unsupported") }}
        </span>

        <TogglePill
          v-else-if="entity.kind === 'boolean'"
          :model-value="Boolean(entity.value)"
          @update:model-value="setValue(entity.id, $event)"
        />

        <div v-else-if="entity.kind === 'numeric'" class="sim-slider">
          <input
            type="range"
            min="-100"
            max="100"
            step="0.1"
            :value="clampedNumeric(entity.value)"
            @input="setValue(entity.id, Number($event.target.value))"
          />
          <input
            type="number"
            step="any"
            class="sim-slider__number"
            :value="entity.value"
            @change="setValue(entity.id, Number($event.target.value))"
          />
        </div>

        <div v-else-if="entity.kind === 'text' || entity.kind === 'globals'" class="sim-text">
          <input type="text" :value="entity.value" @change="setValue(entity.id, $event.target.value)" />
          <span class="sim-chip">{{ entity.value === "" ? "—" : entity.value }}</span>
        </div>

        <div v-else-if="entity.kind === 'struct'" class="sim-struct">
          <template v-for="field in structFields(entity.domain)" :key="field.key">
            <TogglePill
              v-if="field.type === 'toggle'"
              :model-value="Boolean(entity.fields?.[field.key])"
              @update:model-value="setField(entity.id, field.key, $event)"
            />
            <div v-else-if="field.type === 'chip'" class="sim-chip-group">
              <button
                v-for="option in field.options"
                :key="option"
                type="button"
                class="sim-chip-option"
                :class="{ 'sim-chip-option--active': entity.fields?.[field.key] === option }"
                @click="setField(entity.id, field.key, option)"
              >
                {{ option }}
              </button>
            </div>
            <div v-else class="sim-slider sim-slider--field">
              <span class="sim-slider__label">{{ field.label ? t(field.label) : field.key }}</span>
              <input
                type="range"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :disabled="field.readonly"
                :value="entity.fields?.[field.key] ?? field.min"
                @input="setField(entity.id, field.key, Number($event.target.value))"
              />
              <span class="sim-slider__number">{{ formatFieldValue(entity.fields?.[field.key]) }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import TogglePill from "./TogglePill.vue";

const { t } = useI18n();

const props = defineProps({
  simulation: { type: Object, required: true }
});

const entities = computed(() => props.simulation.entities.value);

const setValue = (id, value) => props.simulation.setValue(id, value);
const setField = (id, fieldKey, value) => props.simulation.setField(id, fieldKey, value);

const clampedNumeric = (value) => Math.max(-100, Math.min(100, Number(value) || 0));

const formatFieldValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(value ?? "");
};

// Kompakte, aber echte visuelle Steuerelemente je struct-Domain -- keine 1:1-Abbildung
// aller ESPHome-Felder, nur die fuers Durchspielen wichtigsten (Vorbild: Tier-2-Reduktion
// aus simulationEntityState.js).
const STRUCT_FIELDS = {
  light: [
    { key: "on", type: "toggle" },
    { key: "brightness", type: "slider", min: 0, max: 1, step: 0.01 }
  ],
  cover: [
    { key: "position", type: "slider", min: 0, max: 1, step: 0.01 },
    { key: "state", type: "chip", options: ["open", "closed"] }
  ],
  fan: [
    { key: "on", type: "toggle" },
    { key: "speed", type: "slider", min: 0, max: 100, step: 1 }
  ],
  climate: [
    { key: "mode", type: "chip", options: ["off", "heat", "cool", "heat_cool", "fan_only", "dry", "auto"] },
    { key: "target_temperature", type: "slider", min: 0, max: 40, step: 0.5, label: "builder.simulation.entities.target" },
    {
      key: "current_temperature",
      type: "slider",
      min: 0,
      max: 40,
      step: 0.5,
      readonly: true,
      label: "builder.simulation.entities.current"
    }
  ],
  valve: [
    { key: "position", type: "slider", min: 0, max: 1, step: 0.01 },
    { key: "state", type: "chip", options: ["open", "closed"] }
  ]
};
const structFields = (domain) => STRUCT_FIELDS[domain] || [];

const DOMAIN_BADGE_GROUPS = {
  sensor: "sim-badge--sense",
  binary_sensor: "sim-badge--sense",
  text_sensor: "sim-badge--sense",
  switch: "sim-badge--act",
  light: "sim-badge--act",
  cover: "sim-badge--act",
  fan: "sim-badge--act",
  climate: "sim-badge--act",
  valve: "sim-badge--act",
  lock: "sim-badge--act",
  number: "sim-badge--set",
  select: "sim-badge--set",
  globals: "sim-badge--set"
};
const domainBadgeClass = (domain) => DOMAIN_BADGE_GROUPS[domain] || "sim-badge--other";
</script>

<style scoped>
.sim-entities {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sim-entities__empty {
  color: #64748b;
  font-size: 0.9rem;
  padding: 12px 4px;
}

.sim-entity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--border, #d8e4e8);
  border-radius: 8px;
  background: #ffffff;
  flex-wrap: wrap;
}

.sim-entity--dim {
  opacity: 0.55;
}

.sim-entity__id {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
}

.sim-entity__id code {
  font-size: 0.85rem;
  color: #334155;
}

.sim-entity__domain-badge {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 2px 6px;
  border-radius: 999px;
  color: #ffffff;
  background: #94a3b8;
}

.sim-badge--sense {
  background: var(--brand-blue, #2563eb);
}
.sim-badge--act {
  background: var(--brand-green, #15a34a);
}
.sim-badge--set {
  background: var(--brand-amber, #f59e0b);
}

.sim-entity__filters-badge {
  font-size: 0.7rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 2px 8px;
}

.sim-entity__control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 260px;
  min-width: 200px;
  justify-content: flex-end;
}

.sim-entity__unsupported {
  font-size: 0.8rem;
  color: #94a3b8;
  font-style: italic;
}

.sim-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.sim-slider--field {
  justify-content: flex-end;
}

.sim-slider__label {
  font-size: 0.75rem;
  color: #64748b;
  min-width: 90px;
}

.sim-slider input[type="range"] {
  flex: 1;
  accent-color: var(--accent, #0e7c8a);
}

.sim-slider__number {
  width: 64px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: #334155;
}

input.sim-slider__number {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px 6px;
}

.sim-text {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.sim-text input[type="text"] {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 8px;
}

.sim-chip {
  font-size: 0.75rem;
  color: #0b6675;
  background: var(--accent-line, #cde7ea);
  border-radius: 999px;
  padding: 2px 10px;
  white-space: nowrap;
}

.sim-struct {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  width: 100%;
}

.sim-chip-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.sim-chip-option {
  font-size: 0.72rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  border-radius: 999px;
  padding: 2px 9px;
  cursor: pointer;
  color: #475569;
}

.sim-chip-option--active {
  background: var(--accent, #0e7c8a);
  border-color: var(--accent, #0e7c8a);
  color: #ffffff;
}
</style>
