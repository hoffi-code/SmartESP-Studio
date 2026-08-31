import { describe, it, expect } from "vitest";
import { isProtectedAsset } from "./protectedAssets";

describe("isProtectedAsset", () => {
  it("honours the manifest protected flag", () => {
    expect(isProtectedAsset({ file: "roboto.ttf", protected: true })).toBe(true);
  });

  it("falls back to the MDI filename when the flag is absent", () => {
    expect(isProtectedAsset({ file: "materialdesignicons-webfont.ttf" })).toBe(true);
    expect(isProtectedAsset({ file: "MaterialDesignIcons-Webfont.TTF" })).toBe(true);
  });

  it("treats a normal font as unprotected", () => {
    expect(isProtectedAsset({ file: "roboto.ttf" })).toBe(false);
    expect(isProtectedAsset({ file: "roboto.ttf", protected: false })).toBe(false);
  });

  it("is safe for null/empty input", () => {
    expect(isProtectedAsset(null)).toBe(false);
    expect(isProtectedAsset({})).toBe(false);
  });
});
