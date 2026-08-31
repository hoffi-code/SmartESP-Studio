import { describe, expect, it } from "vitest";
import { annotateYamlImportLines } from "./yamlImportLineAnnotations";

describe("annotateYamlImportLines - header comment handling", () => {
  const yamlText = [
    "# Board: CYD",
    "# Definition: manifest.yaml",
    "",
    "esphome:",
    "  # inline comment, not a header",
    "  name: test"
  ].join("\n");

  it("marks the leading header comment lines as imported instead of dropped", () => {
    const lines = annotateYamlImportLines({
      yamlText,
      analysis: {
        ok: true,
        headerCommentLineCount: 2,
        sections: [{ key: "esphome", status: "recognized" }],
        importReport: { entries: [] }
      }
    });

    expect(lines[0].status).toBe("mapped");
    expect(lines[0].message).toBe("Imported as project header comment");
    expect(lines[1].status).toBe("mapped");
  });

  it("still marks other comments as dropped", () => {
    const lines = annotateYamlImportLines({
      yamlText,
      analysis: {
        ok: true,
        headerCommentLineCount: 2,
        sections: [{ key: "esphome", status: "recognized" }],
        importReport: { entries: [] }
      }
    });

    const inlineCommentLine = lines.find((line) => line.text.includes("inline comment"));
    expect(inlineCommentLine.status).toBe("dropped");
    expect(inlineCommentLine.message).toBe("YAML comments are not imported");
  });

  it("drops all comments as before when there is no header comment", () => {
    const lines = annotateYamlImportLines({
      yamlText,
      analysis: {
        ok: true,
        headerCommentLineCount: 0,
        sections: [{ key: "esphome", status: "recognized" }],
        importReport: { entries: [] }
      }
    });

    expect(lines[0].status).toBe("dropped");
    expect(lines[1].status).toBe("dropped");
  });
});
