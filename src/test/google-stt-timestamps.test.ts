import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assessTimestampCoverage } from "../../supabase/functions/_shared/transcription/audio-duration.ts";
import {
  AUDIO_TIMESTAMP_SOURCE,
  GOOGLE_STT_FALLBACK_MODEL,
  GOOGLE_STT_PROVIDER,
  assessDedicatedSttTimestamps,
  assertRawSegmentChronology,
  buildDedicatedSttProviderParameters,
  estimateGoogleSttCostUsd,
  googleSpeechResultsToSegments,
  isAllowedAudioTimestampProvider,
  parseGoogleDurationToMs,
  reindexSegmentsPreservingTimes,
  toCanonicalTranscription,
  transcribeAudioWithDedicatedStt,
  type CanonicalSttResult,
  type RecognizeChunkFn,
} from "../../supabase/functions/_shared/transcription/google-stt.ts";
import { validateCanonicalTranscription } from "../../supabase/functions/_shared/transcription/canonical.ts";

function mpeg1Layer3Frames(count: number): Uint8Array {
  const frameLength = Math.floor((144 * 128_000) / 44_100);
  const bytes = new Uint8Array(frameLength * count);
  for (let index = 0; index < count; index += 1) {
    bytes.set([0xff, 0xfb, 0x90, 0x00], index * frameLength);
  }
  return bytes;
}

function words(start: string, end: string, word = "Bonjour") {
  return [{ startTime: start, endTime: end, word }];
}

function recognizeWith(results: unknown): RecognizeChunkFn {
  return async () => ({ results: results as never });
}

describe("dedicated Google STT timestamps (fail-closed)", () => {
  it("keeps raw Google word offsets without mutating times", () => {
    const segments = googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Bonjour.", confidence: 0.91, words: words("0.100s", "0.800s", "Bonjour") }] },
      { alternatives: [{ transcript: "Comment allez-vous ?", confidence: 0.88, words: words("1.200s", "2.400s") }] },
    ], 55_000, 0, 55_000);

    expect(segments).toMatchObject([
      { id: "seg-001", index: 0, start_ms: 55_100, end_ms: 55_800, text: "Bonjour." },
      { id: "seg-002", index: 1, start_ms: 56_200, end_ms: 57_400, text: "Comment allez-vous ?" },
    ]);
    const reindexed = reindexSegmentsPreservingTimes(segments);
    expect(reindexed.map((segment) => [segment.start_ms, segment.end_ms])).toEqual([
      [55_100, 55_800],
      [56_200, 57_400],
    ]);
    const canonical = toCanonicalTranscription({
      text: "Bonjour. Comment allez-vous ?",
      segments,
      provider: GOOGLE_STT_PROVIDER,
      modelId: "latest_long",
      language: "fr-FR",
      confidence: 0.9,
      metadata: { timestamp_source: AUDIO_TIMESTAMP_SOURCE },
    });
    expect(validateCanonicalTranscription(canonical)).toEqual([]);
  });

  it("rejects negative timestamps and bare numeric Durations", () => {
    expect(parseGoogleDurationToMs("-1.0s")).toBeNull();
    expect(parseGoogleDurationToMs(1.25)).toBeNull();
    expect(parseGoogleDurationToMs(1250)).toBeNull();
    expect(parseGoogleDurationToMs("1.250s")).toBe(1250);
    expect(parseGoogleDurationToMs({ seconds: 1, nanos: 250_000_000 })).toBe(1250);
    expect(() => googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Non", words: [{ startTime: "-1.0s", endTime: "0.400s", word: "Non" }] }] },
    ])).toThrow("STT_TIMESTAMP_INVALID");
  });

  it("blocks an end outside the chunk instead of clamping", () => {
    expect(() => googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Trop long", words: words("54.200s", "58.400s") }] },
    ], 0, 0, 55_000)).toThrow("STT_CHUNK_TIMESTAMP_OUT_OF_RANGE");
  });

  it("blocks overlapping segments instead of shifting times", () => {
    expect(() => assertRawSegmentChronology([
      { id: "seg-001", index: 0, start_ms: 0, end_ms: 55_500, text: "a" },
      { id: "seg-002", index: 1, start_ms: 55_100, end_ms: 56_000, text: "b" },
    ])).toThrow("STT_CHUNK_SEGMENTS_OVERLAP");
  });

  it("rejects empty or inverted segments", () => {
    expect(() => googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Vide", words: [] }] },
    ])).toThrow("STT_TIMESTAMPS_MISSING");
    expect(() => googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Inverse", words: words("2.000s", "1.000s") }] },
    ])).toThrow("STT_SEGMENT_INVERTED");
  });

  it("rejects a canonical audio result that has no timestamps", async () => {
    await expect(transcribeAudioWithDedicatedStt({
      bytes: mpeg1Layer3Frames(80),
      mimeType: "audio/mpeg",
      recognize: recognizeWith([{ alternatives: [{ transcript: "Sans horodatage" }] }]),
    })).rejects.toThrow("STT_TIMESTAMPS_MISSING");
  });

  it("rejects a provider error without inventing timestamps", async () => {
    await expect(transcribeAudioWithDedicatedStt({
      bytes: mpeg1Layer3Frames(80),
      mimeType: "audio/mpeg",
      recognize: async () => {
        throw new Error("STT_PROVIDER_ERROR:503:unavailable");
      },
    })).rejects.toThrow("STT_PROVIDER_ERROR");
  });

  it("replays ALL chunks with default when latest_long is unsupported on one chunk", async () => {
    const calls: string[] = [];
    const framesNeededForTwoChunks = Math.ceil((55_000 / 1000) * (44_100 / 1152)) + 40;
    const recognize: RecognizeChunkFn = async ({ modelId }) => {
      calls.push(modelId);
      if (modelId === "latest_long" && calls.filter((value) => value === "latest_long").length === 2) {
        throw new Error("STT_PROVIDER_ERROR:400:INVALID_ARGUMENT unsupported model");
      }
      return {
        results: [{
          alternatives: [{
            transcript: `chunk-${calls.length}`,
            words: words("0.100s", "1.000s"),
          }],
        }],
      };
    };

    const result = await transcribeAudioWithDedicatedStt({
      bytes: mpeg1Layer3Frames(framesNeededForTwoChunks),
      mimeType: "audio/mpeg",
      recognize,
    });

    expect(result.modelId).toBe(GOOGLE_STT_FALLBACK_MODEL);
    expect(calls.filter((value) => value === "latest_long").length).toBeGreaterThanOrEqual(2);
    expect(calls.filter((value) => value === "default").length).toBe(calls.filter((value) => value === "latest_long").length);
    expect(new Set(result.segments.map(() => result.modelId)).size).toBe(1);
  });

  it("records provider and model and never treats Gemini as a timestamp source", async () => {
    const result = await transcribeAudioWithDedicatedStt({
      bytes: mpeg1Layer3Frames(80),
      mimeType: "audio/mpeg",
      recognize: recognizeWith([
        { alternatives: [{ transcript: "Bonjour la France.", words: words("0.200s", "1.800s") }] },
      ]),
    });
    expect(result.provider).toBe("google-stt");
    expect(result.modelId).toBe("latest_long");
    expect(result.metadata.timestamp_source).toBe("google_stt_word_offsets");
    expect(result.metadata.transformations_applied).toEqual([]);
    expect(isAllowedAudioTimestampProvider("gemini")).toBe(false);
    expect(isAllowedAudioTimestampProvider("google-stt")).toBe(true);
    const params = buildDedicatedSttProviderParameters({
      contentHash: "sha256:" + "a".repeat(64),
      modelId: result.modelId,
      language: result.language,
      chunkCount: 1,
      audioDurationMs: 2_000,
      mp3FrameCount: 80,
      firstStartMs: result.segments[0].start_ms,
      lastEndMs: result.segments[0].end_ms,
      timestampStatus: "verified",
      transcriptEndMs: result.segments[0].end_ms,
      timestampDriftMs: -200,
    });
    expect(params.timestamp_provider).toBe("google-stt");
    expect(params.timestamp_source).toBe("google_stt_word_offsets");
    expect(params.model_id).toBe("latest_long");
    expect(params.transformations_applied).toEqual([]);
  });

  it("marks overshoot beyond 2 seconds as unverified", () => {
    const result: CanonicalSttResult = {
      text: "Trop long",
      segments: [{ id: "seg-001", index: 0, start_ms: 0, end_ms: 90_000, text: "Trop long" }],
      provider: GOOGLE_STT_PROVIDER,
      modelId: "latest_long",
      language: "fr-FR",
      confidence: null,
      metadata: {},
    };
    expect(assessDedicatedSttTimestamps(result, 60_000)).toMatchObject({
      status: "unverified",
      audioDurationMs: 60_000,
      transcriptEndMs: 90_000,
      driftMs: 30_000,
      overshootMs: 30_000,
      trailingGapMs: 0,
    });
  });

  it("keeps massive under-coverage unverified under abs tolerance", () => {
    expect(assessTimestampCoverage([{ end_ms: 57_100 }], 60_000)).toMatchObject({
      status: "unverified",
      audioDurationMs: 60_000,
      transcriptEndMs: 57_100,
      driftMs: -2_900,
      overshootMs: 0,
      trailingGapMs: 2_900,
      coverageRatio: Number((57_100 / 60_000).toFixed(6)),
    });
  });

  it("does not force final result equal to audio duration", async () => {
    const result = await transcribeAudioWithDedicatedStt({
      bytes: mpeg1Layer3Frames(80),
      mimeType: "audio/mpeg",
      recognize: recognizeWith([
        { alternatives: [{ transcript: "Fin proche", words: words("0.200s", "1.700s") }] },
      ]),
    });
    expect(result.segments.at(-1)?.end_ms).toBe(1700);
    expect(result.segments.at(-1)?.end_ms).not.toBe(Math.round((80 * 1152 * 1000) / 44_100));
  });

  it("does not use Gemini source files as the timestamp adapter", () => {
    const transcribeSource = readFileSync(
      resolve(process.cwd(), "supabase/functions/transcribe-pedagogical-source/index.ts"),
      "utf8",
    );
    expect(transcribeSource).toContain("transcribeAudioWithDedicatedStt");
    expect(transcribeSource).not.toContain("transcribeAudioWithGemini");
    expect(transcribeSource).toContain("GOOGLE_STT_PROVIDER");
  });

  it("estimates standard Speech-to-Text cost from billed 15s units", () => {
    expect(estimateGoogleSttCostUsd(184_451)).toBeCloseTo(0.078);
  });
});
