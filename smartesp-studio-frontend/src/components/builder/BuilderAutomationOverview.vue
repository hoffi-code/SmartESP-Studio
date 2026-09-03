<template>
  <div class="automation-overview">
    <p v-if="!groups.length" class="note">{{ t("builder.automationOverview.empty") }}</p>

    <div v-for="group in groups" :key="group.key" class="schema-list list-normal">
      <div class="schema-list-header">
        <div class="schema-list-title">
          <span>{{ group.label }}</span>
          <span class="automation-overview__kind">{{ kindLabel(group.kind) }}</span>
        </div>
      </div>
      <div
        v-for="(entry, index) in group.entries"
        :key="`${group.key}-${index}`"
        class="schema-list-item automation-overview__row"
      >
        <div class="automation-overview__trigger">
          <code>{{ entry.triggerKey }}</code>
          <span class="automation-overview__actions">{{ entry.actions.join(" → ") }}</span>
        </div>
        <button
          type="button"
          class="secondary compact btn-standard"
          @click="emit('jump', entry)"
        >
          {{ t("builder.automationOverview.edit") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { groupAutomationEntries } from "../../utils/automationOverview";

const { t } = useI18n();

const props = defineProps({
  entries: { type: Array, default: () => [] }
});

const emit = defineEmits(["jump"]);

const groups = computed(() => groupAutomationEntries(props.entries));

const kindLabel = (kind) =>
  kind === "section"
    ? t("builder.automationOverview.kindSection")
    : t("builder.automationOverview.kindComponent");
</script>

<style scoped>
.automation-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.automation-overview__kind {
  color: var(--muted, #64748b);
  font-size: 12px;
  font-weight: 500;
}

.automation-overview__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.automation-overview__trigger {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.automation-overview__actions {
  color: var(--muted, #64748b);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
