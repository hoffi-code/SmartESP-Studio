import { LAMBDA_MEMBER_CATALOG } from "./lambdaMemberCatalog";

// Erkennt, ob der Cursor direkt hinter einem abgeschlossenen id(<entity>).-Aufruf
// steht, und liefert dessen Member-Optionen. Ergaenzt findIdCompletionContext
// (das den noch offenen id(-Aufruf behandelt) um den Fall danach.

const IDENT = /[A-Za-z0-9_]/;

// findMemberCompletionContext(source, caret) -> { start, end, query, entityId } | null
// Scannt rueckwaerts: Identifier (Member-Query) -> direkt davor muss "." stehen
// (kein Whitespace toleriert) -> direkt davor ")" -> ein einzelner nackter
// Identifier zwischen den Klammern (kein verschachtelter Aufruf, keine
// Leerzeichen darin) -> davor ein alleinstehendes "id" wie bei
// findIdCompletionContext. Jeder Zeilenumbruch dazwischen bricht die exakten
// Zeichenpruefungen automatisch ab.
export const findMemberCompletionContext = (source, caret) => {
  const text = String(source ?? "");
  const position = Math.max(0, Math.min(Number(caret) || 0, text.length));

  let index = position - 1;
  while (index >= 0 && IDENT.test(text[index])) index -= 1;
  const start = index + 1;
  const query = text.slice(start, position);

  if (text[index] !== ".") return null;
  index -= 1;
  if (text[index] !== ")") return null;
  index -= 1;

  const argEnd = index;
  while (index >= 0 && IDENT.test(text[index])) index -= 1;
  const argStart = index + 1;
  if (argStart > argEnd) return null;
  const entityId = text.slice(argStart, argEnd + 1);

  if (text[index] !== "(") return null;
  index -= 1;
  if (index < 1 || text[index] !== "d" || text[index - 1] !== "i") return null;
  if (index - 2 >= 0 && IDENT.test(text[index - 2])) return null;

  return { start, end: position, query, entityId };
};

// buildMemberCompletionOptions(domain, query = "") -> [{ id, insert }]
export const buildMemberCompletionOptions = (domain, query = "") => {
  const entries = LAMBDA_MEMBER_CATALOG[domain];
  if (!entries) return [];
  const term = String(query || "").toLowerCase();
  return entries
    .filter((entry) => !term || entry.id.toLowerCase().startsWith(term))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
};

// applyMemberCompletion(source, context, member) -> { text, caret }
// Kein Multi-Stop-Platzhalter fuer das "x"-Argument -- gleiche Hand-Edit-
// Konvention wie insertSnippet.
export const applyMemberCompletion = (source, context, member) => {
  const text = String(source ?? "");
  const inserted = member.insert;
  return {
    text: `${text.slice(0, context.start)}${inserted}${text.slice(context.end)}`,
    caret: context.start + inserted.length
  };
};

const ID_REFERENCE = /\bid\s*\(\s*([A-Za-z_]\w*)\s*\)/g;

// findNearestIdReference(source, caret) -> { entityId, start, end } | null
// Letzter id(<entity>)-Treffer, der vor dem Cursor endet -- nur fuer die
// "Suggested"-Sektion der Palette, keine Masking von Kommentaren/Strings
// (gleiche Heuristik wie lambdaLints ID_CALL, akzeptiert fuer eine reine
// UI-Vorschlagssektion).
export const findNearestIdReference = (source, caret) => {
  const text = String(source ?? "");
  const position = Math.max(0, Math.min(Number(caret) || 0, text.length));
  ID_REFERENCE.lastIndex = 0;
  let match = ID_REFERENCE.exec(text);
  let found = null;
  while (match) {
    const end = match.index + match[0].length;
    if (end <= position) {
      found = { entityId: match[1], start: match.index, end };
    }
    match = ID_REFERENCE.exec(text);
  }
  return found;
};
