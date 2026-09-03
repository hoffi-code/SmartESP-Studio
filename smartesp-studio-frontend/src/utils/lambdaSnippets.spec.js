import { describe, expect, it } from "vitest";

import { LAMBDA_SNIPPETS, insertSnippet } from "./lambdaSnippets";

describe("lambdaSnippets", () => {
  it("keeps every snippet id unique and non-empty", () => {
    const ids = LAMBDA_SNIPPETS.map((snippet) => snippet.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LAMBDA_SNIPPETS.every((snippet) => snippet.insert.trim())).toBe(true);
  });

  it("inserts at the caret", () => {
    expect(insertSnippet("return ;", 7, 7, "id(x).state")).toEqual({
      text: "return id(x).state;",
      caret: 18
    });
  });

  it("replaces the selection", () => {
    expect(insertSnippet("return old;", 7, 10, "id(x).state")).toEqual({
      text: "return id(x).state;",
      caret: 18
    });
  });

  it("clamps positions outside the text", () => {
    expect(insertSnippet("ab", 99, 99, "X")).toEqual({ text: "abX", caret: 3 });
    expect(insertSnippet("ab", -5, -5, "X")).toEqual({ text: "Xab", caret: 1 });
  });
});
