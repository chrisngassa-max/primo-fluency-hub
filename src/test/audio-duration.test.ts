import { describe, expect, it } from "vitest";
import {
  assessTimestampCoverage,
  readMp3Duration,
  splitMp3ByMaxDurationMs,
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

describe("MP3 duration and timestamp assessment", () => {
  it("computes duration and sample metadata from MPEG audio frames", () => {
    const duration = readMp3Duration(mpeg1Layer3Frames(100));
    expect(duration?.frameCount).toBe(100);
    expect(duration?.durationMs).toBeCloseTo((100 * 1152 * 1000) / 44_100, 0);
    expect(duration?.mpegVersion).toBe(1);
    expect(duration?.sampleRateHz).toBe(44_100);
    expect(duration?.channels).toBe(2);
  });

  it("splits chunks with exact per-chunk duration metadata", () => {
    const chunks = splitMp3ByMaxDurationMs(mpeg1Layer3Frames(3000), 55_000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].durationMs).toBeLessThanOrEqual(55_000);
    expect(chunks[0].sampleRateHz).toBe(44_100);
    expect(chunks.every((chunk) => chunk.durationMs > 0)).toBe(true);
  });

  it("accepts timestamps close to the real audio duration under abs tolerance", () => {
    expect(assessTimestampCoverage([{ end_ms: 59_200 }], 60_000)).toMatchObject({
      status: "verified",
      audioDurationMs: 60_000,
      transcriptEndMs: 59_200,
      driftMs: -800,
      overshootMs: 0,
      trailingGapMs: 800,
    });
  });

  it("marks timestamps that overshoot duration by more than 2 seconds as unverified", () => {
    expect(assessTimestampCoverage([{ end_ms: 90_000 }], 60_000)).toMatchObject({
      status: "unverified",
      audioDurationMs: 60_000,
      transcriptEndMs: 90_000,
      driftMs: 30_000,
      overshootMs: 30_000,
      trailingGapMs: 0,
    });
  });

  it("marks massive under-coverage as unverified under abs tolerance", () => {
    expect(assessTimestampCoverage([{ end_ms: 57_100 }], 60_000)).toMatchObject({
      status: "unverified",
      audioDurationMs: 60_000,
      transcriptEndMs: 57_100,
      driftMs: -2_900,
      overshootMs: 0,
      trailingGapMs: 2_900,
    });
  });
});
