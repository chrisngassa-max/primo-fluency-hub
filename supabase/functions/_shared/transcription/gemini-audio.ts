export {
  bytesToBase64,
  normalizeTimestampToMs,
  validateCanonicalTranscription,
  type CanonicalTranscription,
  type CanonicalTranscriptionSegment,
} from "./canonical.ts";
import {
  bytesToBase64,
  normalizeTimestampToMs,
  type CanonicalTranscription,
} from "./canonical.ts";
import { assessTimestampCoverage, readMp3Duration } from "./audio-duration.ts";

const JSON_FENCES = /^```(?:json)?\s*|\s*```$/gi;

export const GEMINI_TRANSCRIPTION_PROVIDER = "gemini";
export const GEMINI_TRANSCRIPTION_MODEL = "gemini-2.5-flash";
export const GEMINI_TIMESTAMP_SOURCE = "gemini_segment_offsets";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseGeminiTranscription(raw: string): CanonicalTranscription {
  const parsed = JSON.parse(raw.replace(JSON_FENCES, "").trim());
  const segments = Array.isArray(parsed?.segments) ? parsed.segments.map((segment: unknown, index: number) => {
    const source = segment as Record<string, unknown>;
    const startMs = normalizeTimestampToMs(source.start_ms ?? source.start ?? source.start_time);
    const endMs = normalizeTimestampToMs(source.end_ms ?? source.end ?? source.end_time);
    return {
      segment_key: text(source.segment_key) || `seg-${String(index + 1).padStart(3, "0")}`,
      sequence_index: Number.isInteger(source.sequence_index) ? Number(source.sequence_index) : index,
      speaker_label: text(source.speaker_label) || null,
      start_ms: startMs ?? Number.NaN,
      end_ms: endMs ?? Number.NaN,
      text: text(source.text),
      confidence: typeof source.confidence === "number" && source.confidence >= 0 && source.confidence <= 1
        ? source.confidence
        : null,
    };
  }) : [];
  return { language: text(parsed?.language) || "fr", full_text: text(parsed?.full_text), segments };
}

export type GeminiSegmentDropReason =
  | "non_integer_start"
  | "negative_start"
  | "non_integer_end"
  | "inverted_or_empty_interval"
  | "empty_text";

export type GeminiFilteringReport = {
  raw_segment_count: number;
  persisted_segment_count: number;
  dropped_segment_count: number;
  dropped_segment_reasons: GeminiSegmentDropReason[];
  filtering_applied: boolean;
};

function classifyDropReason(segment: CanonicalTranscription["segments"][number]): GeminiSegmentDropReason | null {
  if (!Number.isInteger(segment.start_ms)) return "non_integer_start";
  if (segment.start_ms < 0) return "negative_start";
  if (!Number.isInteger(segment.end_ms)) return "non_integer_end";
  if (segment.end_ms <= segment.start_ms) return "inverted_or_empty_interval";
  if (!segment.text) return "empty_text";
  return null;
}

export function filterPersistableGeminiSegments(
  transcription: CanonicalTranscription,
): { transcription: CanonicalTranscription; filtering: GeminiFilteringReport } {
  const dropped_segment_reasons: GeminiSegmentDropReason[] = [];
  const kept = transcription.segments.filter((segment) => {
    const reason = classifyDropReason(segment);
    if (reason) {
      dropped_segment_reasons.push(reason);
      return false;
    }
    return true;
  }).map((segment, index) => ({
    ...segment,
    // Reindex keys only; start_ms / end_ms stay exactly as provided by Gemini.
    segment_key: segment.segment_key || `seg-${String(index + 1).padStart(3, "0")}`,
    sequence_index: index,
  }));
  return {
    transcription: {
      language: transcription.language,
      full_text: transcription.full_text,
      segments: kept,
    },
    filtering: {
      raw_segment_count: transcription.segments.length,
      persisted_segment_count: kept.length,
      dropped_segment_count: dropped_segment_reasons.length,
      dropped_segment_reasons,
      filtering_applied: dropped_segment_reasons.length > 0,
    },
  };
}

/** V1 Gemini: keep raw offsets; only require persistable rows. Overlaps allowed. */
export function validateGeminiTranscriptionForPersistence(transcription: CanonicalTranscription): string[] {
  const errors: string[] = [];
  if (!transcription.full_text) errors.push("TRANSCRIPTION_TEXT_EMPTY");
  if (transcription.segments.length === 0) errors.push("TRANSCRIPTION_SEGMENTS_EMPTY");
  const keys = new Set<string>();
  transcription.segments.forEach((segment, index) => {
    if (!segment.segment_key || keys.has(segment.segment_key)) errors.push(`TRANSCRIPTION_SEGMENT_KEY_INVALID:${index}`);
    keys.add(segment.segment_key);
    if (segment.sequence_index !== index) errors.push(`TRANSCRIPTION_SEQUENCE_INVALID:${index}`);
    if (!Number.isInteger(segment.start_ms) || segment.start_ms < 0) errors.push(`TRANSCRIPTION_START_INVALID:${index}`);
    if (!Number.isInteger(segment.end_ms) || segment.end_ms <= segment.start_ms) errors.push(`TRANSCRIPTION_END_INVALID:${index}`);
    if (!segment.text) errors.push(`TRANSCRIPTION_SEGMENT_TEXT_EMPTY:${index}`);
  });
  return errors;
}

/**
 * V1 provisional path: full-file Gemini transcription.
 * Timestamps are approximate provider offsets — never rewritten, never claimed verified.
 */
export async function transcribeAudioWithGemini(
  bytes: Uint8Array,
  mimeType: string,
  apiKey?: string,
): Promise<{ transcription: CanonicalTranscription; filtering: GeminiFilteringReport }> {
  const key = (apiKey ?? Deno.env.get("GEMINI_API_KEY") ?? "").trim();
  if (!key) throw new Error("GEMINI_API_KEY_MISSING");
  const prompt = `Transcris cet audio en français de façon strictement verbatim. Ne corrige jamais silencieusement la grammaire. Préserve négations, nombres, dates, heures et noms propres. Segmente chronologiquement, indique les changements de locuteur quand possible et des timestamps. Réponds uniquement avec ce JSON:
{"language":"fr","full_text":"...","segments":[{"segment_key":"seg-001","sequence_index":0,"speaker_label":"speaker_1","start_ms":0,"end_ms":4200,"text":"...","confidence":null}]}
Les timestamps peuvent être des millisecondes ou MM:SS / HH:MM:SS.`;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: bytesToBase64(bytes) } }] }],
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_TRANSCRIPTION_FAILED:${response.status}:${(await response.text()).slice(0, 500)}`);
  const raw = (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("GEMINI_TRANSCRIPTION_EMPTY");
  const parsed = parseGeminiTranscription(raw);
  const { transcription, filtering } = filterPersistableGeminiSegments(parsed);
  const errors = validateGeminiTranscriptionForPersistence(transcription);
  if (errors.length > 0) throw new Error(`TRANSCRIPTION_INVALID:${errors.join(",")}`);
  return { transcription, filtering };
}

export function buildGeminiProviderParameters(input: {
  contentHash: string;
  language: string;
  audioDurationMs: number | null;
  mp3FrameCount: number | null;
  mpegVersion?: number | null;
  sampleRateHz?: number | null;
  channels?: number | null;
  firstStartMs: number | null;
  lastEndMs: number | null;
  transcriptEndMs: number | null;
  timestampDriftMs: number | null;
  overshootMs: number | null;
  trailingGapMs: number | null;
  coverageRatio: number | null;
  filtering: GeminiFilteringReport;
}): Record<string, unknown> {
  return {
    path: "gemini_full_file_v1",
    content_hash: input.contentHash,
    encoding: "MP3",
    language_code: input.language,
    audio_duration_ms: input.audioDurationMs,
    mp3_frame_count: input.mp3FrameCount,
    mpeg_version: input.mpegVersion ?? null,
    sample_rate_hertz: input.sampleRateHz ?? null,
    channels: input.channels ?? null,
    first_segment_start_ms: input.firstStartMs,
    last_segment_end_ms: input.lastEndMs,
    timestamp_status: "unverified",
    transcript_end_ms: input.transcriptEndMs,
    timestamp_drift_ms: input.timestampDriftMs,
    overshoot_ms: input.overshootMs,
    trailing_gap_ms: input.trailingGapMs,
    coverage_ratio: input.coverageRatio,
    timestamp_source: GEMINI_TIMESTAMP_SOURCE,
    timestamp_provider: GEMINI_TRANSCRIPTION_PROVIDER,
    model_id: GEMINI_TRANSCRIPTION_MODEL,
    // Offset values of persisted segments are never rewritten.
    transformations_applied: [],
    // Separate from transformations_applied: row-level drops of unpersistable segments.
    filtering_applied: input.filtering.filtering_applied,
    raw_segment_count: input.filtering.raw_segment_count,
    persisted_segment_count: input.filtering.persisted_segment_count,
    dropped_segment_count: input.filtering.dropped_segment_count,
    dropped_segment_reasons: input.filtering.dropped_segment_reasons,
    provisional_v1_policy:
      "trainer_review_required; unverified_timestamps_are_warning_only_when_reviewed_analyzed_approved_hashed_mp3_provenance",
  };
}

export function assessGeminiTimestampCoverage(
  transcription: CanonicalTranscription,
  audioBytes: Uint8Array,
  mimeType: string,
) {
  const duration = mimeType.includes("mpeg") || mimeType === "audio/mp3"
    ? readMp3Duration(audioBytes)
    : null;
  const assessment = assessTimestampCoverage(
    transcription.segments.map((segment) => ({ end_ms: segment.end_ms })),
    duration?.durationMs ?? null,
  );
  return {
    duration,
    assessment: { ...assessment, status: "unverified" as const },
  };
}
