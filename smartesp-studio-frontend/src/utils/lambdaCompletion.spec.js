import { describe, expect, it } from "vitest";

import {
  applyIdCompletion,
  buildIdCompletionOptions,
  findIdCompletionContext
} from "./lambdaCompletion";

const idx = (id, domain = "sensor") => ({ id, idLower: id.toLowerCase(), domain });

describe("findIdCompletionContext", () => {
  it("triggers right after id(", () => {
    const text = "return id(";
    expect(findIdCompletionContext(text, text.length)).toEqual({ start: 10, end: 10, query: "" });
  });

  it("captures the partial identifier", () => {
    const text = "return id(te";
    expect(findIdCompletionContext(text, text.length)).toEqual({ start: 10, end: 12, query: "te" });
  });

  it("tolerates whitespace around the parenthesis", () => {
    const text = "return id ( te";
    expect(findIdCompletionContext(text, text.length)?.query).toBe("te");
  });

  it("stays closed once the call is complete", () => {
    const text = "return id(temp).state";
    expect(findIdCompletionContext(text, text.length)).toBeNull();
  });

  it("ignores other calls and identifiers ending in id", () => {
    expect(findIdCompletionContext("to_string(te", 12)).toBeNull();
    expect(findIdCompletionContext("myid(te", 7)).toBeNull();
  });

  it("does not reach across a line break", () => {
    expect(findIdCompletionContext("id(\nte", 6)).toBeNull();
  });

  it("works mid-text at the caret, not at the end", () => {
    const text = "auto a = id(te; return 1;";
    expect(findIdCompletionContext(text, 14)).toEqual({ start: 12, end: 14, query: "te" });
  });
});

describe("buildIdCompletionOptions", () => {
  it("filters by prefix and sorts", () => {
    const index = [idx("temp"), idx("relay", "switch"), idx("term")];
    expect(buildIdCompletionOptions(index, "te")).toEqual([
      { id: "temp", domain: "sensor" },
      { id: "term", domain: "sensor" }
    ]);
  });

  it("returns every id for an empty query and drops duplicates", () => {
    const index = [idx("temp"), idx("temp"), idx("hum")];
    expect(buildIdCompletionOptions(index, "").map((o) => o.id)).toEqual(["hum", "temp"]);
  });
});

describe("applyIdCompletion", () => {
  it("inserts the id and closes the call", () => {
    const text = "return id(te";
    const context = findIdCompletionContext(text, text.length);
    expect(applyIdCompletion(text, context, "temp")).toEqual({
      text: "return id(temp)",
      caret: 15
    });
  });

  it("reuses an existing closing parenthesis", () => {
    const text = "return id(te).state;";
    const context = findIdCompletionContext(text, 12);
    expect(applyIdCompletion(text, context, "temp")).toEqual({
      text: "return id(temp).state;",
      caret: 15
    });
  });
});
