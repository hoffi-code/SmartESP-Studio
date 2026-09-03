// Erkennt, ob der Cursor in einem offenen id(-Aufruf steht, und liefert die
// Optionen dafuer. Bewusst nur dieser eine Trigger -- kein generelles C++-Completion.

const IDENT = /[A-Za-z0-9_]/;
const SPACE = /[ \t\n]/;

export const findIdCompletionContext = (source, caret) => {
  const text = String(source ?? "");
  const position = Math.max(0, Math.min(Number(caret) || 0, text.length));

  let index = position - 1;
  while (index >= 0 && IDENT.test(text[index])) index -= 1;
  const start = index + 1;

  while (index >= 0 && SPACE.test(text[index])) index -= 1;
  if (text[index] !== "(") return null;

  index -= 1;
  while (index >= 0 && SPACE.test(text[index])) index -= 1;
  if (index < 1 || text[index] !== "d" || text[index - 1] !== "i") return null;
  if (index - 2 >= 0 && IDENT.test(text[index - 2])) return null;

  return { start, end: position, query: text.slice(start, position) };
};

export const buildIdCompletionOptions = (idIndex, query = "") => {
  const term = String(query || "").toLowerCase();
  const seen = new Set();
  return (idIndex || [])
    .filter((entry) => entry?.id && !seen.has(entry.id) && seen.add(entry.id))
    .filter((entry) => !term || entry.idLower?.startsWith(term) || entry.id.toLowerCase().startsWith(term))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => ({ id: entry.id, domain: entry.domain || "" }));
};

// Fuegt die gewaehlte ID ein und schliesst die Klammer, sofern nicht schon eine
// direkt hinter dem Cursor steht.
export const applyIdCompletion = (source, context, id) => {
  const text = String(source ?? "");
  const hasClosing = text[context.end] === ")";
  const inserted = hasClosing ? id : `${id})`;
  return {
    text: `${text.slice(0, context.start)}${inserted}${text.slice(context.end)}`,
    caret: context.start + inserted.length + (hasClosing ? 1 : 0)
  };
};
