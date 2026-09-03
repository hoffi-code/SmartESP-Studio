// Kuratierte Bausteine fuer Lambdas. Bewusst kurz gehalten: das sind die Ausdruecke,
// die in ESPHome-Lambdas staendig vorkommen -- kein Katalog aller Moeglichkeiten.
// `x` ist der Platzhalter, den der Nutzer ersetzt.

export const LAMBDA_SNIPPETS = [
  { id: "idState", insert: "id(x).state" },
  { id: "idPosition", insert: "id(x).position" },
  { id: "toString", insert: "to_string(x)" },
  { id: "sprintf", insert: 'str_sprintf("%.1f", x)' },
  { id: "log", insert: 'ESP_LOGD("tag", "value %d", x)' },
  { id: "return", insert: "return x;" },
  { id: "lvglLabel", insert: 'lv_label_set_text(id(x), "text")' }
];

export const insertSnippet = (source, start, end, snippet) => {
  const text = String(source ?? "");
  const from = Math.max(0, Math.min(Number(start) || 0, text.length));
  const to = Math.max(from, Math.min(Number(end) || from, text.length));
  return {
    text: `${text.slice(0, from)}${snippet}${text.slice(to)}`,
    caret: from + snippet.length
  };
};
