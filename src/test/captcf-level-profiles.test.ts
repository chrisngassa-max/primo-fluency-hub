import { describe, expect, it } from "vitest";
import {
  CAPTCF_DIALOGUE_MAX_SECONDS,
  CAPTCF_DIALOGUE_MIN_SECONDS,
  getCaptcfLevelProfileSummary,
  normalizeCaptcfLevel,
  resolveCaptcfDocumentLevel,
} from "@/lib/captcf-level-profiles";

describe("captcf level profiles", () => {
  it("normalizes known and unknown CEFR levels", () => {
    expect(normalizeCaptcfLevel("a0")).toBe("A0");
    expect(normalizeCaptcfLevel("B2")).toBe("B2");
    expect(normalizeCaptcfLevel("unknown")).toBe("A2");
  });

  it("resolves the automatic document level by priority", () => {
    expect(resolveCaptcfDocumentLevel({ explicitLevel: "B1", exerciseLevel: "A2" })).toBe("B1");
    expect(resolveCaptcfDocumentLevel({ exerciseLevel: "A1", sessionLevel: "B2" })).toBe("A1");
    expect(resolveCaptcfDocumentLevel({ sessionLevel: "B2", groupLevel: "A2" })).toBe("B2");
    expect(resolveCaptcfDocumentLevel({ groupLevel: "A1" })).toBe("A1");
  });

  it("exposes the fixed 2m25-2m35 dialogue constraint", () => {
    const profile = getCaptcfLevelProfileSummary("B1");
    expect(profile.dialogueMinSeconds).toBe(CAPTCF_DIALOGUE_MIN_SECONDS);
    expect(profile.dialogueMaxSeconds).toBe(CAPTCF_DIALOGUE_MAX_SECONDS);
    expect(profile.dialogueMinSeconds).toBe(145);
    expect(profile.dialogueMaxSeconds).toBe(155);
  });
});
