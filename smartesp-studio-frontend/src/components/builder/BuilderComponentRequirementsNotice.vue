<template>
  <div
    v-if="activeComponentBusLabels || activeComponentProtocolLabels || activeComponentSystemLabels || activeComponentNetworkLabels || activeComponentComponentLabels"
    class="notice notice--warning component-bus-note"
  >
    <template v-if="activeComponentBusLabels">
      {{ t("builder.requirements.configure", { labels: activeComponentBusLabels }) }}
      <a href="#" class="preview-callout-link" @click.prevent="emit('focus-bus')">
        {{ t("builder.requirements.linkBusses") }}
      </a>
    </template>
    <template v-if="activeComponentProtocolLabels">
      <br v-if="activeComponentBusLabels" />
      {{ t("builder.requirements.configure", { labels: activeComponentProtocolLabels }) }}
      <a href="#" class="preview-callout-link" @click.prevent="emit('focus-protocol')">
        {{ t("builder.requirements.linkProtocols") }}
      </a>
    </template>
    <template v-if="activeComponentSystemLabels">
      <br v-if="activeComponentBusLabels || activeComponentProtocolLabels" />
      {{ t("builder.requirements.configure", { labels: activeComponentSystemLabels }) }}
      <a href="#" class="preview-callout-link" @click.prevent="emit('focus-system')">
        {{ t("builder.requirements.linkSystem") }}
      </a>
    </template>
    <template v-if="activeComponentNetworkLabels">
      <br v-if="activeComponentBusLabels || activeComponentProtocolLabels || activeComponentSystemLabels" />
      {{ t("builder.requirements.configure", { labels: activeComponentNetworkLabels }) }}
      <a href="#" class="preview-callout-link" @click.prevent="emit('focus-network')">
        {{ t("builder.requirements.linkNetwork") }}
      </a>
    </template>
    <template v-if="activeComponentComponentLabels">
      <br
        v-if="activeComponentBusLabels || activeComponentProtocolLabels || activeComponentSystemLabels || activeComponentNetworkLabels"
      />
      {{ t("builder.requirements.configureComponents", { labels: activeComponentComponentLabels }) }}
    </template>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps({
  activeComponentBusLabels: { type: String, default: "" },
  activeComponentProtocolLabels: { type: String, default: "" },
  activeComponentSystemLabels: { type: String, default: "" },
  activeComponentNetworkLabels: { type: String, default: "" },
  activeComponentComponentLabels: { type: String, default: "" }
});

const emit = defineEmits(["focus-bus", "focus-protocol", "focus-system", "focus-network"]);
</script>
