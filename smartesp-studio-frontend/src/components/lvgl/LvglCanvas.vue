<template>
  <div class="lvgl-canvas__wrap">
    <div class="lvgl-canvas__toolbar">
      <label>W <input type="number" min="16" max="2000" :value="canvasWidth" @change="emitSize('width', $event)" /></label>
      <label>H <input type="number" min="16" max="2000" :value="canvasHeight" @change="emitSize('height', $event)" /></label>
      <label>Zoom
        <input type="range" min="0.5" max="3" step="0.25" :value="zoom" @input="zoom = Number($event.target.value)" />
      </label>
      <span class="note">{{ Math.round(zoom * 100) }}% &middot; approximate layout</span>
    </div>

    <div class="lvgl-canvas__scroll">
      <div
        class="lvgl-canvas"
        :style="{ width: `${canvasWidth * zoom}px`, height: `${canvasHeight * zoom}px` }"
        @pointerdown.self="emit('select', '')"
      >
        <div
          v-for="entry in layout"
          :key="entry.key"
          class="lvgl-canvas__widget"
          :class="{
            'is-selected': entry.uiId && entry.uiId === selectedId,
            'is-managed': entry.layoutManaged,
            'is-static': !entry.positionable
          }"
          :style="widgetStyle(entry)"
          :title="entry.layoutManaged ? 'Position controlled by parent layout' : entry.type"
          @pointerdown.stop="onWidgetPointerDown($event, entry)"
        >
          <span v-if="glyph(entry).kind === 'text'" class="lvgl-canvas__text">{{ glyph(entry).text }}</span>

          <span v-else-if="glyph(entry).kind === 'toggle'" class="lvgl-canvas__toggle"><i /></span>

          <span v-else-if="glyph(entry).kind === 'track'" class="lvgl-canvas__track">
            <i :style="{ width: `${glyph(entry).fill}%` }" />
          </span>

          <svg v-else-if="glyph(entry).kind === 'ring'" viewBox="0 0 32 32" class="lvgl-canvas__ring">
            <circle cx="16" cy="16" r="13" />
          </svg>

          <span v-else class="lvgl-canvas__tag">{{ entry.type }}</span>

          <span v-if="entry.layoutManaged" class="lvgl-canvas__badge">flex</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { resolveLvglPageLayout, lvglColorToCss } from "../../utils/lvglLayout";

const props = defineProps({
  page: { type: Object, default: null },
  canvasWidth: { type: Number, default: 240 },
  canvasHeight: { type: Number, default: 320 },
  selectedId: { type: String, default: "" },
  gridSize: { type: Number, default: 5 }
});

const emit = defineEmits(["select", "move", "resize-canvas"]);

const zoom = ref(1.5);

const layout = computed(() => resolveLvglPageLayout(props.page, props.canvasWidth, props.canvasHeight));

const emitSize = (dim, event) => {
  const value = Math.max(16, Math.min(2000, Number(event.target.value) || 0));
  emit("resize-canvas", { dim, value });
};

const widgetStyle = (entry) => {
  const p = entry.node.props || {};
  const style = {
    left: `${entry.box.x * zoom.value}px`,
    top: `${entry.box.y * zoom.value}px`,
    width: `${entry.box.w * zoom.value}px`,
    height: `${entry.box.h * zoom.value}px`
  };
  const bg = lvglColorToCss(p.bg_color);
  if (bg) style.background = bg;
  const fg = lvglColorToCss(p.text_color);
  if (fg) style.color = fg;
  const radius = Number(p.radius);
  if (Number.isFinite(radius)) style.borderRadius = `${radius * zoom.value}px`;
  const border = lvglColorToCss(p.border_color);
  if (border) style.borderColor = border;
  return style;
};

const glyph = (entry) => {
  const p = entry.node.props || {};
  switch (entry.type) {
    case "label":
    case "button":
    case "checkbox":
    case "textarea":
      return { kind: "text", text: String(p.text ?? entry.type) };
    case "dropdown":
    case "roller":
      return { kind: "text", text: String(p.options?.[0] ?? entry.type) };
    case "switch":
      return { kind: "toggle" };
    case "slider":
    case "bar": {
      const min = Number(p.min_value ?? 0);
      const max = Number(p.max_value ?? 100);
      const val = Number(p.value ?? min);
      const span = max - min || 1;
      return { kind: "track", fill: Math.max(0, Math.min(100, ((val - min) / span) * 100)) };
    }
    case "arc":
    case "spinner":
    case "led":
      return { kind: "ring" };
    default:
      return { kind: "box" };
  }
};

const dragState = ref(null);

const snap = (value) => Math.round(value / props.gridSize) * props.gridSize;

const onWidgetPointerDown = (event, entry) => {
  emit("select", entry.uiId || "");
  if (!entry.positionable || !entry.uiId) return;
  const common = entry.node.common || {};
  dragState.value = {
    uiId: entry.uiId,
    startX: event.clientX,
    startY: event.clientY,
    baseX: Number(common.x) || 0,
    baseY: Number(common.y) || 0,
    moved: false
  };
  event.target.setPointerCapture?.(event.pointerId);
  event.target.addEventListener("pointermove", onDragMove);
  event.target.addEventListener("pointerup", onDragEnd, { once: true });
};

const onDragMove = (event) => {
  const state = dragState.value;
  if (!state) return;
  const dx = (event.clientX - state.startX) / zoom.value;
  const dy = (event.clientY - state.startY) / zoom.value;
  if (!state.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
  state.moved = true;
  emit("move", { uiId: state.uiId, x: snap(state.baseX + dx), y: snap(state.baseY + dy) });
};

const onDragEnd = (event) => {
  event.target.removeEventListener("pointermove", onDragMove);
  dragState.value = null;
};
</script>

<style scoped>
.lvgl-canvas__wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.lvgl-canvas__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}

.lvgl-canvas__toolbar input[type="number"] {
  width: 64px;
}

.lvgl-canvas__scroll {
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  background:
    repeating-linear-gradient(0deg, transparent 0 7px, rgba(0, 0, 0, 0.04) 7px 8px),
    repeating-linear-gradient(90deg, transparent 0 7px, rgba(0, 0, 0, 0.04) 7px 8px);
}

.lvgl-canvas {
  position: relative;
  background: #fff;
  border: 1px solid var(--navy);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
}

.lvgl-canvas__widget {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid rgba(30, 41, 59, 0.45);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 11px;
  color: var(--navy);
  cursor: grab;
  user-select: none;
}

.lvgl-canvas__widget.is-static {
  cursor: default;
}

.lvgl-canvas__widget.is-managed {
  border-style: dashed;
}

.lvgl-canvas__widget.is-selected {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  z-index: 2;
}

.lvgl-canvas__text {
  padding: 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lvgl-canvas__tag {
  opacity: 0.55;
  font-size: 10px;
}

.lvgl-canvas__toggle {
  width: 70%;
  height: 55%;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.25);
  position: relative;
}

.lvgl-canvas__toggle i {
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  width: 40%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.4);
}

.lvgl-canvas__track {
  width: 80%;
  height: 30%;
  min-height: 4px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.2);
  overflow: hidden;
}

.lvgl-canvas__track i {
  display: block;
  height: 100%;
  background: var(--accent);
}

.lvgl-canvas__ring {
  width: 70%;
  height: 70%;
}

.lvgl-canvas__ring circle {
  fill: none;
  stroke: var(--accent);
  stroke-width: 4;
}

.lvgl-canvas__badge {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 8px;
  line-height: 1;
  padding: 1px 3px;
  background: var(--accent);
  color: #fff;
  border-bottom-right-radius: 3px;
}
</style>
