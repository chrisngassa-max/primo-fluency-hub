import { describe, expect, it } from "vitest";
import {
  normalizeTimestampToMs,
  parseGeminiTranscription,
  validateCanonicalTranscription,
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

  it("rejects chronology, empty text, and incoherent full text", () => {
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
});
