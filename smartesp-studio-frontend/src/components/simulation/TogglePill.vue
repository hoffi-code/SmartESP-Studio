<template>
  <button type="button" class="toggle-pill" :class="{ 'toggle-pill--on': modelValue }" @click="$emit('update:modelValue', !modelValue)">
    <span class="toggle-pill__knob"></span>
    <span class="toggle-pill__label">{{ modelValue ? t("builder.simulation.entities.on") : t("builder.simulation.entities.off") }}</span>
  </button>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({
  modelValue: { type: Boolean, default: false }
});
defineEmits(["update:modelValue"]);
</script>

<style scoped>
.toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #cbd5e1;
  background: #f1f5f9;
  border-radius: 999px;
  padding: 3px 10px 3px 4px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.toggle-pill__knob {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #94a3b8;
  transition: background 0.15s ease, transform 0.15s ease;
}

.toggle-pill__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #64748b;
  min-width: 26px;
  text-align: left;
}

.toggle-pill--on {
  background: #dcfce7;
  border-color: var(--brand-green, #15a34a);
}

.toggle-pill--on .toggle-pill__knob {
  background: var(--brand-green, #15a34a);
  transform: scale(1.05);
}

.toggle-pill--on .toggle-pill__label {
  color: #15803d;
}
</style>
