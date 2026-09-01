<template>
  <div class="modal-backdrop" v-if="open" @click="emit('close')">
    <div class="modal-card comment-edit-card" role="dialog" aria-modal="true" @click.stop>
      <h3>{{ title }}</h3>
      <p class="comment-edit-hint">
        Erscheint als YAML-Kommentar direkt über der Sektion. Das <code>#</code> wird automatisch gesetzt.
      </p>
      <textarea
        ref="input"
        v-model="draft"
        class="comment-edit-input"
        rows="4"
        placeholder="z. B. I2C-Bus für das Display"
      ></textarea>
      <div class="modal-actions">
        <button
          v-if="hasExisting"
          class="secondary"
          type="button"
          @click="emit('delete')"
        >
          Löschen
        </button>
        <button class="secondary" type="button" @click="emit('close')">Abbrechen</button>
        <button type="button" :disabled="!trimmed" @click="save">Speichern</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "Kommentar" },
  value: { type: String, default: "" }
});

const emit = defineEmits(["save", "delete", "close"]);

const input = ref(null);
const draft = ref("");

// Stored comments keep their `#` prefix (that is what the importer writes); strip it for
// editing and put it back on save so the textarea shows plain prose.
const stripHashes = (text) =>
  String(text || "")
    .split("\n")
    .map((line) => line.replace(/^\s*#\s?/, ""))
    .join("\n");

const addHashes = (text) =>
  String(text || "")
    .split("\n")
    .map((line) => (line.trim() ? `# ${line.trim()}` : "#"))
    .join("\n");

const hasExisting = computed(() => String(props.value || "").trim() !== "");
const trimmed = computed(() => draft.value.trim() !== "");

const save = () => {
  if (!trimmed.value) return;
  emit("save", addHashes(draft.value));
};

const handleKeydown = (event) => {
  if (event.key === "Escape") emit("close");
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = stripHashes(props.value);
      window.addEventListener("keydown", handleKeydown);
      nextTick(() => input.value?.focus());
    } else {
      window.removeEventListener("keydown", handleKeydown);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => window.removeEventListener("keydown", handleKeydown));
</script>

<style scoped>
.comment-edit-card {
  width: min(460px, 92vw);
}

.comment-edit-hint {
  margin: 0;
  color: var(--muted, #64748b);
  font-size: 13px;
}

.comment-edit-input {
  width: 100%;
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
}
</style>
