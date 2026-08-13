import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assessTimestampCoverage } from "../../supabase/functions/_shared/transcription/audio-duration.ts";
import {
  AUDIO_TIMESTAMP_SOURCE,
  GOOGLE_STT_PROVIDER,
  assessDedicatedSttTimestamps,
  buildDedicatedSttProviderParameters,
  estimateGoogleSttCostUsd,
  googleSpeechResultsToSegments,
  isAllowedAudioTimestampProvider,
  normalizeStitchedSegments,
  parseGoogleDurationToMs,
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

describe("dedicated Google STT timestamps", () => {
  it("normalizes Google word offsets into ordered canonical segments", () => {
    const segments = googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Bonjour.", confidence: 0.91, words: words("0.100s", "0.800s", "Bonjour") }] },
      { alternatives: [{ transcript: "Comment allez-vous ?", confidence: 0.88, words: words("1.200s", "2.400s") }] },
    ], 55_000, 0);

    expect(segments).toMatchObject([
      { id: "seg-001", index: 0, start_ms: 55_100, end_ms: 55_800, text: "Bonjour." },
      { id: "seg-002", index: 1, start_ms: 56_200, end_ms: 57_400, text: "Comment allez-vous ?" },
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

  it("rejects negative timestamps", () => {
    expect(parseGoogleDurationToMs("-1.0s")).toBeNull();
    expect(() => googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Non", words: [{ startTime: "-1.0s", endTime: "0.400s", word: "Non" }] }] },
    ])).toThrow("STT_TIMESTAMP_INVALID");
  });

  it("clamps chunk-local overshoot and restitches overlapping boundaries in order", () => {
    const first = googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Fin du premier morceau", words: words("54.200s", "58.400s") }] },
    ], 0, 0, 55_000);
    const second = googleSpeechResultsToSegments([
      { alternatives: [{ transcript: "Début du second", words: words("0.100s", "1.200s") }] },
    ], 55_000, 0, 55_000);
    expect(first[0]).toMatchObject({ start_ms: 54_200, end_ms: 55_000 });
    const stitched = normalizeStitchedSegments([...second, ...first]);
    expect(stitched.map((segment) => segment.text)).toEqual(["Fin du premier morceau", "Début du second"]);
    expect(stitched[0].end_ms).toBeLessThanOrEqual(stitched[1].start_ms);
    expect(stitched[1].start_ms).toBeGreaterThanOrEqual(55_000);
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
    expect(params.timestamp_source).not.toBe("gemini");
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
    expect(assessDedicatedSttTimestamps(result, 60_000)).toEqual({
      status: "unverified",
      audioDurationMs: 60_000,
      transcriptEndMs: 90_000,
      driftMs: 30_000,
    });
  });

  it("accepts legitimate trailing silence when no segment exceeds duration", () => {
    expect(assessTimestampCoverage([{ end_ms: 57_100 }], 60_000)).toEqual({
      status: "verified",
      audioDurationMs: 60_000,
      transcriptEndMs: 57_100,
      driftMs: -2_900,
    });
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
