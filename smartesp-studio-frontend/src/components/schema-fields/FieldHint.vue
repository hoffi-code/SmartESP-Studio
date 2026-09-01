<template>
  <span class="field-hint" ref="root">
    <button
      type="button"
      class="field-hint__toggle"
      :aria-expanded="open"
      :aria-label="t('common.help')"
      @click.stop="open = !open"
    >
      ?
    </button>
    <span v-if="open" class="field-hint__popover" role="tooltip">{{ text }}</span>
  </span>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({
  text: { type: String, required: true }
});

const root = ref(null);
const open = ref(false);

const onDocClick = (event) => {
  if (root.value && !root.value.contains(event.target)) open.value = false;
};
const onKeydown = (event) => {
  if (event.key === "Escape") open.value = false;
};

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeydown);
  } else {
    document.removeEventListener("click", onDocClick);
    document.removeEventListener("keydown", onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<style scoped>
.field-hint {
  position: relative;
  display: inline-flex;
}

.field-hint__toggle {
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted, #64748b);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.field-hint__toggle:hover {
  color: var(--navy);
  border-color: var(--navy);
}

.field-hint__popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 40;
  width: max-content;
  max-width: 320px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
  color: var(--navy);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.45;
  white-space: normal;
}
</style>
