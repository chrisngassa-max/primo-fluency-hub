import { describe, expect, it } from "vitest";
import {
  canStartAudioPlay,
  learnerTextSizeClass,
  remainingAudioPlays,
} from "@/lib/audioAccess";

describe("audio accessibility helpers", () => {
  it("enforces a configured listening limit", () => {
    expect(canStartAudioPlay(1, 2)).toBe(true);
    expect(canStartAudioPlay(2, 2)).toBe(false);
    expect(canStartAudioPlay(20, null)).toBe(true);
    expect(remainingAudioPlays(1, 2)).toBe(1);
    expect(remainingAudioPlays(3, 2)).toBe(0);
  });

  it("maps learner text sizes to stable classes", () => {
    expect(learnerTextSizeClass("normal")).toBe("");
    expect(learnerTextSizeClass("large")).toBe("learner-text-large");
    expect(learnerTextSizeClass("extra-large")).toBe("learner-text-extra-large");
  });
});
