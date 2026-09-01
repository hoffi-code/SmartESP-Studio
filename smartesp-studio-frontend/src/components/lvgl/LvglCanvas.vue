<template>
  <div class="lvgl-canvas__wrap" :class="{ 'is-preview': !interactive }">
    <div v-if="interactive" class="lvgl-canvas__toolbar">
      <label>W <input type="number" min="16" max="2000" :value="canvasWidth" @change="emitSize('width', $event)" /></label>
      <label>H <input type="number" min="16" max="2000" :value="canvasHeight" @change="emitSize('height', $event)" /></label>
      <label>Zoom
        <input type="range" min="0.5" max="3" step="0.25" :value="zoom" @input="zoom = Number($event.target.value)" />
      </label>
      <span class="note">{{ Math.round(zoom * 100) }}% &middot; approximate render</span>
    </div>

    <div class="lvgl-canvas__scroll">
      <div
        class="lvgl-canvas"
        :style="{ width: `${canvasWidth * zoom}px`, height: `${canvasHeight * zoom}px` }"
        @pointerdown.self="emit('select', '')"
      >
        <div
          v-for="entry in decorated"
          :key="entry.key"
          class="lvgl-canvas__widget"
          :class="[
            `lvgl-w--${entry.render.kind}`,
            {
              'is-selected': entry.uiId && entry.uiId === selectedId,
              'is-managed': entry.layoutManaged,
              'is-static': !entry.positionable
            }
          ]"
          :style="entry.boxStyle"
          :title="entry.layoutManaged ? 'Position controlled by parent layout' : entry.type"
          @pointerdown.stop="onWidgetPointerDown($event, entry)"
        >
          <!-- text-only: label -->
          <span v-if="entry.render.kind === 'label'" class="lvgl-canvas__label" :style="entry.render.textStyle">
            {{ entry.render.text }}
          </span>

          <!-- filled button -->
          <span v-else-if="entry.render.kind === 'button'" class="lvgl-canvas__btn-label">{{ entry.render.text }}</span>

          <!-- switch: pill track + knob -->
          <span v-else-if="entry.render.kind === 'switch'" class="lvgl-canvas__switch" :class="{ 'is-on': entry.render.on }">
            <i class="lvgl-canvas__switch-knob" />
          </span>

          <!-- checkbox: tickbox + label -->
          <span v-else-if="entry.render.kind === 'checkbox'" class="lvgl-canvas__check">
            <i class="lvgl-canvas__check-box" :class="{ 'is-checked': entry.render.checked }">
              <svg v-if="entry.render.checked" viewBox="0 0 16 16"><path d="M3 8.5l3.5 3.5L13 5" /></svg>
            </i>
            <span class="lvgl-canvas__check-text">{{ entry.render.text }}</span>
          </span>

          <!-- slider / bar: track + indicator (+ knob) -->
          <span
            v-else-if="entry.render.kind === 'bar'"
            class="lvgl-canvas__bar"
            :class="{ 'is-vertical': entry.render.vertical }"
          >
            <i
              class="lvgl-canvas__bar-fill"
              :style="entry.render.vertical
                ? { height: `${entry.render.fill}%`, background: entry.render.indicator }
                : { width: `${entry.render.fill}%`, background: entry.render.indicator }"
            />
            <i
              v-if="entry.render.knob"
              class="lvgl-canvas__bar-knob"
              :style="entry.render.vertical
                ? { bottom: `${entry.render.fill}%`, background: entry.render.knobColor }
                : { left: `${entry.render.fill}%`, background: entry.render.knobColor }"
            />
          </span>

          <!-- arc / spinner: background ring + indicator arc -->
          <svg v-else-if="entry.render.kind === 'arc'" class="lvgl-canvas__arc" viewBox="0 0 48 48">
            <path :d="ARC_TRACK_PATH" :stroke="entry.render.track" :stroke-width="entry.render.arcWidth" fill="none" stroke-linecap="round" />
            <path
              :d="ARC_TRACK_PATH"
              :stroke="entry.render.indicator"
              :stroke-width="entry.render.arcWidth"
              fill="none"
              stroke-linecap="round"
              :stroke-dasharray="ARC_LEN"
              :stroke-dashoffset="ARC_LEN * (1 - entry.render.fill / 100)"
            />
            <circle
              v-if="entry.render.knob"
              :cx="arcKnob(entry.render.fill).x"
              :cy="arcKnob(entry.render.fill).y"
              :r="entry.render.arcWidth * 0.9"
              :fill="entry.render.indicator"
            />
          </svg>

          <!-- dropdown: value + chevron -->
          <span v-else-if="entry.render.kind === 'dropdown'" class="lvgl-canvas__dropdown">
            <span class="lvgl-canvas__dropdown-text">{{ entry.render.text }}</span>
            <svg viewBox="0 0 12 12" class="lvgl-canvas__chevron"><path d="M2 4l4 4 4-4" /></svg>
          </span>

          <!-- roller: three stacked options, middle highlighted -->
          <span v-else-if="entry.render.kind === 'roller'" class="lvgl-canvas__roller">
            <span class="lvgl-canvas__roller-item is-dim">{{ entry.render.items[0] }}</span>
            <span class="lvgl-canvas__roller-item is-sel">{{ entry.render.items[1] }}</span>
            <span class="lvgl-canvas__roller-item is-dim">{{ entry.render.items[2] }}</span>
          </span>

          <!-- text field: textarea / spinbox -->
          <span v-else-if="entry.render.kind === 'field'" class="lvgl-canvas__field">
            <span class="lvgl-canvas__field-text">{{ entry.render.text }}</span>
            <i class="lvgl-canvas__caret" />
          </span>

          <!-- LED -->
          <span v-else-if="entry.render.kind === 'led'" class="lvgl-canvas__led" :style="{ background: entry.render.color, boxShadow: `0 0 ${8 * zoom}px ${entry.render.color}` }" />

          <!-- image-like -->
          <span v-else-if="entry.render.kind === 'image'" class="lvgl-canvas__image">
            <svg v-if="!entry.render.qr" viewBox="0 0 24 24"><path d="M3 5h18v14H3z" fill="none" /><circle cx="8" cy="10" r="2" /><path d="M4 18l5-5 3 3 4-4 4 4v2H4z" /></svg>
            <span v-else class="lvgl-canvas__qr" />
          </span>

          <!-- meter: gauge -->
          <svg v-else-if="entry.render.kind === 'meter'" class="lvgl-canvas__meter" viewBox="0 0 48 48">
            <path :d="ARC_TRACK_PATH" stroke="#c8c8cf" stroke-width="3" fill="none" />
            <g stroke="#9a9aa5" stroke-width="1.4">
              <line v-for="t in METER_TICKS" :key="t.i" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
            </g>
            <line x1="24" y1="24" :x2="meterNeedle.x" :y2="meterNeedle.y" :stroke="THEME.primary" stroke-width="2" stroke-linecap="round" />
            <circle cx="24" cy="24" r="2.5" :fill="THEME.primary" />
          </svg>

          <!-- tabview -->
          <span v-else-if="entry.render.kind === 'tabview'" class="lvgl-canvas__tabview">
            <span class="lvgl-canvas__tabbar"><i class="is-active" /><i /><i /></span>
          </span>

          <!-- cell grid: buttonmatrix / keyboard -->
          <span v-else-if="entry.render.kind === 'grid'" class="lvgl-canvas__cells">
            <i v-for="n in 8" :key="n" />
          </span>

          <!-- container / obj / fallback -->
          <span v-else class="lvgl-canvas__tag">{{ entry.type }}</span>

          <span v-if="entry.layoutManaged" class="lvgl-canvas__badge">{{ entry.layoutBadge }}</span>
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
  gridSize: { type: Number, default: 5 },
  // Preview mode: no W/H/zoom toolbar, no drag. Clicks still select so the parent
  // can open the edit modal on the right widget.
  interactive: { type: Boolean, default: true }
});

const emit = defineEmits(["select", "move", "resize-canvas"]);

const zoom = ref(1.5);

// LVGL default theme (Material design, light). Used when a widget doesn't set its
// own colour -- so the preview matches roughly what the device renders.
const THEME = {
  primary: "#2196f3",
  track: "#d4d4dc",
  knob: "#ffffff",
  surface: "#ffffff",
  border: "#c8c8cf",
  text: "#3b3b3b",
  led: "#ff0000"
};

const layout = computed(() => resolveLvglPageLayout(props.page, props.canvasWidth, props.canvasHeight));

const emitSize = (dim, event) => {
  const value = Math.max(16, Math.min(2000, Number(event.target.value) || 0));
  emit("resize-canvas", { dim, value });
};

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// widget prop colour, else the theme default for that role
const colour = (props_, key, fallback) => lvglColorToCss(props_[key]) || fallback;

const fillRatio = (p) => {
  const min = num(p.min_value, 0);
  const max = num(p.max_value, 100);
  const val = num(p.value, min);
  const span = max - min || 1;
  return Math.max(0, Math.min(100, ((val - min) / span) * 100));
};

// Descriptor per widget: kind + the pieces the template needs.
const render = (entry) => {
  const p = entry.node.props || {};
  const t = entry.type;

  if (t === "label") {
    return {
      kind: "label",
      text: String(p.text ?? "Label"),
      textStyle: { color: colour(p, "text_color", THEME.text) }
    };
  }
  if (t === "button") return { kind: "button", text: String(p.text ?? "") };
  if (t === "switch") return { kind: "switch", on: isTruthy(p.state ?? p.checked) };
  if (t === "checkbox") {
    return { kind: "checkbox", text: String(p.text ?? "Checkbox"), checked: isTruthy(p.state ?? p.checked) };
  }
  if (t === "slider" || t === "bar") {
    return {
      kind: "bar",
      fill: fillRatio(p),
      vertical: entry.box.h > entry.box.w * 1.4,
      knob: t === "slider",
      indicator: colour(p.indicator || {}, "bg_color", colour(p, "bg_color", THEME.primary)),
      knobColor: colour(p.knob || {}, "bg_color", THEME.primary)
    };
  }
  if (t === "arc" || t === "spinner") {
    return {
      kind: "arc",
      fill: t === "spinner" ? 28 : fillRatio(p),
      knob: t === "arc",
      arcWidth: 4,
      track: colour(p, "arc_color", "#d4d4dc"),
      indicator: colour(p.indicator || {}, "arc_color", THEME.primary)
    };
  }
  if (t === "dropdown") {
    return { kind: "dropdown", text: String(p.options?.[num(p.selected_index, 0)] ?? p.text ?? "Select") };
  }
  if (t === "roller") {
    const opts = Array.isArray(p.options) ? p.options : [];
    const sel = num(p.selected_index, 0);
    return {
      kind: "roller",
      items: [opts[sel - 1] ?? "", String(opts[sel] ?? p.text ?? "Option"), opts[sel + 1] ?? ""]
    };
  }
  if (t === "textarea" || t === "spinbox") {
    return { kind: "field", text: String(p.text ?? p.value ?? (t === "spinbox" ? "0" : "")) };
  }
  if (t === "led") return { kind: "led", color: colour(p, "color", colour(p, "bg_color", THEME.led)) };
  if (t === "qrcode") return { kind: "image", qr: true };
  if (t === "image" || t === "animimg" || t === "canvas") return { kind: "image", qr: false };
  if (t === "meter") return { kind: "meter" };
  if (t === "tabview" || t === "tileview") return { kind: "tabview" };
  if (t === "buttonmatrix" || t === "keyboard") return { kind: "grid" };
  return { kind: "box" };
};

const isTruthy = (v) => v === true || v === "true" || v === "on" || v === 1 || v === "1";

const boxStyle = (entry) => {
  const p = entry.node.props || {};
  const style = {
    left: `${entry.box.x * zoom.value}px`,
    top: `${entry.box.y * zoom.value}px`,
    width: `${entry.box.w * zoom.value}px`,
    height: `${entry.box.h * zoom.value}px`
  };
  // Explicit widget styling always wins over the kind's default look.
  const bg = lvglColorToCss(p.bg_color);
  if (bg) style.background = bg;
  const fg = lvglColorToCss(p.text_color);
  if (fg) style.color = fg;
  const radius = Number(p.radius);
  if (Number.isFinite(radius)) style.borderRadius = `${radius * zoom.value}px`;
  const border = lvglColorToCss(p.border_color);
  if (border) style.borderColor = border;
  const borderW = Number(p.border_width);
  if (Number.isFinite(borderW)) style.borderWidth = `${borderW}px`;
  return style;
};

const decorated = computed(() =>
  layout.value.map((entry) => ({
    ...entry,
    render: render(entry),
    boxStyle: boxStyle(entry),
    layoutBadge: entry.node?.props?.layout?.type === "GRID" ? "grid" : "flex"
  }))
);

// --- arc / meter geometry (240deg sweep, like LVGL's default arc) ---
const ARC_START = 150; // degrees
const ARC_SWEEP = 240;
const ARC_R = 18;
const polar = (deg) => ({
  x: 24 + ARC_R * Math.cos((deg * Math.PI) / 180),
  y: 24 + ARC_R * Math.sin((deg * Math.PI) / 180)
});
const ARC_TRACK_PATH = (() => {
  const a = polar(ARC_START);
  const b = polar(ARC_START + ARC_SWEEP);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${ARC_R} ${ARC_R} 0 1 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
})();
const ARC_LEN = (2 * Math.PI * ARC_R * ARC_SWEEP) / 360;
const arcKnob = (fillPct) => polar(ARC_START + (ARC_SWEEP * fillPct) / 100);

const METER_TICKS = Array.from({ length: 9 }, (_, i) => {
  const deg = ARC_START + (ARC_SWEEP * i) / 8;
  const inner = 24 + (ARC_R - 3) * Math.cos((deg * Math.PI) / 180);
  const innerY = 24 + (ARC_R - 3) * Math.sin((deg * Math.PI) / 180);
  const outer = polar(deg);
  return { i, x1: inner, y1: innerY, x2: outer.x, y2: outer.y };
});
const meterNeedle = polar(ARC_START + ARC_SWEEP * 0.62);

const dragState = ref(null);

const snap = (value) => Math.round(value / props.gridSize) * props.gridSize;

const onWidgetPointerDown = (event, entry) => {
  emit("select", entry.uiId || "");
  if (!props.interactive || !entry.positionable || !entry.uiId) return;
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
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  font-size: 11px;
  color: #3b3b3b;
  cursor: grab;
  user-select: none;
}

.lvgl-canvas__widget.is-static {
  cursor: default;
}

.is-preview .lvgl-canvas__widget {
  cursor: pointer;
}

.is-preview .lvgl-canvas__scroll {
  max-height: 360px;
}

.lvgl-canvas__widget.is-selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  z-index: 3;
}

/* ---- kinds ---- */

.lvgl-w--box,
.lvgl-w--tabview,
.lvgl-w--grid,
.lvgl-w--image,
.lvgl-w--dropdown,
.lvgl-w--roller,
.lvgl-w--field {
  border: 1px solid #c8c8cf;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.lvgl-canvas__widget.is-managed.lvgl-w--box {
  border-style: dashed;
}

.lvgl-w--label {
  justify-content: flex-start;
}

.lvgl-canvas__label {
  padding: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
}

.lvgl-canvas__tag {
  opacity: 0.5;
  font-size: 10px;
  text-transform: uppercase;
}

/* button */
.lvgl-w--button {
  background: #2196f3;
  color: #fff;
  border-radius: 5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.lvgl-canvas__btn-label {
  padding: 0 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* switch */
.lvgl-canvas__switch {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 14px;
  border-radius: 999px;
  background: #c8c8cf;
  transition: background 0.15s;
}

.lvgl-canvas__switch.is-on {
  background: #2196f3;
}

.lvgl-canvas__switch-knob {
  position: absolute;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
  height: calc(100% - 4px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  transition: left 0.15s;
}

.lvgl-canvas__switch.is-on .lvgl-canvas__switch-knob {
  left: calc(100% - 2px);
  transform: translate(-100%, -50%);
}

/* checkbox */
.lvgl-canvas__check {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 0 1px;
}

.lvgl-canvas__check-box {
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
  border: 1px solid #9a9aa5;
  border-radius: 3px;
  background: #fff;
  display: flex;
}

.lvgl-canvas__check-box.is-checked {
  background: #2196f3;
  border-color: #2196f3;
}

.lvgl-canvas__check-box svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: #fff;
  stroke-width: 2;
}

.lvgl-canvas__check-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* slider / bar */
.lvgl-canvas__bar {
  position: relative;
  width: 100%;
  height: 40%;
  min-height: 5px;
  border-radius: 999px;
  background: #d4d4dc;
  overflow: visible;
}

.lvgl-canvas__bar.is-vertical {
  width: 40%;
  min-width: 5px;
  height: 100%;
}

.lvgl-canvas__bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 999px;
  background: #2196f3;
}

.lvgl-canvas__bar.is-vertical .lvgl-canvas__bar-fill {
  bottom: 0;
  top: auto;
  width: 100%;
  height: 0;
}

.lvgl-canvas__bar-knob {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  margin-left: -8px;
  border-radius: 50%;
  background: #2196f3;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  transform: translateY(-50%);
}

.lvgl-canvas__bar.is-vertical .lvgl-canvas__bar-knob {
  top: auto;
  left: 50%;
  margin-left: 0;
  margin-bottom: -8px;
  transform: translateX(-50%);
}

/* arc / spinner / meter */
.lvgl-canvas__arc,
.lvgl-canvas__meter {
  width: 100%;
  height: 100%;
}

/* dropdown */
.lvgl-canvas__dropdown {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  padding: 0 5px;
}

.lvgl-canvas__dropdown-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lvgl-canvas__chevron {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  fill: none;
  stroke: #6b6b74;
  stroke-width: 1.6;
}

/* roller */
.lvgl-canvas__roller {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  line-height: 1.25;
}

.lvgl-canvas__roller-item {
  width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lvgl-canvas__roller-item.is-dim {
  opacity: 0.4;
}

.lvgl-canvas__roller-item.is-sel {
  border-top: 1px solid #d4d4dc;
  border-bottom: 1px solid #d4d4dc;
  font-weight: 600;
}

/* text field */
.lvgl-canvas__field {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 5px;
}

.lvgl-canvas__field-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lvgl-canvas__caret {
  width: 1px;
  height: 62%;
  background: #3b3b3b;
  margin-left: 1px;
}

/* LED */
.lvgl-canvas__led {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

/* image */
.lvgl-canvas__image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #9a9aa5;
}

.lvgl-canvas__image svg {
  width: 62%;
  height: 62%;
  fill: currentColor;
}

.lvgl-canvas__qr {
  width: 70%;
  height: 70%;
  background:
    conic-gradient(#1e293b 0 25%, #fff 0 50%, #1e293b 0 75%, #fff 0) 0 0 / 33.34% 33.34%;
}

/* tabview */
.lvgl-canvas__tabview {
  width: 100%;
  height: 100%;
}

.lvgl-canvas__tabbar {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-bottom: 1px solid #d4d4dc;
}

.lvgl-canvas__tabbar i {
  flex: 1;
  height: 6px;
  background: #e4e4ea;
  border-radius: 2px;
}

.lvgl-canvas__tabbar i.is-active {
  background: #2196f3;
}

/* cell grid */
.lvgl-canvas__cells {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  width: 100%;
  height: 100%;
  padding: 2px;
}

.lvgl-canvas__cells i {
  background: #e4e4ea;
  border-radius: 2px;
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
  z-index: 2;
}
</style>
