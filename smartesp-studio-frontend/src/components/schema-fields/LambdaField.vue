<template>
  <div class="lambda-field">
    <div v-if="showSnippets" class="lambda-field__toolbar">
      <button
        type="button"
        class="secondary compact"
        :title="t('builder.lambda.snippets.title')"
        @mousedown.prevent
        @click="snippetsOpen = !snippetsOpen"
      >
        +
      </button>
      <div v-if="snippetsOpen" class="id-ref-list lambda-field__snippets">
        <button
          v-for="snippet in snippets"
          :key="snippet.id"
          type="button"
          class="id-ref-option lambda-field__snippet"
          @mousedown.prevent="pickSnippet(snippet)"
        >
          <span>{{ t(`builder.lambda.snippets.${snippet.id}`) }}</span>
          <code>{{ snippet.insert }}</code>
        </button>
      </div>
    </div>
    <div class="lambda-field__editor">
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
      <div v-if="completionOpen" class="id-ref-list lambda-field__completion">
        <button
          v-for="(option, optionIndex) in completionOptions"
          :key="option.id"
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
    <ul v-if="warnings.length" class="notice notice--warning lambda-field__warnings">
      <li v-for="(warning, warningIndex) in warnings" :key="warningIndex">
        {{ warningText(warning) }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue";
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
  findMemberCompletionContext
} from "../../utils/lambdaMemberCompletion";
import { LAMBDA_SNIPPETS, insertSnippet } from "../../utils/lambdaSnippets";
import { escapeHtml, highlightYamlToHtml } from "../../utils/yamlSyntaxHighlight";

const props = defineProps({
  modelValue: { type: String, default: "" },
  inputId: { type: String, required: true },
  rows: { type: Number, default: 1 },
  language: { type: String, default: "cpp" },
  idIndex: { type: Array, default: () => [] }
});

const emit = defineEmits(["update:model-value"]);

const { t } = useI18n();

const textareaRef = ref(null);
const highlightRef = ref(null);
const highlighted = ref("");

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

function refreshCompletion() {
  const editor = textareaRef.value;
  if (!editor || props.language === "yaml") {
    completion.value = null;
    return;
  }
  const caret = editor.selectionStart ?? 0;
  const idContext = findIdCompletionContext(editor.value, caret);
  if (idContext) {
    completion.value = { kind: "id", ...idContext };
    activeOption.value = 0;
    return;
  }
  const memberContext = findMemberCompletionContext(editor.value, caret);
  if (memberContext) {
    const domain = props.idIndex.find((entry) => entry.id === memberContext.entityId)?.domain || "";
    completion.value = { kind: "member", domain, ...memberContext };
    activeOption.value = 0;
    return;
  }
  completion.value = null;
}

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

const snippets = LAMBDA_SNIPPETS;
const snippetsOpen = ref(false);
const showSnippets = computed(() => props.language !== "yaml");

const pickSnippet = async (snippet) => {
  const editor = textareaRef.value;
  if (!editor) return;
  const { text, caret } = insertSnippet(
    editor.value,
    editor.selectionStart ?? editor.value.length,
    editor.selectionEnd ?? editor.value.length,
    snippet.insert
  );
  snippetsOpen.value = false;
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
    pickCompletion(options[activeOption.value]);
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
}

.lambda-field__highlight,
.lambda-field__input {
  box-sizing: border-box;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 4px;
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
  position: relative;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.lambda-field__snippets {
  left: auto;
  min-width: 260px;
  max-height: 220px;
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
