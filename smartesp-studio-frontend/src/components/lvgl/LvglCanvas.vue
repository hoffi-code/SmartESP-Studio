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
        :class="{ 'is-mono': mono }"
        :style="screenStyle"
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
              'is-static': !entry.positionable,
              'is-disabled': entry.disabled
            }
          ]"
          :style="entry.boxStyle"
          :title="entry.layoutManaged ? t('lvgl.canvas.layoutManaged') : entry.type"
          @pointerdown.stop="onWidgetPointerDown($event, entry)"
        >
          <!-- text-only: label -->
          <span
            v-if="entry.render.kind === 'label'"
            class="lvgl-canvas__label"
            :class="entry.render.longClass"
            :style="entry.render.textStyle"
          >
            {{ entry.render.text }}
          </span>

          <!-- filled button -->
          <span v-else-if="entry.render.kind === 'button'" class="lvgl-canvas__btn-label">{{ entry.render.text }}</span>

          <!-- switch: pill track + knob -->
          <span
            v-else-if="entry.render.kind === 'switch'"
            class="lvgl-canvas__switch"
            :class="{ 'is-on': entry.render.on, 'is-vertical': entry.render.vertical }"
          >
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
                ? { bottom: `${entry.render.fillStart}%`, height: `${entry.render.fillEnd - entry.render.fillStart}%`, background: entry.render.indicator }
                : { left: `${entry.render.fillStart}%`, width: `${entry.render.fillEnd - entry.render.fillStart}%`, background: entry.render.indicator }"
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
            <path :d="entry.render.path" :stroke="entry.render.track" :stroke-width="entry.render.arcWidth" fill="none" stroke-linecap="round" />
            <path
              :d="entry.render.path"
              :stroke="entry.render.indicator"
              :stroke-width="entry.render.arcWidth"
              fill="none"
              stroke-linecap="round"
              :stroke-dasharray="entry.render.len"
              :stroke-dashoffset="entry.render.len * (1 - entry.render.fill / 100)"
            />
            <circle
              v-if="entry.render.knob"
              :cx="entry.render.knobPt.x"
              :cy="entry.render.knobPt.y"
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
          <span
            v-else-if="entry.render.kind === 'image'"
            class="lvgl-canvas__image"
            :style="[
              entry.render.transform ? { transform: entry.render.transform } : null,
              entry.render.recolor ? { color: entry.render.recolor } : null
            ]"
          >
            <img
              v-if="entry.render.url"
              class="lvgl-canvas__image-real"
              :src="entry.render.url"
              alt=""
              draggable="false"
            />
            <svg v-else-if="!entry.render.qr" viewBox="0 0 24 24"><path d="M3 5h18v14H3z" fill="none" /><circle cx="8" cy="10" r="2" /><path d="M4 18l5-5 3 3 4-4 4 4v2H4z" /></svg>
            <span
              v-else
              class="lvgl-canvas__qr"
              :style="{ '--qr-dark': entry.render.qrDark, '--qr-light': entry.render.qrLight }"
            />
          </span>

          <!-- meter: gauge driven by scales[0] -->
          <svg v-else-if="entry.render.kind === 'meter'" class="lvgl-canvas__meter" viewBox="0 0 48 48">
            <path :d="entry.render.path" :stroke="entry.render.trackColor" stroke-width="3" fill="none" />
            <path
              v-for="(a, ai) in entry.render.arcs"
              :key="`a${ai}`"
              :d="entry.render.path"
              :stroke="a.color"
              stroke-width="3"
              fill="none"
              stroke-linecap="butt"
              :stroke-dasharray="entry.render.len"
              :stroke-dashoffset="entry.render.len * (1 - (a.to - a.from))"
              :style="{ transform: `rotate(${entry.render.sweep * a.from}deg)`, transformOrigin: '24px 24px' }"
            />
            <g :stroke="entry.render.tickColor" stroke-width="1.2">
              <line
                v-for="t in entry.render.ticks"
                :key="t.i"
                :x1="t.x1"
                :y1="t.y1"
                :x2="t.x2"
                :y2="t.y2"
              />
            </g>
            <line
              v-for="(n, ni) in entry.render.needles"
              :key="`n${ni}`"
              x1="24"
              y1="24"
              :x2="n.tip.x"
              :y2="n.tip.y"
              :stroke="n.color"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle cx="24" cy="24" r="2.5" :fill="THEME.primary" />
          </svg>

          <!-- tabview / tileview -->
          <span v-else-if="entry.render.kind === 'tabview'" class="lvgl-canvas__tabview">
            <span class="lvgl-canvas__tabbar">
              <i
                v-for="(name, ti) in entry.render.tabs"
                :key="ti"
                :class="{ 'is-active': ti === (activeGroup[entry.uiId] ?? 0) }"
                @pointerdown.stop="setActiveGroup(entry.uiId, ti)"
              >{{ name }}</i>
            </span>
          </span>

          <!-- button matrix: real rows + labels -->
          <span v-else-if="entry.render.kind === 'btnmatrix'" class="lvgl-canvas__btnmatrix">
            <span v-for="(row, ri) in entry.render.rows" :key="ri" class="lvgl-canvas__btnrow">
              <i v-for="(label, bi) in row" :key="bi">{{ label }}</i>
            </span>
          </span>

          <!-- line: polyline of the widget's own points -->
          <svg
            v-else-if="entry.render.kind === 'line'"
            class="lvgl-canvas__line"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <polyline :points="linePolyline(entry.render.points)" fill="none" :stroke="entry.render.stroke" :stroke-width="entry.render.strokeWidth" vector-effect="non-scaling-stroke" />
          </svg>

          <!-- cell grid: keyboard / empty buttonmatrix -->
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
import { ref, computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import { resolveLvglPageLayout, lvglColorToCss, lvglFontPx } from "../../utils/lvglLayout";

const { t } = useI18n();

// BuilderView resolves an image widget's `src` id to a browser URL; null in isolation.
const imageResolver = inject("lvglImageResolver", null);

const props = defineProps({
  page: { type: Object, default: null },
  canvasWidth: { type: Number, default: 240 },
  canvasHeight: { type: Number, default: 320 },
  selectedId: { type: String, default: "" },
  gridSize: { type: Number, default: 5 },
  // Preview mode: no W/H/zoom toolbar, no drag. Clicks still select so the parent
  // can open the edit modal on the right widget.
  interactive: { type: Boolean, default: true },
  // { monochrome, background, backgroundOpacity, foreground } -- the screen the
  // widgets are drawn on. A 1-bit display renders strictly two-colour.
  displayPalette: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["select", "move", "resize-canvas"]);

const zoom = ref(1.5);

const mono = computed(() => Boolean(props.displayPalette?.monochrome));
const fg = computed(() => props.displayPalette?.foreground || "#e8f6ff");
const screenBg = computed(() => props.displayPalette?.background || "#ffffff");
const screenStyle = computed(() => {
  const style = {
    width: `${props.canvasWidth * zoom.value}px`,
    height: `${props.canvasHeight * zoom.value}px`,
    background: screenBg.value
  };
  const opa = Number(props.displayPalette?.backgroundOpacity);
  if (Number.isFinite(opa) && opa < 1) style.opacity = String(Math.max(0, opa));
  if (mono.value) style["--lvgl-fg"] = fg.value;
  return style;
});

// LVGL default theme (Material design, light). Used when a widget doesn't set its
// own colour -- so the preview matches roughly what the device renders. On a
// monochrome display every role collapses to the single foreground colour.
const THEME = computed(() =>
  mono.value
    ? {
        primary: fg.value,
        track: fg.value,
        knob: fg.value,
        surface: screenBg.value,
        border: fg.value,
        text: fg.value,
        led: fg.value
      }
    : {
        primary: "#2196f3",
        track: "#d4d4dc",
        knob: "#ffffff",
        surface: "#ffffff",
        border: "#c8c8cf",
        text: "#3b3b3b",
        led: "#ff0000"
      }
);

// Which tab/tile is shown per tabview/tileview node (uiId -> index). Local UI
// state only -- never written back to the config.
const activeGroup = ref({});
const setActiveGroup = (uiId, index) => {
  activeGroup.value = { ...activeGroup.value, [uiId]: index };
};

const layout = computed(() =>
  resolveLvglPageLayout(props.page, props.canvasWidth, props.canvasHeight, (node) => activeGroup.value[node.uiId] ?? 0)
);

const emitSize = (dim, event) => {
  const value = Math.max(16, Math.min(2000, Number(event.target.value) || 0));
  emit("resize-canvas", { dim, value });
};

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// LVGL opacity: "NN%", 0-255, or already 0..1 -> CSS 0..1. undefined stays undefined.
const opa01 = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const pct = String(value).trim().match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pct) return Math.max(0, Math.min(1, Number(pct[1]) / 100));
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return n > 1 ? Math.max(0, Math.min(1, n / 255)) : Math.max(0, Math.min(1, n));
};

const rgbaWithAlpha = (css, alpha) => {
  if (alpha === undefined || alpha >= 1) return css;
  const hex = String(css).trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return css;
};

// widget prop colour, else the theme default for that role. A monochrome display
// can't show widget colours, so every colour collapses to the foreground.
const colour = (props_, key, fallback) => {
  if (mono.value) return fg.value;
  return lvglColorToCss(props_[key]) || fallback;
};

// Position of `value` inside [min_value, max_value] as a 0..100 percentage.
const pctOf = (p, value) => {
  const min = num(p.min_value, 0);
  const max = num(p.max_value, 100);
  const span = max - min || 1;
  return Math.max(0, Math.min(100, ((value - min) / span) * 100));
};

const fillRatio = (p) => pctOf(p, num(p.value, num(p.min_value, 0)));

// Descriptor per widget: kind + the pieces the template needs.
const render = (entry) => {
  const p = entry.node.props || {};
  const t = entry.type;
  const theme = THEME.value;

  if (t === "label") {
    // long_mode: WRAP breaks to multiple lines, CLIP/SCROLL cut without an
    // ellipsis, DOT (and the unset default here) truncate with "...".
    const lm = String(p.long_mode || "").toUpperCase();
    const longClass =
      lm === "WRAP"
        ? "is-wrap"
        : lm === "CLIP" || lm === "SCROLL" || lm === "SCROLL_CIRCULAR"
          ? "is-clip"
          : "";
    const textStyle = { color: colour(p, "text_color", theme.text) };
    const align = String(p.text_align || "").toUpperCase();
    if (align === "CENTER") textStyle.textAlign = "center";
    else if (align === "RIGHT") textStyle.textAlign = "right";
    else if (align === "LEFT") textStyle.textAlign = "left";
    const textOpa = opa01(p.text_opa);
    if (textOpa !== undefined && textOpa < 1) textStyle.opacity = String(textOpa);
    return {
      kind: "label",
      text: String(p.text ?? "Label"),
      longClass,
      textStyle
    };
  }
  if (t === "button") return { kind: "button", text: String(p.text ?? "") };
  if (t === "switch") {
    return { kind: "switch", on: initialChecked(p), vertical: entry.box.h > entry.box.w };
  }
  if (t === "checkbox") {
    return { kind: "checkbox", text: String(p.text ?? "Checkbox"), checked: initialChecked(p) };
  }
  if (t === "slider" || t === "bar") {
    const mode = String(p.mode || "NORMAL").toUpperCase();
    const end = fillRatio(p);
    let start = 0;
    if (mode === "RANGE") {
      start = pctOf(p, num(p.start_value, num(p.min_value, 0)));
    } else if (mode === "SYMMETRICAL") {
      // Fill grows from the range's zero crossing (clamped into range) to value.
      start = pctOf(p, Math.max(num(p.min_value, 0), Math.min(num(p.max_value, 100), 0)));
    }
    return {
      kind: "bar",
      fill: end,
      fillStart: Math.min(start, end),
      fillEnd: Math.max(start, end),
      vertical: entry.box.h > entry.box.w * 1.4,
      knob: t === "slider",
      indicator: colour(p.indicator || {}, "bg_color", colour(p, "bg_color", theme.primary)),
      knobColor: colour(p.knob || {}, "bg_color", theme.primary)
    };
  }
  if (t === "arc" || t === "spinner") {
    const isSpinner = t === "spinner";
    let start = num(p.start_angle, DEFAULT_ARC.start) + num(p.rotation, 0);
    let sweep = (((num(p.end_angle, 45) - num(p.start_angle, DEFAULT_ARC.start)) % 360) + 360) % 360 || 360;
    let fill = fillRatio(p);
    if (isSpinner) {
      start = 0;
      sweep = 360;
      fill = Math.max(5, Math.min(95, (num(p.arc_length, 60) / 360) * 100));
    }
    return {
      kind: "arc",
      fill,
      knob: t === "arc",
      arcWidth: Math.max(1, num(p.arc_width ?? (p.indicator || {}).arc_width, 4)),
      sweep,
      path: arcPath(start, sweep),
      len: arcLen(sweep),
      knobPt: arcPointAt(start, sweep, fill / 100),
      track: mono.value ? theme.track : colour(p, "arc_color", "#d4d4dc"),
      indicator: colour(p.indicator || {}, "arc_color", theme.primary)
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
    let text;
    if (t === "spinbox") {
      const dp = Math.max(0, Math.min(6, Math.round(num(p.decimal_places, 0))));
      text = (num(p.value, 0) / 10 ** dp).toFixed(dp);
    } else if (isTruthy(p.password_mode)) {
      text = "•".repeat(Math.min(Math.max(String(p.text ?? "").length, 4), 12));
    } else {
      text = String(p.text ?? p.placeholder_text ?? "");
    }
    return { kind: "field", text };
  }
  if (t === "led") return { kind: "led", color: colour(p, "color", colour(p, "bg_color", theme.led)) };
  if (t === "qrcode") {
    return {
      kind: "image",
      qr: true,
      qrDark: mono.value ? theme.primary : lvglColorToCss(p.dark_color) || "#1e293b",
      qrLight: mono.value ? "transparent" : lvglColorToCss(p.light_color) || "#ffffff"
    };
  }
  if (t === "image" || t === "animimg" || t === "canvas") {
    // ESPHome image angle = degrees; zoom = 256 -> 1x.
    const angle = num(p.angle, 0);
    const zoom = num(p.zoom, 256) / 256;
    const parts = [];
    if (angle) parts.push(`rotate(${angle}deg)`);
    if (zoom && zoom !== 1) parts.push(`scale(${zoom})`);
    // Render the real bitmap for image/animimg when their src resolves; canvas has
    // no static content, so it stays a placeholder.
    const url = t !== "canvas" && typeof imageResolver === "function" ? imageResolver(p.src) : "";
    return {
      kind: "image",
      qr: false,
      url: url || "",
      transform: parts.join(" "),
      recolor: lvglColorToCss(p.image_recolor)
    };
  }
  if (t === "meter") {
    const s = (Array.isArray(p.scales) ? p.scales : [])[0] || {};
    const from = num(s.range_from, 0);
    const to = num(s.range_to, 100);
    const span = to - from || 1;
    const sweep = num(s.angle_range, 270);
    // LVGL centres a partial range on the bottom gap unless rotation is given.
    const start = s.rotation !== undefined && s.rotation !== ""
      ? num(s.rotation, 0)
      : 90 + (360 - sweep) / 2;
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const needles = [];
    const arcs = [];
    for (const ind of Array.isArray(s.indicators) ? s.indicators : []) {
      if (ind?.line && ind.line.value !== undefined) {
        const frac = clamp((num(ind.line.value, from) - from) / span);
        needles.push({ tip: arcPointAt(start, sweep, frac), color: colour(ind.line, "color", theme.primary) });
      } else if (ind?.arc) {
        const sv = num(ind.arc.start_value, from);
        const ev = num(ind.arc.end_value ?? ind.arc.value, to);
        arcs.push({ from: clamp((sv - from) / span), to: clamp((ev - from) / span), color: colour(ind.arc, "color", theme.primary) });
      }
    }
    if (!needles.length && !arcs.length) needles.push({ tip: arcPointAt(start, sweep, 0.62), color: theme.primary });
    const tickCount = Math.max(2, Math.min(40, Math.round(num(s.ticks?.count, 12))));
    return {
      kind: "meter",
      sweep,
      path: arcPath(start, sweep),
      len: arcLen(sweep),
      ticks: meterTicks(tickCount, start, sweep),
      needles,
      arcs,
      trackColor: mono.value ? theme.border : "#c8c8cf",
      tickColor: mono.value ? theme.border : "#9a9aa5"
    };
  }
  if (t === "tabview" || t === "tileview") {
    const groups = entry.node.tabs || entry.node.tiles || [];
    return {
      kind: "tabview",
      tabs: groups.length ? groups.map((g, i) => String(g.name || g.id || i + 1)) : ["Tab 1", "Tab 2", "Tab 3"]
    };
  }
  if (t === "buttonmatrix") {
    const rows = (Array.isArray(p.rows) ? p.rows : [])
      .map((r) => (Array.isArray(r?.buttons) ? r.buttons.map((b) => String(b?.text ?? "")) : []))
      .filter((r) => r.length);
    return rows.length ? { kind: "btnmatrix", rows } : { kind: "grid" };
  }
  if (t === "keyboard") return { kind: "grid" };
  if (t === "line") {
    const pts = (Array.isArray(p.points) ? p.points : [])
      .map((pt) => ({ x: num(pt?.x, NaN), y: num(pt?.y, NaN) }))
      .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
    return pts.length >= 2
      ? {
          kind: "line",
          points: pts,
          stroke: colour(p, "line_color", theme.primary),
          strokeWidth: num(p.line_width, 2)
        }
      : { kind: "box" };
  }
  return { kind: "box" };
};

// Fit the line's own point coords into its box (LVGL draws line points relative
// to the widget's top-left; we just want a recognisable shape in the preview).
const linePolyline = (points) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const minY = Math.min(...ys, 0);
  const w = Math.max(...xs) - minX || 1;
  const h = Math.max(...ys) - minY || 1;
  return points.map((p) => `${(((p.x - minX) / w) * 100).toFixed(1)},${(((p.y - minY) / h) * 100).toFixed(1)}`).join(" ");
};

const isTruthy = (v) => v === true || v === "true" || v === "on" || v === 1 || v === "1";

// ESPHome sets a widget's initial on/off through `state: { checked: true }`;
// tolerate a scalar `state`/`checked` from older builder data too.
const initialChecked = (p) => {
  const s = p.state;
  if (s && typeof s === "object") return isTruthy(s.checked);
  return isTruthy(s ?? p.checked);
};

const boxStyle = (entry) => {
  const p = entry.node.props || {};
  const isMono = mono.value;
  const style = {
    left: `${entry.box.x * zoom.value}px`,
    top: `${entry.box.y * zoom.value}px`,
    width: `${entry.box.w * zoom.value}px`,
    height: `${entry.box.h * zoom.value}px`
  };
  // Explicit widget styling always wins over the kind's default look. A monochrome
  // display shows no fills/shadows -- just the foreground outline + text.
  const bg = isMono ? "" : lvglColorToCss(p.bg_color);
  const grad = isMono ? "" : lvglColorToCss(p.bg_grad_color);
  if (grad) {
    const dir = String(p.bg_grad_dir || "VER").toUpperCase() === "HOR" ? "to right" : "to bottom";
    style.background = `linear-gradient(${dir}, ${bg || "#fff"}, ${grad})`;
  } else if (bg) {
    style.background = rgbaWithAlpha(bg, opa01(p.bg_opa));
  }
  const textFg = isMono ? (lvglColorToCss(p.text_color) ? fg.value : "") : lvglColorToCss(p.text_color);
  if (textFg) style.color = textFg;
  const radius = Number(p.radius);
  if (Number.isFinite(radius)) style.borderRadius = `${radius * zoom.value}px`;
  const border = isMono
    ? (lvglColorToCss(p.border_color) ? fg.value : "")
    : lvglColorToCss(p.border_color);
  if (border) style.borderColor = border;
  const borderW = Number(p.border_width);
  if (Number.isFinite(borderW)) style.borderWidth = `${borderW}px`;
  // outline sits outside the border; LVGL defaults its pad to ~0.
  const outlineW = Number(p.outline_width);
  const outlineC = isMono
    ? (lvglColorToCss(p.outline_color) ? fg.value : "")
    : lvglColorToCss(p.outline_color);
  if (Number.isFinite(outlineW) && outlineW > 0 && (outlineC || isMono)) {
    style.outline = `${outlineW}px solid ${outlineC || fg.value}`;
    const pad = num(p.outline_pad, 0) * zoom.value;
    if (pad) style.outlineOffset = `${pad}px`;
  }
  // shadow_width is the blur radius; offsets/colour optional.
  const shadowW = Number(p.shadow_width);
  if (!isMono && Number.isFinite(shadowW) && shadowW > 0) {
    const ox = num(p.shadow_offset_x, 0) * zoom.value;
    const oy = num(p.shadow_offset_y, 0) * zoom.value;
    const spread = num(p.shadow_spread, 0) * zoom.value;
    style.boxShadow = `${ox}px ${oy}px ${shadowW * zoom.value}px ${spread}px ${lvglColorToCss(p.shadow_color) || "rgba(0,0,0,0.4)"}`;
  }
  const widgetOpa = opa01(p.opa);
  if (widgetOpa !== undefined && widgetOpa < 1) style.opacity = String(widgetOpa);
  const fontPx = lvglFontPx(entry.node);
  if (fontPx !== 14 || p.text_font) style.fontSize = `${fontPx * zoom.value}px`;
  return style;
};

const decorated = computed(() =>
  layout.value.map((entry) => ({
    ...entry,
    render: render(entry),
    boxStyle: boxStyle(entry),
    disabled: isTruthy(entry.node?.props?.state?.disabled),
    layoutBadge: entry.node?.props?.layout?.type === "GRID" ? "grid" : "flex"
  }))
);

// --- arc / meter geometry, drawn in a 48x48 viewBox around centre (24,24) ---
// LVGL's default arc background runs 135deg -> 45deg clockwise (a 270deg sweep
// with the gap at the bottom); meter scales default to a 270deg angle_range.
const ARC_R = 18;
const DEFAULT_ARC = { start: 135, sweep: 270 };
const polar = (deg) => ({
  x: 24 + ARC_R * Math.cos((deg * Math.PI) / 180),
  y: 24 + ARC_R * Math.sin((deg * Math.PI) / 180)
});
// A near-full turn is clamped so the SVG arc's start and end points differ.
const clampSweep = (sweep) => Math.max(1, Math.min(359.9, sweep));
const arcPath = (start, sweep) => {
  const s = clampSweep(sweep);
  const a = polar(start);
  const b = polar(start + s);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${ARC_R} ${ARC_R} 0 ${s > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};
const arcLen = (sweep) => (2 * Math.PI * ARC_R * clampSweep(sweep)) / 360;
const arcPointAt = (start, sweep, frac) => polar(start + sweep * frac);

const meterTicks = (count, start, sweep) => {
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, i) => {
    const deg = start + (sweep * i) / (n - 1);
    const rad = (deg * Math.PI) / 180;
    const outer = polar(deg);
    return { i, x1: 24 + (ARC_R - 3) * Math.cos(rad), y1: 24 + (ARC_R - 3) * Math.sin(rad), x2: outer.x, y2: outer.y };
  });
};

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

/* Monochrome display: strictly two-colour. Widgets draw in the foreground
   (currentColor, set from --lvgl-fg), fills come from the screen background. */
.lvgl-canvas.is-mono {
  color: var(--lvgl-fg);
}

.lvgl-canvas.is-mono .lvgl-canvas__widget,
.lvgl-canvas.is-mono .lvgl-canvas__tag {
  color: var(--lvgl-fg);
}

.lvgl-canvas.is-mono .lvgl-w--box,
.lvgl-canvas.is-mono .lvgl-w--tabview,
.lvgl-canvas.is-mono .lvgl-w--grid,
.lvgl-canvas.is-mono .lvgl-w--btnmatrix,
.lvgl-canvas.is-mono .lvgl-w--image,
.lvgl-canvas.is-mono .lvgl-w--dropdown,
.lvgl-canvas.is-mono .lvgl-w--roller,
.lvgl-canvas.is-mono .lvgl-w--field,
.lvgl-canvas.is-mono .lvgl-w--button {
  background: transparent;
  border-color: currentColor;
}

.lvgl-canvas.is-mono .lvgl-w--button {
  color: var(--lvgl-fg);
  box-shadow: inset 0 0 0 1px currentColor;
}

.lvgl-canvas.is-mono .lvgl-canvas__switch,
.lvgl-canvas.is-mono .lvgl-canvas__bar {
  background: transparent;
  box-shadow: inset 0 0 0 1px currentColor;
}

.lvgl-canvas.is-mono .lvgl-canvas__switch.is-on,
.lvgl-canvas.is-mono .lvgl-canvas__bar-fill,
.lvgl-canvas.is-mono .lvgl-canvas__switch-knob,
.lvgl-canvas.is-mono .lvgl-canvas__bar-knob,
.lvgl-canvas.is-mono .lvgl-canvas__check-box.is-checked {
  background: currentColor;
}

.lvgl-canvas.is-mono .lvgl-canvas__switch-knob,
.lvgl-canvas.is-mono .lvgl-canvas__bar-knob {
  box-shadow: none;
  border-color: var(--lvgl-fg);
}

.lvgl-canvas.is-mono .lvgl-canvas__check-box {
  background: transparent;
  border-color: currentColor;
}

.lvgl-canvas.is-mono .lvgl-canvas__check-box.is-checked svg {
  stroke: var(--lvgl-fg);
  filter: invert(1);
}

.lvgl-canvas.is-mono .lvgl-canvas__chevron,
.lvgl-canvas.is-mono .lvgl-canvas__caret {
  stroke: currentColor;
  background: currentColor;
}

.lvgl-canvas.is-mono .lvgl-canvas__roller-item.is-sel {
  border-color: currentColor;
}

.lvgl-canvas.is-mono .lvgl-canvas__qr {
  background:
    conic-gradient(currentColor 0 25%, transparent 0 50%, currentColor 0 75%, transparent 0) 0 0 / 33.34% 33.34%;
}

.lvgl-canvas.is-mono .lvgl-canvas__image {
  color: var(--lvgl-fg);
}

.lvgl-canvas.is-mono .lvgl-canvas__cells i,
.lvgl-canvas.is-mono .lvgl-canvas__btnmatrix i,
.lvgl-canvas.is-mono .lvgl-canvas__tabbar i {
  background: transparent;
  border-color: currentColor;
  color: currentColor;
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

/* state: { disabled: true } */
.lvgl-canvas__widget.is-disabled {
  opacity: 0.4;
}

/* ---- kinds ---- */

.lvgl-w--box,
.lvgl-w--tabview,
.lvgl-w--grid,
.lvgl-w--btnmatrix,
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
  width: 100%;
  padding: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
}

.lvgl-canvas__label.is-wrap {
  white-space: normal;
  text-overflow: clip;
}

.lvgl-canvas__label.is-clip {
  text-overflow: clip;
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

/* vertical switch: LVGL flips orientation when height > width; knob "on" = top */
.lvgl-canvas__switch.is-vertical .lvgl-canvas__switch-knob {
  top: auto;
  bottom: 2px;
  left: 50%;
  width: calc(100% - 4px);
  height: auto;
  transform: translate(-50%, 0);
  transition: bottom 0.15s;
}

.lvgl-canvas__switch.is-vertical.is-on .lvgl-canvas__switch-knob {
  bottom: calc(100% - 2px);
  transform: translate(-50%, 100%);
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

.lvgl-canvas__image-real {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.lvgl-canvas__qr {
  width: 70%;
  height: 70%;
  background:
    conic-gradient(
        var(--qr-dark, #1e293b) 0 25%,
        var(--qr-light, #fff) 0 50%,
        var(--qr-dark, #1e293b) 0 75%,
        var(--qr-light, #fff) 0
      )
      0 0 / 33.34% 33.34%;
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
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12px;
  padding: 1px 3px;
  font-style: normal;
  font-size: 9px;
  white-space: nowrap;
  overflow: hidden;
  background: #e4e4ea;
  border-radius: 2px;
  color: #6b6b74;
}

.lvgl-canvas__tabbar i.is-active {
  background: #2196f3;
  color: #fff;
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

/* button matrix */
.lvgl-canvas__btnmatrix {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  height: 100%;
  padding: 2px;
}

.lvgl-canvas__btnrow {
  display: flex;
  flex: 1;
  gap: 2px;
}

.lvgl-canvas__btnrow i {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  background: #e9e9ef;
  border-radius: 2px;
  font-size: 9px;
  font-style: normal;
  white-space: nowrap;
  overflow: hidden;
}

/* line */
.lvgl-canvas__line {
  width: 100%;
  height: 100%;
  overflow: visible;
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
