export const PLAYBACK_RATES = [0.8, 1, 1.2] as const;

export function canStartAudioPlay(playCount: number, maxPlays?: number | null) {
  return maxPlays == null || playCount < maxPlays;
}

export function remainingAudioPlays(playCount: number, maxPlays?: number | null) {
  return maxPlays == null ? null : Math.max(0, maxPlays - playCount);
}

export type LearnerTextSize = "normal" | "large" | "extra-large";

export function learnerTextSizeClass(size: LearnerTextSize) {
  if (size === "large") return "learner-text-large";
  if (size === "extra-large") return "learner-text-extra-large";
  return "";
}
