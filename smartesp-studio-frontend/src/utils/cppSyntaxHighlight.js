import { escapeHtml } from "./yamlSyntaxHighlight";

// Same lazy-load shape as yamlSyntaxHighlight: highlight.js core plus the single
// language module, pulled in only when a lambda field is actually rendered.

export const highlightCppFallback = (source) => escapeHtml(source);

let cppHighlighter = null;
let cppHighlighterPromise = null;

export const ensureCppHighlighter = async () => {
  if (cppHighlighter) return cppHighlighter;
  if (cppHighlighterPromise) return cppHighlighterPromise;
  cppHighlighterPromise = import("highlight.js/lib/core")
    .then(async ({ default: hljs }) => {
      const { default: cpp } = await import("highlight.js/lib/languages/cpp");
      hljs.registerLanguage("cpp", cpp);
      cppHighlighter = hljs;
      return hljs;
    })
    .finally(() => {
      cppHighlighterPromise = null;
    });
  return cppHighlighterPromise;
};

export const highlightCppToHtml = async (source) => {
  const text = String(source || "");
  if (!text.trim()) return highlightCppFallback(text);
  try {
    const hljs = await ensureCppHighlighter();
    return hljs.highlight(text, { language: "cpp" }).value;
  } catch {
    return highlightCppFallback(text);
  }
};
