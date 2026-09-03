<template>
  <div class="lambda-field">
    <div class="lambda-field__editor">
      <div class="lambda-field__gutter" aria-hidden="true">
        <div class="lambda-field__gutter-lines" :style="gutterStyle">
          <span
            v-for="lineNumber in editorLineNumbers"
            :key="lineNumber"
            :class="{ 'lambda-field__gutter-line--error': lineNumber === firstWarningLine }"
          >{{ lineNumber }}</span>
        </div>
      </div>
      <div class="lambda-field__editor-body">
        <div v-if="errorLineStyle" class="lambda-field__error-line" :style="errorLineStyle"></div>
        <pre ref="highlightRef" class="lambda-field__highlight hljs" aria-hidden="true" v-html="highlighted"></pre>
        <textarea
          :id="inputId"
          ref="textareaRef"
          class="lambda-textarea lambda-field__input"
          :value="modelValue"
          :rows="rows"
          wrap="off"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onInput"
          @scroll="syncScroll"
          @keydown="onKeydown"
          @keyup="refreshCompletion"
          @click="refreshCompletion"
          @blur="scheduleCompletionClose"
        ></textarea>
        <!-- mousedown.prevent auch am Container: sonst blurt ein Griff an die eigene
             Scrollbar die Textarea und scheduleCompletionClose raeumt die Liste weg. -->
        <div
          v-if="completionOpen"
          class="id-ref-list lambda-field__completion"
          @mousedown.prevent
        >
          <button
            v-for="(option, optionIndex) in completionOptions"
            :key="option.id"
            :ref="(el) => { if (el) optionRefs[optionIndex] = el; }"
            type="button"
            class="id-ref-option lambda-field__completion-option"
            :class="{ 'is-active': optionIndex === activeOption }"
            @mousedown.prevent="pickCompletion(option)"
          >
            <span>{{ option.insert }}</span>
            <span v-if="option.secondary" class="lambda-field__completion-domain">{{ option.secondary }}</span>
          </button>
        </div>
      </div>
      <div v-if="showPalette" class="lambda-field__toolbar">
        <button
          type="button"
          class="secondary compact"
          :title="t('builder.lambda.palette.title')"
          @mousedown.prevent
          @click="togglePalette"
        >
          +
        </button>
        <div v-if="paletteOpen" class="id-ref-list lambda-field__palette">
          <input
            v-model="paletteQuery"
            type="text"
            class="lambda-field__palette-search"
            :placeholder="t('builder.lambda.palette.searchPlaceholder')"
            @keydown.stop
          />
          <template v-for="section in filteredPaletteSections" :key="section.id">
            <div class="lambda-field__palette-section-title">{{ paletteSectionTitle(section.id) }}</div>
            <button
              v-for="item in section.items"
              :key="`${section.id}:${item.id}`"
              type="button"
              class="id-ref-option lambda-field__snippet"
              :title="paletteItemHint(section.id, item.id)"
              @mousedown.prevent="pickSnippet(item)"
            >
              <span>{{ paletteItemLabel(section.id, item.id) }}</span>
              <code>{{ item.insert }}</code>
            </button>
          </template>
          <div v-if="!filteredPaletteSections.length" class="lambda-field__palette-empty">
            {{ t("builder.lambda.palette.empty") }}
          </div>
        </div>
      </div>
    </div>
    <div v-if="buildError" class="notice notice--block notice--error lambda-field__build-error">
      {{ buildErrorText }}
    </div>
    <ul v-if="warnings.length" class="notice notice--warning lambda-field__warnings">
      <li v-for="(warning, warningIndex) in warnings" :key="warningIndex">
        {{ warningText(warning) }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { highlightCppToHtml } from "../../utils/cppSyntaxHighlight";
import {
  applyIdCompletion,
  buildIdCompletionOptions,
  findIdCompletionContext
} from "../../utils/lambdaCompletion";
import { lintLambda } from "../../utils/lambdaLint";
import {
  applyMemberCompletion,
  buildMemberCompletionOptions,
  findMemberCompletionContext,
  findNearestIdReference
} from "../../utils/lambdaMemberCompletion";
import { buildLambdaPaletteSections, filterLambdaPaletteSections } from "../../utils/lambdaPaletteSections";
import { insertSnippet } from "../../utils/lambdaSnippets";
import { escapeHtml, highlightYamlToHtml } from "../../utils/yamlSyntaxHighlight";

const props = defineProps({
  modelValue: { type: String, default: "" },
  inputId: { type: String, required: true },
  rows: { type: Number, default: 1 },
  language: { type: String, default: "cpp" },
  idIndex: { type: Array, default: () => [] },
  contextScopeId: { type: String, default: "" },
  encodedFieldPath: { type: String, default: "" }
});

const emit = defineEmits(["update:model-value"]);

const { t } = useI18n();

const textareaRef = ref(null);
const highlightRef = ref(null);
const highlighted = ref("");

// Feste Metriken, damit die Fehlerzeile pixelgenau ueber der passenden Code-Zeile
// sitzt -- muss zu .lambda-field__highlight/.lambda-field__input passen
// (font: 400 13px/1.5, padding: 6px 10px).
const LAMBDA_LINE_HEIGHT = 19.5;
const LAMBDA_VERTICAL_PADDING = 6;

const editorScrollTop = ref(0);

const editorLineNumbers = computed(() => {
  const lineCount = Math.max(1, String(props.modelValue || "").split(/\r\n|\r|\n/).length);
  return Array.from({ length: lineCount }, (_, index) => index + 1);
});

const gutterStyle = computed(() => ({ transform: `translateY(${-editorScrollTop.value}px)` }));

// The highlighter resolves asynchronously (lazy hljs import); a stale run must not
// overwrite the markup of a newer keystroke.
let renderToken = 0;

const render = async (source) => {
  const token = (renderToken += 1);
  const text = String(source ?? "");
  highlighted.value = escapeHtml(text);
  const html =
    props.language === "yaml" ? await highlightYamlToHtml(text) : await highlightCppToHtml(text);
  if (token === renderToken) highlighted.value = html;
};

const syncScroll = () => {
  const editor = textareaRef.value;
  const overlay = highlightRef.value;
  if (!editor || !overlay) return;
  overlay.scrollTop = editor.scrollTop;
  overlay.scrollLeft = editor.scrollLeft;
  editorScrollTop.value = editor.scrollTop;
};

const onInput = (event) => {
  emit("update:model-value", event.target.value);
  syncScroll();
  refreshCompletion();
};

// completion holds either { kind: "id", ...idContext } (still-open id( call) or
// { kind: "member", domain, ...memberContext } (id(x). already closed). Both are
// handled by the same dropdown/keyboard/mouse plumbing below.
const completion = ref(null);
const activeOption = ref(0);
const optionRefs = ref([]);

const completionOptions = computed(() => {
  if (!completion.value) return [];
  if (completion.value.kind === "id") {
    return buildIdCompletionOptions(props.idIndex, completion.value.query).map((entry) => ({
      id: entry.id,
      insert: entry.id,
      secondary: entry.domain || ""
    }));
  }
  return buildMemberCompletionOptions(completion.value.domain, completion.value.query).map((entry) => ({
    id: entry.id,
    insert: entry.insert,
    secondary: ""
  }));
});
const completionOpen = computed(() => Boolean(completion.value) && completionOptions.value.length > 0);

const findCompletionContext = (editor) => {
  const caret = editor.selectionStart ?? 0;
  const idContext = findIdCompletionContext(editor.value, caret);
  if (idContext) return { kind: "id", ...idContext };
  const memberContext = findMemberCompletionContext(editor.value, caret);
  if (!memberContext) return null;
  const domain = props.idIndex.find((entry) => entry.id === memberContext.entityId)?.domain || "";
  return { kind: "member", domain, ...memberContext };
};

const completionSignature = (context) =>
  context ? `${context.kind}|${context.start}|${context.query}` : "";

function refreshCompletion() {
  const editor = textareaRef.value;
  const next = editor && props.language !== "yaml" ? findCompletionContext(editor) : null;
  // Nur bei echtem Kontextwechsel zurueck auf den ersten Vorschlag. Das keyup nach
  // jedem ArrowDown liefert denselben Kontext -- ein blinder Reset wuerde die gerade
  // getroffene Auswahl sofort wieder aufheben.
  if (completionSignature(next) !== completionSignature(completion.value)) {
    activeOption.value = 0;
  }
  completion.value = next;
  if (next) paletteOpen.value = false;
}

// Schrumpft die Trefferliste (weitergetippt), darf der Index nicht ins Leere zeigen.
watch(completionOptions, (options) => {
  optionRefs.value = [];
  if (activeOption.value >= options.length) activeOption.value = 0;
});

watch(activeOption, async () => {
  await nextTick();
  // jsdom kennt scrollIntoView nicht -- optionaler Aufruf, damit die Specs tragen.
  optionRefs.value[activeOption.value]?.scrollIntoView?.({ block: "nearest" });
});

const scheduleCompletionClose = () => {
  window.setTimeout(() => {
    completion.value = null;
  }, 150);
};

const pickCompletion = async (option) => {
  const editor = textareaRef.value;
  if (!editor || !completion.value) return;
  const { text, caret } =
    completion.value.kind === "id"
      ? applyIdCompletion(editor.value, completion.value, option.id)
      : applyMemberCompletion(editor.value, completion.value, option);
  completion.value = null;
  emit("update:model-value", text);
  await nextTick();
  const current = textareaRef.value;
  if (!current) return;
  current.focus();
  current.setSelectionRange(caret, caret);
};

const paletteOpen = ref(false);
const paletteQuery = ref("");
const paletteSuggestedDomain = ref("");
const showPalette = computed(() => props.language !== "yaml");

// Snapshot beim Oeffnen, nicht reaktiv waehrend des Tippens -- ein unter der
// Maus wegspringender Vorschlag waere schlechter als ein fester Stand.
const togglePalette = () => {
  if (paletteOpen.value) {
    paletteOpen.value = false;
    return;
  }
  // "+" nutzt @mousedown.prevent, damit der Klick die Textarea nicht blurt --
  // dadurch feuert scheduleCompletionClose nie. Ohne dies wuerde eine noch
  // offene id(/Member-Vervollstaendigung stehen bleiben und mit der Palette
  // ueberlappen.
  completion.value = null;
  const editor = textareaRef.value;
  const reference = editor
    ? findNearestIdReference(editor.value, editor.selectionStart ?? editor.value.length)
    : null;
  paletteSuggestedDomain.value = reference
    ? props.idIndex.find((entry) => entry.id === reference.entityId)?.domain || ""
    : "";
  paletteQuery.value = "";
  paletteOpen.value = true;
};

const paletteSections = computed(() =>
  buildLambdaPaletteSections({ suggestedDomain: paletteSuggestedDomain.value })
);

const paletteSectionTitle = (sectionId) => {
  if (sectionId === "suggested") return t("builder.lambda.palette.suggested");
  if (sectionId === "snippets") return t("builder.lambda.palette.snippetsTitle");
  if (sectionId === "scope") return t("builder.lambda.palette.scopeTitle");
  return t(`builder.lambda.categories.${sectionId.replace("category:", "")}`);
};

const paletteItemLabel = (sectionId, itemId) => {
  if (sectionId === "snippets") return t(`builder.lambda.snippets.${itemId}`);
  if (sectionId === "scope") return t(`builder.lambda.scope.${itemId}.label`);
  if (sectionId === "suggested") {
    return t(`builder.lambda.members.${paletteSuggestedDomain.value}.${itemId}.label`);
  }
  return t(`builder.lambda.globals.${itemId}.label`);
};

const paletteItemHint = (sectionId, itemId) => {
  if (sectionId === "snippets") return "";
  if (sectionId === "scope") return t(`builder.lambda.scope.${itemId}.hint`);
  if (sectionId === "suggested") {
    return t(`builder.lambda.members.${paletteSuggestedDomain.value}.${itemId}.hint`);
  }
  return t(`builder.lambda.globals.${itemId}.hint`);
};

const filteredPaletteSections = computed(() =>
  filterLambdaPaletteSections(paletteSections.value, paletteQuery.value, {
    labelFor: (sectionId, item) => paletteItemLabel(sectionId, item.id)
  })
);

const pickSnippet = async (snippet) => {
  const editor = textareaRef.value;
  if (!editor) return;
  const { text, caret } = insertSnippet(
    editor.value,
    editor.selectionStart ?? editor.value.length,
    editor.selectionEnd ?? editor.value.length,
    snippet.insert
  );
  paletteOpen.value = false;
  emit("update:model-value", text);
  await nextTick();
  const current = textareaRef.value;
  if (!current) return;
  current.focus();
  current.setSelectionRange(caret, caret);
};

const onKeydown = (event) => {
  if (!completionOpen.value) return;
  const options = completionOptions.value;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeOption.value = (activeOption.value + 1) % options.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeOption.value = (activeOption.value - 1 + options.length) % options.length;
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    pickCompletion(options[activeOption.value] ?? options[0]);
  } else if (event.key === "Escape") {
    // Sonst schliesst Esc das umgebende Modal statt der Vorschlagsliste.
    event.preventDefault();
    event.stopPropagation();
    completion.value = null;
  }
};

watch(() => [props.modelValue, props.language], () => render(props.modelValue));
onMounted(() => render(props.modelValue));

// Nur fuer Lambdas -- YAML-Felder haben ihre eigene Pruefung beim Speichern.
const warnings = computed(() =>
  props.language === "yaml" ? [] : lintLambda(props.modelValue, props.idIndex)
);

// Vom "Pruefen"-Job durchgereichte Backend-Fehler (Teil B des Lambda-Plans,
// resolveLambdaBuildErrorTargets in lambdaBuildErrors.js), bereitgestellt von
// BuilderView.vue als provide("lambdaBuildErrors", ref<Array>). Kein Match, wenn
// niemand provided (z. B. isolierte Tests) -- injizierter Default ist dann leer.
const lambdaBuildErrors = inject("lambdaBuildErrors", ref([]));

const buildError = computed(() => {
  if (!props.contextScopeId || !props.encodedFieldPath) return null;
  return (
    lambdaBuildErrors.value.find(
      (entry) => entry.scopeId === props.contextScopeId && entry.encodedPath === props.encodedFieldPath
    ) || null
  );
});

const buildErrorText = computed(() => {
  const error = buildError.value;
  if (!error) return "";
  return error.message
    ? t("builder.lambda.buildError", { line: error.line, message: error.message })
    : t("builder.lambda.buildErrorGeneric", { line: error.line });
});

// Erste Warnung wird im Gutter/als Fehlerzeile hervorgehoben -- ein Backend-Fehler
// ist die verlaesslichere Quelle und gewinnt, wenn beide vorliegen.
const firstWarningLine = computed(() => buildError.value?.line || warnings.value[0]?.line || 0);

const errorLineStyle = computed(() => {
  const line = firstWarningLine.value;
  if (!line) return null;
  const top = LAMBDA_VERTICAL_PADDING + (line - 1) * LAMBDA_LINE_HEIGHT - editorScrollTop.value;
  return { top: `${top}px`, height: `${LAMBDA_LINE_HEIGHT}px` };
});

const warningText = (warning) =>
  t(`builder.lambda.warn.${warning.code}`, {
    token: warning.token || "",
    id: warning.id || "",
    line: warning.line,
    column: warning.column
  });
</script>

<style scoped>
.lambda-field__editor {
  position: relative;
  display: flex;
}

.lambda-field__gutter {
  position: relative;
  flex: 0 0 auto;
  width: 2.75em;
  overflow: hidden;
  border: 1px solid var(--accent-line);
  border-right: none;
  border-radius: 4px 0 0 4px;
  background: #eef2f6;
  pointer-events: none;
}

.lambda-field__gutter-lines {
  padding: 6px 6px 6px 0;
  display: grid;
  grid-auto-rows: 19.5px;
  color: #94a3b8;
  font: 400 13px/1.5 "Courier New", Courier, monospace;
  text-align: right;
  user-select: none;
  will-change: transform;
}

.lambda-field__gutter-lines span {
  height: 19.5px;
}

.lambda-field__gutter-line--error {
  color: #dc2626;
  font-weight: 700;
}

.lambda-field__editor-body {
  position: relative;
  flex: 1;
  min-width: 0;
}

.lambda-field__error-line {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 2;
  pointer-events: none;
  border-left: 3px solid #ef4444;
  background: rgba(239, 68, 68, 0.12);
}

.lambda-field__highlight,
.lambda-field__input {
  box-sizing: border-box;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 0 4px 4px 0;
  padding: 6px 10px;
  font: 400 13px/1.5 "Courier New", Courier, monospace;
  font-variant-ligatures: none;
  letter-spacing: normal;
  word-spacing: normal;
  tab-size: 8;
  white-space: pre;
}

.lambda-field__highlight {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #f8fafc;
  color: var(--navy);
}

/* Lets the overlay scroll as far right as the textarea does on long lines. */
.lambda-field__highlight::after {
  content: "";
  display: block;
  width: max-content;
  min-width: 100%;
  height: 1.5em;
}

.lambda-field__input {
  position: relative;
  display: block;
  width: 100%;
  border-color: var(--accent-line);
  background: transparent;
  color: transparent;
  caret-color: var(--navy);
  overflow: auto;
}

.lambda-field__toolbar {
  /* Positionierungskontext der Palette -- sitzt rechts neben dem Editor. */
  position: relative;
  flex: 0 0 auto;
  align-self: flex-start;
  margin-left: 4px;
}

.lambda-field__palette {
  /* Klappt nach links ueber den Editor auf, sonst ragt sie aus der Karte. */
  left: auto;
  right: 0;
  min-width: 320px;
  max-width: min(420px, 80vw);
  max-height: 320px;
  overflow-y: auto;
}

.lambda-field__palette-search {
  width: 100%;
  margin-bottom: 6px;
}

.lambda-field__palette-section-title {
  margin: 8px 0 4px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #334155;
}

.lambda-field__palette-empty {
  color: #64748b;
  font-size: 12px;
  padding: 8px 4px;
}

.lambda-field__snippet {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.lambda-field__snippet code {
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}

.lambda-field__completion-option {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.lambda-field__completion-option.is-active {
  background: var(--accent-line);
}

.lambda-field__completion-domain {
  color: #64748b;
  font-size: 11px;
}

.lambda-field__warnings {
  margin: 6px 0 0;
  padding-left: 18px;
}

:deep(.lambda-field__highlight *) {
  font: inherit;
  font-variant-ligatures: inherit;
  letter-spacing: inherit;
  word-spacing: inherit;
}

:deep(.lambda-field__highlight .hljs-comment),
:deep(.lambda-field__highlight .hljs-quote) {
  color: #64748b;
  font-style: italic;
}

:deep(.lambda-field__highlight .hljs-keyword),
:deep(.lambda-field__highlight .hljs-literal),
:deep(.lambda-field__highlight .hljs-type) {
  color: #7c3aed;
}

:deep(.lambda-field__highlight .hljs-string),
:deep(.lambda-field__highlight .hljs-meta-string) {
  color: #15803d;
}

:deep(.lambda-field__highlight .hljs-number) {
  color: #b45309;
}

:deep(.lambda-field__highlight .hljs-built_in),
:deep(.lambda-field__highlight .hljs-title),
:deep(.lambda-field__highlight .hljs-attr),
:deep(.lambda-field__highlight .hljs-attribute),
:deep(.lambda-field__highlight .hljs-name),
:deep(.lambda-field__highlight .hljs-section) {
  color: var(--accent-strong);
}

:deep(.lambda-field__highlight .hljs-meta) {
  color: #0369a1;
}
</style>
