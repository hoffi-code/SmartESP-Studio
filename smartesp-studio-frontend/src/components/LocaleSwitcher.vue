<template>
  <select
    class="locale-switcher"
    :value="locale"
    :aria-label="t('common.language')"
    @change="onChange"
  >
    <option v-for="option in SUPPORTED_LOCALES" :key="option" :value="option">
      {{ option.toUpperCase() }}
    </option>
  </select>
</template>

<script setup>
import { useI18n } from "vue-i18n";

import { SUPPORTED_LOCALES, setLocale } from "../i18n";

const { t, locale } = useI18n();

const onChange = (event) => setLocale(event.target.value);
</script>

<style scoped>
.locale-switcher {
  width: auto;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid #dbe3ef;
  border-radius: 4px;
  background: #ffffff;
}
</style>
