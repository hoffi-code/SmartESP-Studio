// Heuristischer Lambda-Check: unbalancierte Klammern/Quotes und id(...)-Referenzen
// ohne Ziel im ID-Index. Kein C++-Parser und bewusst nie blockierend -- Lambdas
// duerfen alles enthalten, was der Compiler spaeter akzeptiert.

const OPENERS = { "(": ")", "[": "]", "{": "}" };
const CLOSERS = { ")": "(", "]": "[", "}": "{" };

const positionAt = (text, offset) => {
  const before = text.slice(0, offset);
  const lastBreak = before.lastIndexOf("\n");
  return { line: before.split("\n").length, column: offset - lastBreak };
};

// Ersetzt Kommentar- und String-Inhalte durch Leerzeichen, damit Offsets stimmen
// und die id()-Suche nicht in Kommentaren/Strings anschlaegt. Nebenbei fallen die
// Klammer-/Quote-Warnungen ab.
const scan = (text) => {
  const warnings = [];
  const masked = [];
  const stack = [];
  let index = 0;

  const push = (count) => {
    for (let i = 0; i < count; i += 1) masked.push(" ");
  };

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", index);
      const stop = end === -1 ? text.length : end;
      push(stop - index);
      index = stop;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (let i = index; i < stop; i += 1) masked.push(text[i] === "\n" ? "\n" : " ");
      index = stop;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const start = index;
      let cursor = index + 1;
      let closed = false;
      while (cursor < text.length) {
        if (text[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (text[cursor] === quote) {
          closed = true;
          break;
        }
        if (text[cursor] === "\n") break;
        cursor += 1;
      }
      const stop = closed ? cursor + 1 : Math.min(cursor, text.length);
      for (let i = start; i < stop; i += 1) masked.push(text[i] === "\n" ? "\n" : " ");
      if (!closed) {
        warnings.push({ code: "unclosedString", token: quote, ...positionAt(text, start) });
      }
      index = stop;
      continue;
    }

    if (OPENERS[char]) {
      stack.push({ token: char, offset: index });
    } else if (CLOSERS[char]) {
      const top = stack[stack.length - 1];
      if (top && top.token === CLOSERS[char]) {
        stack.pop();
      } else {
        warnings.push({ code: "unexpected", token: char, ...positionAt(text, index) });
      }
    }

    masked.push(char);
    index += 1;
  }

  stack.forEach((entry) => {
    warnings.push({ code: "unclosed", token: entry.token, ...positionAt(text, entry.offset) });
  });

  return { warnings, masked: masked.join("") };
};

const ID_CALL = /\bid\s*\(\s*([A-Za-z_]\w*)\s*\)/g;

export const lintLambda = (source, idIndex = []) => {
  const text = String(source ?? "");
  if (!text.trim()) return [];

  const { warnings, masked } = scan(text);

  // Ohne ID-Index (Feld ausserhalb des Builders, Index noch nicht gebaut) waere
  // jede Referenz "unbekannt" -- dann lieber gar nicht pruefen.
  const known = new Set((idIndex || []).map((entry) => entry?.id).filter(Boolean));
  if (known.size) {
    ID_CALL.lastIndex = 0;
    let match = ID_CALL.exec(masked);
    while (match) {
      if (!known.has(match[1])) {
        warnings.push({ code: "unknownId", id: match[1], ...positionAt(text, match.index) });
      }
      match = ID_CALL.exec(masked);
    }
  }

  return warnings.sort((a, b) => a.line - b.line || a.column - b.column);
};
