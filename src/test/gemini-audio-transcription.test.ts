import { describe, expect, it } from "vitest";
import {
  buildGeminiProviderParameters,
  filterPersistableGeminiSegments,
  normalizeTimestampToMs,
  parseGeminiTranscription,
  validateCanonicalTranscription,
  validateGeminiTranscriptionForPersistence,
} from "../../supabase/functions/_shared/transcription/gemini-audio.ts";

describe("Gemini audio transcription adapter", () => {
  it("normalizes millisecond and clock timestamps", () => {
    expect(normalizeTimestampToMs(1250)).toBe(1250);
    expect(normalizeTimestampToMs("01:02.5")).toBe(62_500);
    expect(normalizeTimestampToMs("01:01:02.5")).toBe(3_662_500);
    expect(normalizeTimestampToMs("-1")).toBeNull();
    expect(normalizeTimestampToMs("not-a-time")).toBeNull();
  });

  it("parses fenced Gemini JSON and supplies stable segment defaults", () => {
    const transcription = parseGeminiTranscription(`\`\`\`json
      {
        "language": "fr",
        "full_text": "Bonjour. Comment allez-vous ?",
        "segments": [
          { "start": "00:00", "end": "00:01.2", "text": "Bonjour." },
          { "start_time": 1200, "end_time": 2600, "text": "Comment allez-vous ?" }
        ]
      }
    \`\`\``);

    expect(transcription.language).toBe("fr");
    expect(transcription.segments).toMatchObject([
      { segment_key: "seg-001", sequence_index: 0, start_ms: 0, end_ms: 1200, text: "Bonjour." },
      { segment_key: "seg-002", sequence_index: 1, start_ms: 1200, end_ms: 2600, text: "Comment allez-vous ?" },
    ]);
    expect(validateCanonicalTranscription(transcription)).toEqual([]);
  });

  it("rejects chronology, empty text, and incoherent full text under strict canonical rules", () => {
    const transcription = parseGeminiTranscription(JSON.stringify({
      language: "fr",
      full_text: "Un contenu différent",
      segments: [
        { segment_key: "seg-001", sequence_index: 0, start_ms: 1000, end_ms: 2000, text: "Bonjour" },
        { segment_key: "seg-002", sequence_index: 1, start_ms: 1500, end_ms: 1400, text: "" },
      ],
    }));

    expect(validateCanonicalTranscription(transcription)).toEqual(expect.arrayContaining([
      "TRANSCRIPTION_CHRONOLOGY_INVALID:1",
      "TRANSCRIPTION_END_INVALID:1",
      "TRANSCRIPTION_SEGMENT_TEXT_EMPTY:1",
      "TRANSCRIPTION_FULL_TEXT_INCOHERENT",
    ]));
  });

  it("never marks Gemini provider parameters as verified timestamps", () => {
    const params = buildGeminiProviderParameters({
      contentHash: "sha256:" + "a".repeat(64),
      language: "fr",
      audioDurationMs: 60_000,
      mp3FrameCount: 100,
      firstStartMs: 0,
      lastEndMs: 59_000,
      transcriptEndMs: 59_000,
      timestampDriftMs: -1_000,
      overshootMs: 0,
      trailingGapMs: 1_000,
      coverageRatio: 0.983,
      filtering: {
        raw_segment_count: 2,
        persisted_segment_count: 2,
        dropped_segment_count: 0,
        dropped_segment_reasons: [],
        filtering_applied: false,
      },
    });
    expect(params.timestamp_status).toBe("unverified");
    expect(params.transformations_applied).toEqual([]);
    expect(params.filtering_applied).toBe(false);
    expect(params.timestamp_provider).toBe("gemini");
    expect(params.path).toBe("gemini_full_file_v1");
  });

  it("preserves parsed offsets without rewriting them", () => {
    const transcription = parseGeminiTranscription(JSON.stringify({
      language: "fr",
      full_text: "Bonjour tout le monde.",
      segments: [
        { segment_key: "seg-001", sequence_index: 0, start_ms: 120, end_ms: 1880, text: "Bonjour tout le monde." },
      ],
    }));
    expect(transcription.segments[0].start_ms).toBe(120);
    expect(transcription.segments[0].end_ms).toBe(1880);
    expect(validateCanonicalTranscription(transcription)).toEqual([]);
  });

  it("drops only inverted/empty segments, keeps remaining raw offsets, and records filtering metrics", () => {
    const { transcription: filtered, filtering } = filterPersistableGeminiSegments({
      language: "fr",
      full_text: "Bonjour. Suite.",
      segments: [
        { segment_key: "seg-001", sequence_index: 0, speaker_label: null, start_ms: 0, end_ms: 1000, text: "Bonjour.", confidence: null },
        { segment_key: "seg-002", sequence_index: 1, speaker_label: null, start_ms: 2000, end_ms: 500, text: "Invalide", confidence: null },
        { segment_key: "seg-003", sequence_index: 2, speaker_label: null, start_ms: 800, end_ms: 1500, text: "Suite.", confidence: null },
      ],
    });
    expect(filtered.segments).toHaveLength(2);
    expect(filtered.segments.map((s) => [s.start_ms, s.end_ms])).toEqual([[0, 1000], [800, 1500]]);
    expect(validateGeminiTranscriptionForPersistence(filtered)).toEqual([]);
    expect(filtering).toEqual({
      raw_segment_count: 3,
      persisted_segment_count: 2,
      dropped_segment_count: 1,
      dropped_segment_reasons: ["inverted_or_empty_interval"],
      filtering_applied: true,
    });
    const params = buildGeminiProviderParameters({
      contentHash: "sha256:" + "b".repeat(64),
      language: "fr",
      audioDurationMs: 2_000,
      mp3FrameCount: 10,
      firstStartMs: 0,
      lastEndMs: 1500,
      transcriptEndMs: 1500,
      timestampDriftMs: -500,
      overshootMs: 0,
      trailingGapMs: 500,
      coverageRatio: 0.75,
      filtering,
    });
    expect(params.transformations_applied).toEqual([]);
    expect(params.filtering_applied).toBe(true);
    expect(params.dropped_segment_count).toBe(1);
    expect(params.dropped_segment_reasons).toEqual(["inverted_or_empty_interval"]);
  });
});
