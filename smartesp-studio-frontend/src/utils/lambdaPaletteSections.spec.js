import { describe, expect, it } from "vitest";

import { LAMBDA_GLOBAL_FUNCTIONS } from "./lambdaGlobalFunctions";
import { LAMBDA_MEMBER_CATALOG } from "./lambdaMemberCatalog";
import { buildLambdaPaletteSections, filterLambdaPaletteSections } from "./lambdaPaletteSections";
import { LAMBDA_SCOPE_VARIABLES } from "./lambdaScopeVariables";
import { LAMBDA_SNIPPETS } from "./lambdaSnippets";

describe("buildLambdaPaletteSections", () => {
  it("omits the suggested section without a domain", () => {
    const sections = buildLambdaPaletteSections();
    expect(sections.some((section) => section.id === "suggested")).toBe(false);
  });

  it("omits the suggested section for an out-of-scope domain", () => {
    const sections = buildLambdaPaletteSections({ suggestedDomain: "i2c" });
    expect(sections.some((section) => section.id === "suggested")).toBe(false);
  });

  it("puts the suggested section first with the domain's members", () => {
    const sections = buildLambdaPaletteSections({ suggestedDomain: "sensor" });
    expect(sections[0]).toEqual({ id: "suggested", items: LAMBDA_MEMBER_CATALOG.sensor });
  });

  it("always includes the snippets section unchanged", () => {
    const sections = buildLambdaPaletteSections();
    const snippets = sections.find((section) => section.id === "snippets");
    expect(snippets.items).toEqual(LAMBDA_SNIPPETS);
  });

  it("always includes the scope variables section unchanged", () => {
    const sections = buildLambdaPaletteSections();
    const scope = sections.find((section) => section.id === "scope");
    expect(scope.items).toEqual(LAMBDA_SCOPE_VARIABLES);
  });

  it("groups global functions by category in the fixed reading order", () => {
    const sections = buildLambdaPaletteSections();
    const categorySections = sections.filter((section) => section.id.startsWith("category:"));
    expect(categorySections.map((section) => section.id)).toEqual([
      "category:logging",
      "category:strings",
      "category:math",
      "category:time",
      "category:core"
    ]);
    const flattened = categorySections.flatMap((section) => section.items);
    expect(flattened).toEqual(LAMBDA_GLOBAL_FUNCTIONS);
  });
});

describe("filterLambdaPaletteSections", () => {
  const sections = buildLambdaPaletteSections({ suggestedDomain: "sensor" });

  it("returns the sections unchanged for an empty term", () => {
    expect(filterLambdaPaletteSections(sections, "")).toBe(sections);
  });

  it("matches by id or insert, case-insensitively", () => {
    const filtered = filterLambdaPaletteSections(sections, "MILLIS");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].items.map((item) => item.id)).toEqual(["millis"]);
  });

  it("matches through the injected labelFor resolver", () => {
    const filtered = filterLambdaPaletteSections(sections, "temperature reading", {
      labelFor: (sectionId, item) =>
        sectionId === "suggested" && item.id === "state" ? "Temperature reading" : ""
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toEqual({ id: "suggested", items: [{ id: "state", insert: "state" }] });
  });

  it("drops sections left with no items after filtering", () => {
    const filtered = filterLambdaPaletteSections(sections, "does-not-exist-anywhere");
    expect(filtered).toEqual([]);
  });
});
