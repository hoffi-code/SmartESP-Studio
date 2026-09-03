import { describe, expect, it } from "vitest";

import { addHashes, stripHashes } from "./yamlComments";

describe("yamlComments", () => {
  it("strips the hash prefix for editing", () => {
    expect(stripHashes("# I2C fuer das Display")).toBe("I2C fuer das Display");
    expect(stripHashes("#kein Leerzeichen")).toBe("kein Leerzeichen");
  });

  it("re-adds the prefix on save", () => {
    expect(addHashes("I2C fuer das Display")).toBe("# I2C fuer das Display");
  });

  it("round-trips multiline comments", () => {
    const stored = "# erste Zeile\n# zweite Zeile";
    expect(addHashes(stripHashes(stored))).toBe(stored);
  });

  it("keeps blank lines as bare hashes", () => {
    expect(addHashes("oben\n\nunten")).toBe("# oben\n#\n# unten");
  });

  it("handles empty input", () => {
    expect(stripHashes("")).toBe("");
    expect(stripHashes(null)).toBe("");
    expect(addHashes("")).toBe("#");
  });
});
