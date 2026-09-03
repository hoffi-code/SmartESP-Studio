import { describe, expect, it } from "vitest";

import { highlightCppFallback, highlightCppToHtml } from "./cppSyntaxHighlight";

describe("cppSyntaxHighlight", () => {
  it("escapes markup in the fallback and keeps newlines literal", () => {
    expect(highlightCppFallback('if (a < b) { return "<x>"; }\nreturn 0;')).toBe(
      'if (a &lt; b) { return "&lt;x&gt;"; }\nreturn 0;'
    );
  });

  it("marks up keywords, strings and numbers", async () => {
    const html = await highlightCppToHtml('return id(sensor1).state > 21.5 ? "on" : "off";');
    expect(html).toContain('<span class="hljs-keyword">return</span>');
    expect(html).toContain('<span class="hljs-string">&quot;on&quot;</span>');
    expect(html).toContain('<span class="hljs-number">21.5</span>');
  });

  it("escapes markup in highlighted output", async () => {
    const html = await highlightCppToHtml("if (a < b) return true;");
    expect(html).toContain("&lt;");
    expect(html).not.toContain("<b>");
  });

  it("passes empty input through untouched", async () => {
    expect(await highlightCppToHtml("")).toBe("");
    expect(await highlightCppToHtml("   ")).toBe("   ");
  });
});
