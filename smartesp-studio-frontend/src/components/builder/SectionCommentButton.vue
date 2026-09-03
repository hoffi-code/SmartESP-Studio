<template>
  <button
    v-if="commentKey"
    type="button"
    class="secondary compact btn-standard"
    @click="emit('open', commentKey)"
  >
    {{ hasComment ? t("builder.comment.buttonEdit") : t("builder.comment.buttonAdd") }}
  </button>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({
  commentKey: { type: String, default: "" },
  hasComment: { type: Boolean, default: false }
});

const emit = defineEmits(["open"]);
</script>
