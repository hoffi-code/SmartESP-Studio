import { describe, expect, it } from "vitest";

import {
  collectFieldKeys,
  collectFieldLabels,
  extractEsphomeDocs,
  extractScopedDocs,
  firstSentence,
  mergeHints,
  mergeNs,
  normSchemaNs,
  parseLvglMdBullets
} from "./seedHints";

describe("normSchemaNs", () => {
  it("turns a schema id into a key segment", () => {
    expect(normSchemaNs("sensor.template")).toBe("sensor_template");
    expect(normSchemaNs("general/protocols/api")).toBe("general_protocols_api");
    expect(normSchemaNs("")).toBe("");
  });
});

describe("extractScopedDocs", () => {
  it("scopes config_vars docs by dotted component id and top-level key", () => {
    const ref = {
      sensor: {
        schemas: { CONFIG_SCHEMA: { schema: { config_vars: { update_interval: { docs: "How often." } } } } }
      },
      "sensor.template": {
        schemas: { CONFIG_SCHEMA: { schema: { config_vars: { lambda: { docs: "Return the value." } } } } }
      }
    };
    const { scoped } = extractScopedDocs(ref);
    expect(scoped.sensor.update_interval).toBe("How often.");
    expect(scoped["sensor.template"].lambda).toBe("Return the value.");
    // structural keys are never component ids
    expect(scoped.schemas).toBeUndefined();
  });
});

describe("collectFieldKeys / collectFieldLabels", () => {
  const schema = {
    fields: [
      { key: "id", type: "id", label: "The ID" },
      { key: "file", type: "object", fields: [{ key: "type" }, { key: "path" }] },
      { key: "rows", type: "list", item: { fields: [{ key: "text" }] } }
    ]
  };
  it("walks nested object and list-item fields", () => {
    expect([...collectFieldKeys(schema)].sort()).toEqual(["file", "id", "path", "rows", "text", "type"]);
  });
  it("collects only real field labels", () => {
    expect(collectFieldLabels(schema)).toEqual({ id: "The ID" });
  });
});

describe("mergeNs", () => {
  it("merges by <ns>.<key>, keeps existing hints, records blank suppressions", () => {
    const existing = { spi: { mode: { hint: "hand" } } };
    const incoming = { spi: { mode: { hint: "seeded" }, type: { hint: "" } }, lvgl: { x: { label: "X" } } };
    const { ns } = mergeNs(existing, incoming);
    expect(ns.spi.mode.hint).toBe("hand");
    expect(ns.spi.type).toEqual({ hint: "" });
    expect(ns.lvgl.x).toEqual({ label: "X" });
  });
});

describe("firstSentence", () => {
  it("strips markdown links, bold and a leading type annotation, keeps one sentence", () => {
    const raw = "**int**: The desired [size](https://x) of the font in **pixels**. Defaults to `20`.";
    expect(firstSentence(raw)).toBe("The desired size of the font in pixels.");
  });

  it("drops See-also / Defaults-to tails and trailing whitespace", () => {
    expect(firstSentence("Background fill colour of the widget. *See also: [x](y)*")).toBe(
      "Background fill colour of the widget."
    );
    expect(firstSentence("The bit depth of the font Defaults to 1")).toBe("The bit depth of the font");
  });

  it("returns null for empty or too-short text", () => {
    expect(firstSentence("")).toBeNull();
    expect(firstSentence("int")).toBeNull();
    expect(firstSentence(null)).toBeNull();
  });

  it("caps very long text with an ellipsis", () => {
    const long = `x ${"word ".repeat(80)}`;
    const out = firstSentence(long);
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("parseLvglMdBullets", () => {
  it("extracts key -> text for Required/Optional bullets, first wins", () => {
    const md = [
      "- default_font ( Optional , ID ): The ID of the font used by default.",
      "- default_font ( Optional , ID ): duplicate later definition.",
      "- size ( Optional , int ): The desired size.",
      "not a bullet"
    ].join("\n");
    expect(parseLvglMdBullets(md)).toEqual({
      default_font: "The ID of the font used by default.",
      size: "The desired size."
    });
  });
});

describe("extractEsphomeDocs", () => {
  it("collects config_vars docs from nested schemas", () => {
    const json = {
      schemas: {
        CONFIG_SCHEMA: {
          schema: {
            config_vars: {
              id: { docs: "The ID with which you will refer to this." },
              size: { docs: "" }
            }
          }
        }
      },
      WIDGET_TYPES: {
        label: { schema: { config_vars: { text: { docs: "The text to display." } } } }
      }
    };
    expect(extractEsphomeDocs(json)).toEqual({
      id: "The ID with which you will refer to this.",
      text: "The text to display."
    });
  });
});

describe("mergeHints", () => {
  it("adds missing keys, keeps existing, and sorts", () => {
    const existing = { zeta: { hint: "hand-written" }, alpha: { label: "Alpha" } };
    const { fields, stats } = mergeHints(existing, { alpha: "seeded alpha", zeta: "seeded zeta", beta: "" });
    expect(Object.keys(fields)).toEqual(["alpha", "beta", "zeta"].filter((k) => k in fields));
    expect(fields.alpha).toEqual({ label: "Alpha", hint: "seeded alpha" });
    expect(fields.zeta.hint).toBe("hand-written");
    expect(stats).toMatchObject({ added: 1, kept: 1, skippedNoText: 1 });
  });

  it("replaces an existing hint only with --force", () => {
    const existing = { a: { hint: "old" } };
    expect(mergeHints(existing, { a: "new" }).fields.a.hint).toBe("old");
    expect(mergeHints(existing, { a: "new" }, { force: true }).fields.a.hint).toBe("new");
  });
});
