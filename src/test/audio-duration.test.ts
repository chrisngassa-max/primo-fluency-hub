import { describe, expect, it } from "vitest";
import {
  assessTimestampCoverage,
  readMp3Duration,
} from "../../supabase/functions/_shared/transcription/audio-duration.ts";

function mpeg1Layer3Frames(count: number): Uint8Array {
  const frameLength = Math.floor((144 * 128_000) / 44_100);
  const bytes = new Uint8Array(frameLength * count);
  for (let index = 0; index < count; index += 1) {
    const offset = index * frameLength;
    bytes.set([0xff, 0xfb, 0x90, 0x00], offset);
  }
  return bytes;
}

describe("MP3 duration and Gemini timestamp assessment", () => {
  it("computes duration from MPEG audio frames", () => {
    const duration = readMp3Duration(mpeg1Layer3Frames(100));
    expect(duration?.frameCount).toBe(100);
    expect(duration?.durationMs).toBeCloseTo((100 * 1152 * 1000) / 44_100, 0);
  });

  it("accepts timestamps close to the real audio duration", () => {
    expect(assessTimestampCoverage([{ end_ms: 59_200 }], 60_000)).toEqual({
      status: "verified",
      audioDurationMs: 60_000,
      transcriptEndMs: 59_200,
      driftMs: -800,
    });
  });

  it("marks Gemini timestamps outside tolerance as unverified", () => {
    expect(assessTimestampCoverage([{ end_ms: 90_000 }], 60_000)).toEqual({
      status: "unverified",
      audioDurationMs: 60_000,
      transcriptEndMs: 90_000,
      driftMs: 30_000,
    });
  });
});
