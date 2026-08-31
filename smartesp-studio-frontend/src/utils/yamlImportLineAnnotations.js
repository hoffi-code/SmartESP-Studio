import {
  buildTopLevelBlocks,
  findFirstLevelListItems,
  findSectionComments,
  indentationOf,
  isCommentLine,
  isListItemAtIndent,
  isNonEmptyLine
} from "./yamlStructureScan";

const STATUS_PRIORITY = {
  neutral: 0,
  mapped: 1,
  dropped: 2,
  unmapped: 2,
  error: 3
};

const setStatus = (line, status, message = "") => {
  if (!line || !status) return;
  if ((STATUS_PRIORITY[status] || 0) < (STATUS_PRIORITY[line.status] || 0)) return;
  line.status = status;
  if (message) line.message = message;
};

const applyBlockStatus = (lines, block, status, message) => {
  if (!block) return;
  for (let index = block.start; index <= block.end; index += 1) {
    if (!isNonEmptyLine(lines[index]?.text)) continue;
    setStatus(lines[index], status, message);
  }
};

const keyFromReportPath = (path) => {
  const text = String(path || "");
  const indexedSegment = text.lastIndexOf("].");
  if (indexedSegment >= 0) return text.slice(indexedSegment + 2).replace(/\[[0-9]+\]$/, "") || "";
  const parts = text.split(".");
  return parts[parts.length - 1]?.replace(/\[[0-9]+\]$/, "") || "";
};

const isYamlBlockScalarHeader = (text) => /:\s*[|>](?:[+-][0-9]?|[0-9][+-]?)?\s*(?:#.*)?$/.test(String(text || ""));

const hasInlineYamlValue = (text) => /:\s*\S+/.test(String(text || "")) && !isYamlBlockScalarHeader(text);

const markReportKeys = ({ lines, item, keys, status, message }) => {
  (Array.isArray(keys) ? keys : []).forEach((path) => {
    const key = keyFromReportPath(path);
    if (!key) return;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keyPattern = new RegExp(`^\\s*(?:-\\s*)?${escapedKey}(?::|\\s|$)`);
    for (let index = item.start; index <= item.end; index += 1) {
      const text = lines[index]?.text || "";
      if (!keyPattern.test(text)) continue;
      const keyIndent = indentationOf(text);
      setStatus(lines[index], status, message);
      if (hasInlineYamlValue(text)) continue;
      for (let childIndex = index + 1; childIndex <= item.end; childIndex += 1) {
        const childText = lines[childIndex]?.text || "";
        if (!isNonEmptyLine(childText)) continue;
        if (isCommentLine(childText)) {
          setStatus(lines[childIndex], status, message);
          continue;
        }
        const childIndent = indentationOf(childText);
        if (isListItemAtIndent(childText, keyIndent)) {
          setStatus(lines[childIndex], status, message);
          continue;
        }
        if (childIndent <= keyIndent) break;
        setStatus(lines[childIndex], status, message);
      }
    }
  });
};

const isComponentPath = (path) => /^[A-Za-z0-9_-]+\[[0-9]+\]$/.test(String(path || ""));

const topLevelKeyFromPath = (path) => {
  const text = String(path || "");
  if (!text || isComponentPath(text)) return "";
  return text.split(/[.[]/, 1)[0] || "";
};

const componentPathParts = (path) => {
  const match = String(path || "").match(/^([A-Za-z0-9_-]+)\[([0-9]+)\]$/);
  if (!match) return null;
  return {
    domain: match[1],
    index: Number(match[2])
  };
};

const markImportedComponentDomain = ({ lines, blocksByKey, entry }) => {
  if (entry?.status !== "mapped" && entry?.status !== "partial") return;
  const componentParts = componentPathParts(entry.path);
  if (!componentParts) return;
  const block = blocksByKey.get(componentParts.domain);
  if (!block) return;
  setStatus(lines[block.start], "mapped", entry.message || "Imported component domain");
};

const resolveReportScope = ({ path, blocksByKey, componentItemsByPath }) => {
  const componentParts = componentPathParts(path);
  if (componentParts) {
    return componentItemsByPath.get(`${componentParts.domain}[${componentParts.index}]`) || null;
  }

  const key = topLevelKeyFromPath(path);
  return key ? blocksByKey.get(key) || null : null;
};

const hasReportKeys = (entry) =>
  Boolean(
    (Array.isArray(entry?.mappedKeys) && entry.mappedKeys.length) ||
      (Array.isArray(entry?.droppedKeys) && entry.droppedKeys.length) ||
      (Array.isArray(entry?.unmappedKeys) && entry.unmappedKeys.length)
  );

const markCommentsDropped = (lines) => {
  lines.forEach((line) => {
    if (!isCommentLine(line.text)) return;
    if (line.status !== "neutral") return;
    setStatus(line, "dropped", "YAML comments are not imported");
  });
};

const markHeaderCommentImported = (lines, headerCommentLineCount) => {
  const count = Number(headerCommentLineCount) || 0;
  for (let index = 0; index < count && index < lines.length; index += 1) {
    setStatus(lines[index], "mapped", "Imported as project header comment");
  }
};

const markSectionCommentsImported = (lines, yamlText) => {
  findSectionComments(yamlText).forEach(({ startIndex, endIndex }) => {
    for (let index = startIndex; index <= endIndex && index < lines.length; index += 1) {
      setStatus(lines[index], "mapped", "Imported as section comment");
    }
  });
};

export const annotateYamlImportLines = ({ yamlText, analysis = null, analysisError = null } = {}) => {
  const source = typeof yamlText === "string" ? yamlText : "";
  const rawLines = source.length ? source.split(/\r?\n/) : [""];
  const lines = rawLines.map((text, index) => ({
    number: index + 1,
    text,
    status: "neutral",
    message: ""
  }));

  const errorLine = Number(analysisError?.line || 0);
  if (errorLine > 0 && lines[errorLine - 1]) {
    setStatus(lines[errorLine - 1], "error", analysisError?.message || "YAML parse error");
    return lines;
  }

  if (!analysis?.ok) return lines;

  markHeaderCommentImported(lines, analysis.headerCommentLineCount);
  markSectionCommentsImported(lines, source);

  const blocks = buildTopLevelBlocks(lines);
  const blocksByKey = new Map(blocks.map((block) => [block.key, block]));
  const componentItemsByPath = new Map();
  blocks.forEach((block) => {
    findFirstLevelListItems(lines, block).forEach((item, index) => {
      componentItemsByPath.set(`${block.key}[${index}]`, item);
    });
  });

  const sectionsByKey = new Map((analysis.sections || []).map((section) => [section.key, section]));
  blocks.forEach((block) => {
    const section = sectionsByKey.get(block.key);
    if (section?.status !== "unsupported") return;
    applyBlockStatus(lines, block, "dropped", section.message || "Unsupported section");
  });

  (analysis.importReport?.entries || []).forEach((entry) => {
    markImportedComponentDomain({
      lines,
      blocksByKey,
      entry
    });
    const scope = resolveReportScope({
      path: entry.path,
      blocksByKey,
      componentItemsByPath
    });
    if (!scope) return;
    if (entry.status === "dropped") {
      applyBlockStatus(lines, scope, "dropped", entry.message || "Not imported");
      return;
    }
    if (entry.status === "mapped" && !hasReportKeys(entry)) {
      applyBlockStatus(lines, scope, "mapped", entry.message || "Imported");
      return;
    }
    if (Array.isArray(entry.mappedKeys) && entry.mappedKeys.length) {
      setStatus(lines[scope.start], "mapped", entry.message || "Imported");
    }
    markReportKeys({
      lines,
      item: scope,
      keys: entry.mappedKeys,
      status: "mapped",
      message: "Imported field"
    });
    markReportKeys({
      lines,
      item: scope,
      keys: entry.droppedKeys || entry.unmappedKeys,
      status: "dropped",
      message: "This line will not be imported in this version"
    });
  });

  markCommentsDropped(lines);

  return lines;
};
