import { describe, expect, it } from "vitest";

import { LAMBDA_SCOPE_VARIABLES } from "./lambdaScopeVariables";

describe("LAMBDA_SCOPE_VARIABLES", () => {
  it("has globally unique ids", () => {
    const ids = LAMBDA_SCOPE_VARIABLES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty id and insert on every entry", () => {
    LAMBDA_SCOPE_VARIABLES.forEach((entry) => {
      expect(entry.id.trim()).not.toBe("");
      expect(entry.insert.trim()).not.toBe("");
    });
  });
});
