<template>
  <div class="module-card header-comment-card">
    <div class="components-header">
      <div class="components-title">
        <h2>{{ t("builder.comment.headerTitle") }}</h2>
      </div>
    </div>
    <div class="module-card__body">
      <p class="header-comment-card__hint">
        <i18n-t keypath="builder.comment.headerCardHint">
          <template #hash><code>#</code></template>
        </i18n-t>
      </p>
      <textarea
        v-model="draft"
        class="header-comment-card__input"
        rows="3"
        :placeholder="t('builder.comment.placeholder')"
        @input="emitDraft"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { addHashes, stripHashes } from "../../utils/yamlComments";

const { t } = useI18n();

const props = defineProps({
  headerComment: { type: String, default: "" }
});

const emit = defineEmits(["update:header-comment"]);

const draft = ref(stripHashes(props.headerComment));

const toStored = (text) => (text.trim() ? addHashes(text) : "");

const emitDraft = () => emit("update:header-comment", toStored(draft.value));

// Nur nachziehen, wenn der Wert wirklich von aussen kommt (Laden, Import) -- sonst
// wuerde jeder eigene Tastendruck den Draft neu setzen und den Cursor ans Ende werfen.
watch(
  () => props.headerComment,
  (value) => {
    if (value === toStored(draft.value)) return;
    draft.value = stripHashes(value);
  }
);
</script>

<style scoped>
.header-comment-card {
  flex: 0 0 auto;
}

.header-comment-card__hint {
  margin: 0;
  color: var(--muted, #64748b);
  font-size: 13px;
}

.header-comment-card__input {
  width: 100%;
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
}
</style>
