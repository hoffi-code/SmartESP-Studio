import { describe, expect, it } from "vitest";

import { lintLambda } from "./lambdaLint";

const idx = (id, domain = "sensor") => ({
  id,
  idLower: id.toLowerCase(),
  domain,
  componentId: `${domain}/x`,
  scopeId: `s:${id}`
});

const index = [idx("temp"), idx("hum"), idx("relay", "switch")];

describe("lintLambda", () => {
  it("passes clean code", () => {
    expect(lintLambda('return id(temp).state > 21.5 ? "on" : "off";', index)).toEqual([]);
  });

  it("returns nothing for empty input", () => {
    expect(lintLambda("", index)).toEqual([]);
    expect(lintLambda("   \n ", index)).toEqual([]);
  });

  it("reports an unclosed bracket with its position", () => {
    expect(lintLambda("if (id(temp).state > 5 {\n  return true;\n}", index)).toEqual([
      { code: "unclosed", token: "(", line: 1, column: 4 }
    ]);
  });

  it("reports a closing bracket without opener", () => {
    expect(lintLambda("return 1);", index)).toEqual([
      { code: "unexpected", token: ")", line: 1, column: 9 }
    ]);
  });

  it("reports an unterminated string", () => {
    expect(lintLambda('return "on;', index)).toEqual([
      { code: "unclosedString", token: '"', line: 1, column: 8 }
    ]);
  });

  it("reports an unterminated block comment instead of silently swallowing the rest", () => {
    expect(lintLambda("/* oops", index)).toEqual([
      { code: "unclosedComment", token: "/*", line: 1, column: 1 }
    ]);
  });

  it("masks everything after an unterminated block comment, no bogus follow-up warnings", () => {
    const text = "return 1;\n/* oops\nid(ghost)(";
    expect(lintLambda(text, index)).toEqual([
      { code: "unclosedComment", token: "/*", line: 2, column: 1 }
    ]);
  });

  it("reports unknown ids only", () => {
    expect(lintLambda("return id(temp).state + id(outside).state;", index)).toEqual([
      { code: "unknownId", id: "outside", line: 1, column: 25 }
    ]);
  });

  it("ignores brackets, quotes and id() inside comments and strings", () => {
    const text = [
      '// id(ghost) and a stray ( here',
      '/* another ( and id(phantom) */',
      'return str_sprintf("%d) id(nope)", id(temp).state);'
    ].join("\n");
    expect(lintLambda(text, index)).toEqual([]);
  });

  it("skips the id check without an index", () => {
    expect(lintLambda("return id(whatever).state;", [])).toEqual([]);
  });

  it("counts lines and columns across the whole text", () => {
    expect(lintLambda('auto x = id(temp).state;\nreturn id(missing).state;', index)).toEqual([
      { code: "unknownId", id: "missing", line: 2, column: 8 }
    ]);
  });

  it("sorts several findings by position", () => {
    const found = lintLambda('id(nope1).state;\nreturn "x;', index);
    expect(found.map((w) => w.code)).toEqual(["unknownId", "unclosedString"]);
  });
});
