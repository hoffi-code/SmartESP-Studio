import { describe, it, expect } from "vitest";
import { resolveDirtyState } from "./builderDirtyState";

const base = {
  isHydrating: false,
  isProjectSaved: true,
  baseline: "FP-A",
  currentFingerprint: "FP-A",
  autoNormalizationInFlight: false
};

describe("resolveDirtyState", () => {
  it("stays idle while hydrating even if the fingerprint already differs", () => {
    expect(
      resolveDirtyState({ ...base, isHydrating: true, currentFingerprint: "FP-B" })
    ).toBe("idle");
  });

  it("stays idle for a project that was never saved", () => {
    expect(
      resolveDirtyState({ ...base, isProjectSaved: false, currentFingerprint: "FP-B" })
    ).toBe("idle");
  });

  it("stays idle before a baseline has been captured", () => {
    expect(
      resolveDirtyState({ ...base, baseline: "", currentFingerprint: "FP-B" })
    ).toBe("idle");
  });

  it("stays idle when the fingerprint matches the baseline", () => {
    expect(resolveDirtyState(base)).toBe("idle");
  });

  it("marks dirty when a real edit changes the fingerprint", () => {
    expect(resolveDirtyState({ ...base, currentFingerprint: "FP-B" })).toBe("dirty");
  });

  it("rebaselines when the change came from post-load auto normalization", () => {
    expect(
      resolveDirtyState({
        ...base,
        currentFingerprint: "FP-B",
        autoNormalizationInFlight: true
      })
    ).toBe("rebaseline");
  });

  it("still marks dirty for a real edit once auto normalization has settled", () => {
    expect(
      resolveDirtyState({
        ...base,
        currentFingerprint: "FP-B",
        autoNormalizationInFlight: false
      })
    ).toBe("dirty");
  });
});
