import { describe, expect, it } from "vitest";

import {
  applyMemberCompletion,
  buildMemberCompletionOptions,
  findMemberCompletionContext,
  findNearestIdReference
} from "./lambdaMemberCompletion";

describe("findMemberCompletionContext", () => {
  it("triggers right after id(x).", () => {
    const text = "id(temp).";
    expect(findMemberCompletionContext(text, text.length)).toEqual({
      start: 9,
      end: 9,
      query: "",
      entityId: "temp"
    });
  });

  it("captures the partial member and the entity id", () => {
    const text = "id(temp).st";
    expect(findMemberCompletionContext(text, text.length)).toEqual({
      start: 9,
      end: 11,
      query: "st",
      entityId: "temp"
    });
  });

  it("stays closed without a dot after the call", () => {
    const text = "id(temp)";
    expect(findMemberCompletionContext(text, text.length)).toBeNull();
  });

  it("does not tolerate whitespace around the dot", () => {
    expect(findMemberCompletionContext("id(temp) .state", "id(temp) .state".length)).toBeNull();
    expect(findMemberCompletionContext("id(temp). state", "id(temp). state".length)).toBeNull();
  });

  it("rejects a nested call inside the parens", () => {
    const text = "id(foo(bar)).";
    expect(findMemberCompletionContext(text, text.length)).toBeNull();
  });

  it("rejects an empty id() call", () => {
    const text = "id().";
    expect(findMemberCompletionContext(text, text.length)).toBeNull();
  });

  it("ignores other calls and identifiers ending in id", () => {
    expect(findMemberCompletionContext("to_string(temp).", "to_string(temp).".length)).toBeNull();
    expect(findMemberCompletionContext("myid(temp).", "myid(temp).".length)).toBeNull();
  });

  it("does not reach across a line break", () => {
    const text = "id(temp)\n.state";
    expect(findMemberCompletionContext(text, text.length)).toBeNull();
  });

  it("works mid-text at the caret, not just at the end", () => {
    const text = "auto a = id(temp).st; return 1;";
    expect(findMemberCompletionContext(text, 20)).toEqual({
      start: 18,
      end: 20,
      query: "st",
      entityId: "temp"
    });
  });
});

describe("buildMemberCompletionOptions", () => {
  it("returns every member for an empty query, sorted", () => {
    expect(buildMemberCompletionOptions("switch", "").map((entry) => entry.id)).toEqual([
      "state",
      "toggle",
      "turn_off",
      "turn_on"
    ]);
  });

  it("filters by prefix", () => {
    expect(buildMemberCompletionOptions("switch", "tu").map((entry) => entry.id)).toEqual([
      "turn_off",
      "turn_on"
    ]);
  });

  it("returns an empty list for an unknown or out-of-scope domain", () => {
    expect(buildMemberCompletionOptions("i2c", "")).toEqual([]);
    expect(buildMemberCompletionOptions("", "")).toEqual([]);
  });
});

describe("applyMemberCompletion", () => {
  it("splices the member text in and places the caret at its end", () => {
    const text = "id(temp).st";
    const context = findMemberCompletionContext(text, text.length);
    expect(applyMemberCompletion(text, context, { id: "state", insert: "state" })).toEqual({
      text: "id(temp).state",
      caret: 14
    });
  });

  it("replaces mid-text without disturbing the rest", () => {
    const text = "auto a = id(temp).st; return 1;";
    const context = findMemberCompletionContext(text, 20);
    expect(applyMemberCompletion(text, context, { id: "has_state", insert: "has_state()" })).toEqual({
      text: "auto a = id(temp).has_state(); return 1;",
      caret: 29
    });
  });
});

describe("findNearestIdReference", () => {
  it("finds the id() reference before the caret", () => {
    const text = "return id(temp).state;";
    expect(findNearestIdReference(text, text.length)).toEqual({ entityId: "temp", start: 7, end: 15 });
  });

  it("returns null without any reference", () => {
    expect(findNearestIdReference("return 1;", 9)).toBeNull();
  });

  it("ignores a reference that starts after the caret", () => {
    const text = "id(temp).state; id(hum).state;";
    expect(findNearestIdReference(text, 5)).toBeNull();
  });

  it("picks the nearest of several references before the caret", () => {
    const text = "id(temp).state; id(hum).state;";
    expect(findNearestIdReference(text, text.length)?.entityId).toBe("hum");
  });
});
