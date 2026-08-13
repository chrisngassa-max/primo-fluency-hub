import { assessTimestampCoverage, splitMp3ByMaxDurationMs } from "./audio-duration.ts";
import {
  bytesToBase64,
  validateCanonicalTranscription,
  type CanonicalTranscription,
  type CanonicalTranscriptionSegment,
} from "./canonical.ts";

export const GOOGLE_STT_PROVIDER = "google-stt";
export const GOOGLE_STT_DEFAULT_MODEL = "latest_long";
export const GOOGLE_STT_FALLBACK_MODEL = "default";
export const GOOGLE_STT_CHUNK_MAX_MS = 55_000;
export const AUDIO_TIMESTAMP_SOURCE = "google_stt_word_offsets";
export const STANDARD_STT_USD_PER_15S = 0.006;

export type CanonicalSttSegment = {
  id: string;
  index: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker?: string | null;
  confidence?: number | null;
};

export type CanonicalSttResult = {
  text: string;
  segments: CanonicalSttSegment[];
  provider: string;
  modelId: string;
  language: string;
  confidence: number | null;
  metadata: Record<string, unknown>;
};

export type GoogleSttWord = {
  startTime?: unknown;
  endTime?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  word?: string;
  speakerTag?: number;
  speaker_tag?: number;
};

export type GoogleSttRecognizeResponse = {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
      words?: GoogleSttWord[];
    }>;
  }>;
};

export type RecognizeChunkFn = (input: {
  audioBytes: Uint8Array;
  modelId: string;
  language: string;
}) => Promise<GoogleSttRecognizeResponse>;

export function isAllowedAudioTimestampProvider(provider: string): boolean {
  return provider === GOOGLE_STT_PROVIDER;
}

export function parseGoogleDurationToMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * (value <= 10_000 ? 1000 : 1));
  }
  if (typeof value === "object") {
    const record = value as { seconds?: unknown; nanos?: unknown };
    const seconds = Number(record.seconds ?? 0);
    const nanos = Number(record.nanos ?? 0);
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(nanos) || nanos < 0) return null;
    return Math.round(seconds * 1000 + nanos / 1e6);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.startsWith("-")) return null;
  const match = text.match(/^(\d+)(?:\.(\d+))?s$/);
  if (!match) return null;
  const seconds = Number(match[1]);
  const fraction = match[2] ? Number(`0.${match[2]}`) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(fraction)) return null;
  return Math.round((seconds + fraction) * 1000);
}

export function clampChunkRelativeMs(value: number, chunkDurationMs: number | null): number {
  if (chunkDurationMs == null || chunkDurationMs <= 0) return value;
  return Math.max(0, Math.min(value, chunkDurationMs));
}

export function googleSpeechResultsToSegments(
  results: GoogleSttRecognizeResponse["results"],
  chunkOffsetMs = 0,
  startIndex = 0,
  chunkDurationMs: number | null = null,
): CanonicalSttSegment[] {
  if (!Array.isArray(results) || results.length === 0) return [];
  const segments: CanonicalSttSegment[] = [];
  for (const result of results) {
    const alternative = result?.alternatives?.[0];
    const text = typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
    if (!text) continue;
    const words = Array.isArray(alternative?.words) ? alternative.words : [];
    if (words.length === 0) throw new Error("STT_TIMESTAMPS_MISSING");
    const parsedStart = parseGoogleDurationToMs(words[0]?.startTime ?? words[0]?.start_time);
    const parsedEnd = parseGoogleDurationToMs(words[words.length - 1]?.endTime ?? words[words.length - 1]?.end_time);
    if (parsedStart == null || parsedEnd == null) throw new Error("STT_TIMESTAMP_INVALID");
    if (parsedStart < 0 || parsedEnd < 0) throw new Error("STT_TIMESTAMP_NEGATIVE");
    if (parsedEnd <= parsedStart) throw new Error("STT_SEGMENT_INVERTED");
    const startMs = clampChunkRelativeMs(parsedStart, chunkDurationMs);
    const endMs = Math.max(startMs + 1, clampChunkRelativeMs(parsedEnd, chunkDurationMs));
    const speakerTag = words.find((word) => word.speakerTag != null || word.speaker_tag != null);
    const tag = speakerTag?.speakerTag ?? speakerTag?.speaker_tag;
    const index = startIndex + segments.length;
    segments.push({
      id: `seg-${String(index + 1).padStart(3, "0")}`,
      index,
      start_ms: startMs + chunkOffsetMs,
      end_ms: endMs + chunkOffsetMs,
      text,
      speaker: typeof tag === "number" ? `speaker_${tag}` : null,
      confidence: typeof alternative?.confidence === "number" && alternative.confidence >= 0 && alternative.confidence <= 1
        ? alternative.confidence
        : null,
    });
  }
  return segments;
}

export function normalizeStitchedSegments(segments: CanonicalSttSegment[]): CanonicalSttSegment[] {
  const ordered = [...segments].sort((left, right) => left.start_ms - right.start_ms || left.end_ms - right.end_ms);
  let previousEnd = 0;
  return ordered.map((segment, index) => {
    const startMs = Math.max(segment.start_ms, previousEnd);
    const endMs = Math.max(segment.end_ms, startMs + 1);
    previousEnd = endMs;
    return {
      ...segment,
      id: `seg-${String(index + 1).padStart(3, "0")}`,
      index,
      start_ms: startMs,
      end_ms: endMs,
    };
  });
}

export function toCanonicalTranscription(result: CanonicalSttResult): CanonicalTranscription {
  return {
    language: result.language,
    full_text: result.text,
    segments: result.segments.map((segment, index) => ({
      segment_key: segment.id || `seg-${String(index + 1).padStart(3, "0")}`,
      sequence_index: segment.index ?? index,
      speaker_label: segment.speaker ?? null,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text: segment.text,
      confidence: segment.confidence ?? null,
    } satisfies CanonicalTranscriptionSegment)),
  };
}

export function estimateGoogleSttCostUsd(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  return Math.ceil(durationMs / 15_000) * STANDARD_STT_USD_PER_15S;
}

export function buildDedicatedSttProviderParameters(input: {
  contentHash: string;
  modelId: string;
  language: string;
  chunkCount: number;
  audioDurationMs: number | null;
  mp3FrameCount: number | null;
  firstStartMs: number | null;
  lastEndMs: number | null;
  timestampStatus: "verified" | "unverified";
  transcriptEndMs: number | null;
  timestampDriftMs: number | null;
}): Record<string, unknown> {
  return {
    path: "dedicated_stt",
    content_hash: input.contentHash,
    encoding: "MP3",
    language_code: input.language,
    enable_word_time_offsets: true,
    enable_automatic_punctuation: true,
    chunk_max_duration_ms: GOOGLE_STT_CHUNK_MAX_MS,
    chunk_count: input.chunkCount,
    audio_duration_ms: input.audioDurationMs,
    mp3_frame_count: input.mp3FrameCount,
    first_segment_start_ms: input.firstStartMs,
    last_segment_end_ms: input.lastEndMs,
    timestamp_status: input.timestampStatus,
    transcript_end_ms: input.transcriptEndMs,
    timestamp_drift_ms: input.timestampDriftMs,
    timestamp_source: AUDIO_TIMESTAMP_SOURCE,
    timestamp_provider: GOOGLE_STT_PROVIDER,
    model_id: input.modelId,
  };
}

function readGoogleSttApiKey(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  const fromDeno = (globalThis as { Deno?: { env?: { get: (name: string) => string | undefined } } })
    .Deno?.env?.get("GOOGLE_STT_API_KEY")?.trim();
  if (fromDeno) return fromDeno;
  throw new Error("GOOGLE_STT_API_KEY_MISSING");
}

async function defaultRecognizeChunk(input: {
  audioBytes: Uint8Array;
  modelId: string;
  language: string;
  apiKey: string;
}): Promise<GoogleSttRecognizeResponse> {
  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${input.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        encoding: "MP3",
        languageCode: input.language,
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
        model: input.modelId,
      },
      audio: { content: bytesToBase64(input.audioBytes) },
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`STT_PROVIDER_ERROR:${response.status}:${detail}`);
  }
  return await response.json() as GoogleSttRecognizeResponse;
}

export async function transcribeAudioWithDedicatedStt(input: {
  bytes: Uint8Array;
  mimeType: string;
  language?: string;
  apiKey?: string;
  modelId?: string;
  recognize?: RecognizeChunkFn;
}): Promise<CanonicalSttResult> {
  const mimeType = input.mimeType || "audio/mpeg";
  if (!mimeType.includes("mpeg") && mimeType !== "audio/mp3") {
    throw new Error("STT_UNSUPPORTED_MIME");
  }
  const language = input.language || "fr-FR";
  let modelId = input.modelId || GOOGLE_STT_DEFAULT_MODEL;
  const chunks = splitMp3ByMaxDurationMs(input.bytes, GOOGLE_STT_CHUNK_MAX_MS);
  if (chunks.length === 0) throw new Error("STT_AUDIO_UNREADABLE");
  const recognize = input.recognize ?? ((chunkInput) => defaultRecognizeChunk({
    ...chunkInput,
    apiKey: readGoogleSttApiKey(input.apiKey),
  }));

  const recognizeChunk = async (chunk: typeof chunks[number]) => {
    try {
      return await recognize({ audioBytes: chunk.bytes, modelId, language });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (modelId === GOOGLE_STT_DEFAULT_MODEL && message.includes("STT_PROVIDER_ERROR:400")) {
        modelId = GOOGLE_STT_FALLBACK_MODEL;
        return await recognize({ audioBytes: chunk.bytes, modelId, language });
      }
      throw error instanceof Error ? error : new Error("STT_PROVIDER_ERROR");
    }
  };
  const responses = await Promise.all(chunks.map((chunk) => recognizeChunk(chunk)));
  const segments = normalizeStitchedSegments(responses.flatMap((response, index) =>
    googleSpeechResultsToSegments(response.results, chunks[index].startMs, 0, chunks[index].durationMs)
  ));
  const confidences = segments.map((segment) => segment.confidence).filter((value): value is number => typeof value === "number");
  const result: CanonicalSttResult = {
    text: segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim(),
    segments,
    provider: GOOGLE_STT_PROVIDER,
    modelId,
    language,
    confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
    metadata: {
      encoding: "MP3",
      chunk_count: chunks.length,
      timestamp_source: AUDIO_TIMESTAMP_SOURCE,
    },
  };
  if (!isAllowedAudioTimestampProvider(result.provider)) throw new Error("STT_TIMESTAMP_PROVIDER_FORBIDDEN");
  const canonical = toCanonicalTranscription(result);
  const validationErrors = validateCanonicalTranscription(canonical);
  if (validationErrors.length > 0) throw new Error(`TRANSCRIPTION_INVALID:${validationErrors.join(",")}`);
  return result;
}

export function assessDedicatedSttTimestamps(
  result: CanonicalSttResult,
  audioDurationMs: number | null,
) {
  return assessTimestampCoverage(
    result.segments.map((segment) => ({ end_ms: segment.end_ms })),
    audioDurationMs,
  );
}
