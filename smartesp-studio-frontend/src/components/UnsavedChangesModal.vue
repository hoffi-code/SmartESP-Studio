<template>
  <div class="modal-backdrop" v-if="open" @click="$emit('cancel')">
    <div class="modal-card" role="dialog" aria-modal="true" @click.stop>
      <h3>{{ title || t("modals.unsaved.title") }}</h3>
      <p>{{ message || t("modals.unsaved.message") }}</p>
      <div v-if="errorMessage" class="unsaved-modal-error">{{ errorMessage }}</div>
      <div class="modal-actions">
        <button class="secondary" type="button" :disabled="busy" @click="$emit('cancel')">
          {{ cancelText || t("modals.unsaved.cancel") }}
        </button>
        <button class="secondary" type="button" :disabled="busy" @click="$emit('discard')">
          {{ discardText || t("modals.unsaved.discard") }}
        </button>
        <button type="button" :disabled="busy" @click="$emit('save')">
          {{ busy ? t("modals.common.saving") : saveText || t("modals.unsaved.save") }}
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
  busy: Boolean,
  title: { type: String, default: "" },
  message: { type: String, default: "" },
  saveText: { type: String, default: "" },
  discardText: { type: String, default: "" },
  cancelText: { type: String, default: "" },
  errorMessage: { type: String, default: "" }
});

const emit = defineEmits(["save", "discard", "cancel"]);

const handleKeydown = (event) => {
  if (event.key !== "Escape") return;
  if (props.busy) return;
  emit("cancel");
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

<style scoped>
.unsaved-modal-error {
  margin-bottom: 8px;
  color: #b42318;
  font-size: 13px;
}
</style>
