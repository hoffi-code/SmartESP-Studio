<template>
  <div class="modal-backdrop" v-if="open" @click="$emit('cancel')">
    <div class="modal-card" role="dialog" aria-modal="true" @click.stop>
      <h3>{{ title || t("modals.confirm.title") }}</h3>
      <p>{{ message || t("modals.confirm.message") }}</p>
      <div class="modal-actions">
        <button class="secondary" type="button" @click="$emit('cancel')">
          {{ cancelText || t("modals.confirm.cancel") }}
        </button>
        <button type="button" @click="$emit('confirm')">
          {{ confirmText || t("modals.confirm.yes") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps({
  open: Boolean,
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  confirmText: { type: String, default: "" },
  cancelText: { type: String, default: "" }
});
const emit = defineEmits(["confirm", "cancel"]);

const handleKeydown = (event) => {
  if (event.key === "Escape") {
    emit("cancel");
  }
};

const toggleBodyScroll = (enabled) => {
  document.body.style.overflow = enabled ? "" : "hidden";
};

onMounted(() => {
  if (props.open) {
    toggleBodyScroll(false);
  }
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  toggleBodyScroll(true);
  window.removeEventListener("keydown", handleKeydown);
});

watch(
  () => props.open,
  (open) => {
    toggleBodyScroll(!open);
  }
);
</script>
