<template>
  <div
    class="pane-resizer"
    role="separator"
    :aria-label="ariaLabel"
    aria-orientation="vertical"
    @mousedown.prevent="start"
    @dblclick="emit('reset')"
  ></div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps({
  ariaLabel: { type: String, default: "" }
});

const emit = defineEmits(["resize-start", "resize-move", "resize-end", "reset"]);

const isResizing = ref(false);

const start = () => {
  isResizing.value = true;
  document.body.classList.add("is-pane-resizing");
  emit("resize-start");
};

const move = (event) => {
  if (!isResizing.value) return;
  emit("resize-move", event.clientX);
};

const stop = () => {
  if (!isResizing.value) return;
  isResizing.value = false;
  document.body.classList.remove("is-pane-resizing");
  emit("resize-end");
};

// Der Drag laeuft ueber das ganze Fenster weiter, auch wenn die Maus den schmalen
// Griff verlaesst -- deshalb haengen die Listener am window, nicht am Element.
onMounted(() => {
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", stop);
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", move);
  window.removeEventListener("mouseup", stop);
  stop();
});
</script>

<style scoped>
.pane-resizer {
  width: 8px;
  cursor: col-resize;
  background: #ffffff;
  position: relative;
}

.pane-resizer::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: var(--border);
  transition: background-color 0.15s ease;
}

.pane-resizer:hover::before {
  background: #c5d2e6;
}

:global(body.is-pane-resizing) {
  cursor: col-resize;
  user-select: none;
}
</style>
