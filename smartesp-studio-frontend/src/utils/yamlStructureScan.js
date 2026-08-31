// Shared raw-text structure scanning used both by the import-preview line annotator
// (yamlImportLineAnnotations.js) and by the comment-preservation capture pass
// (yamlProjectImport.js). Operates on an array of { text } line objects.

const TOP_LEVEL_KEY_RE = /^([A-Za-z0-9_-]+):(?:\s|$)/;
const FIELD_KEY_RE = /^(\s*)([A-Za-z0-9_.-]+):(?:\s|$)/;

export const isNonEmptyLine = (line) => String(line || "").trim() !== "";

export const isCommentLine = (line) => String(line || "").trim().startsWith("#");

export const indentationOf = (text) => {
  const match = String(text || "").match(/^(\s*)/);
  return match ? match[1].length : 0;
};

export const isListItemAtIndent = (text, indent) => {
  const line = String(text || "");
  return indentationOf(line) === indent && /^\s*-\s+/.test(line);
};

// Top-level (column-0) `key:` blocks, in document order, each spanning to just before the next.
// A trailing run of blank/comment lines belongs to the *next* block (it is that section's leading
// comment, not trailing content of this one) and is excluded from `end`.
export const buildTopLevelBlocks = (lines) => {
  const starts = [];
  lines.forEach((line, index) => {
    const match = line.text.match(TOP_LEVEL_KEY_RE);
    if (!match) return;
    starts.push({ key: match[1], start: index });
  });

  return starts.map((entry, index) => {
    const rawEnd = index + 1 < starts.length ? starts[index + 1].start - 1 : lines.length - 1;
    let end = rawEnd;
    while (end > entry.start) {
      const text = lines[end]?.text ?? "";
      const trimmed = text.trim();
      if (trimmed !== "" && !trimmed.startsWith("#")) break;
      end -= 1;
    }
    return { ...entry, end };
  });
};

// The list items (`- ...`) at the shallowest indentation directly inside a top-level block.
export const findFirstLevelListItems = (lines, block) => {
  if (!block) return [];
  const candidates = [];
  for (let index = block.start + 1; index <= block.end; index += 1) {
    const text = lines[index]?.text || "";
    const match = text.match(/^(\s*)-\s*/);
    if (!match) continue;
    candidates.push({ index, indent: match[1].length });
  }
  if (!candidates.length) return [];
  const firstLevelIndent = Math.min(...candidates.map((item) => item.indent));
  const starts = candidates.filter((item) => item.indent === firstLevelIndent);
  return starts.map((entry, index) => ({
    start: entry.index,
    end: index + 1 < starts.length ? starts[index + 1].index - 1 : block.end
  }));
};

// The direct field lines (shallowest `key:` indentation) inside one list item, skipping the
// item's own start line (its first field sits inline after the `- ` marker).
const findItemFieldLines = (lines, item) => {
  const candidates = [];
  for (let index = item.start + 1; index <= item.end; index += 1) {
    const text = lines[index]?.text || "";
    const match = text.match(FIELD_KEY_RE);
    if (!match) continue;
    candidates.push({ index, indent: match[1].length, key: match[2] });
  }
  if (!candidates.length) return [];
  const fieldIndent = Math.min(...candidates.map((entry) => entry.indent));
  return candidates.filter((entry) => entry.indent === fieldIndent);
};

// Comment/blank-line run immediately above `index`, trimmed of leading/trailing blanks.
// Returns null when there is no such run, otherwise the joined text plus its line-index range
// (so callers that only care about line numbers, e.g. the import-preview annotator, don't need to
// re-derive them from the text).
const collectPrecedingComment = (lines, index) => {
  const collected = [];
  let cursor = index - 1;
  while (cursor >= 0) {
    const text = lines[cursor]?.text ?? "";
    const trimmed = text.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      collected.unshift({ index: cursor, text });
      cursor -= 1;
      continue;
    }
    break;
  }
  while (collected.length && collected[0].text.trim() === "") collected.shift();
  while (collected.length && collected[collected.length - 1].text.trim() === "") collected.pop();
  if (!collected.length) return null;
  return {
    // Dedented: stored comments describe content, not source indentation, so they can be
    // re-indented to match wherever they get re-emitted.
    text: collected.map((entry) => entry.text.trim()).join("\n"),
    startIndex: collected[0].index,
    endIndex: collected[collected.length - 1].index
  };
};

// Every comment block preceding a top-level section (`output:`, `spi:`, ...), a first-level list
// item as a whole (`output[1]`), or a direct field within such an item (`touchscreen[0].calibration`).
// The very first block in the document is skipped -- its leading comment is the file header,
// handled separately by extractLeadingHeaderComment. Returns `{ path, text, startIndex, endIndex }[]`.
export const findSectionComments = (yamlText) => {
  const rawLines = String(yamlText || "").split(/\r?\n/);
  const lines = rawLines.map((text) => ({ text }));
  const blocks = buildTopLevelBlocks(lines);
  const results = [];

  blocks.forEach((block, blockIndex) => {
    if (blockIndex === 0) return;

    const sectionComment = collectPrecedingComment(lines, block.start);
    if (sectionComment) results.push({ path: block.key, ...sectionComment });

    findFirstLevelListItems(lines, block).forEach((item, itemIndex) => {
      const itemComment = collectPrecedingComment(lines, item.start);
      if (itemComment) results.push({ path: `${block.key}[${itemIndex}]`, ...itemComment });

      findItemFieldLines(lines, item).forEach((field) => {
        const fieldComment = collectPrecedingComment(lines, field.index);
        if (!fieldComment) return;
        results.push({ path: `${block.key}[${itemIndex}].${field.key}`, ...fieldComment });
      });
    });
  });

  return results;
};

// Same data as findSectionComments, keyed by path -- what gets stored on the project config.
export const extractSectionComments = (yamlText) => {
  const comments = {};
  findSectionComments(yamlText).forEach((entry) => {
    comments[entry.path] = entry.text;
  });
  return comments;
};
