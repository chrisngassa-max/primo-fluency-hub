import {
  assessTimestampCoverage,
  readMp3Duration,
  splitMp3ByMaxDurationMs,
  type Mp3Chunk,
} from "./audio-duration.ts";
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
export const GOOGLE_STT_CHUNK_TOLERANCE_MS = 2_000;
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
  sampleRateHertz: number;
}) => Promise<GoogleSttRecognizeResponse>;

export type RawChunkTimestampDiagnostics = {
  chunk_index: number;
  physical_duration_ms: number;
  sample_rate_hz: number;
  mpeg_version: number;
  first_raw_offset_ms: number | null;
  last_raw_offset_ms: number | null;
  raw_overshoot_ms: number | null;
  segment_count: number;
  text_preview: string;
};

export function isAllowedAudioTimestampProvider(provider: string): boolean {
  return provider === GOOGLE_STT_PROVIDER;
}

export function isModelUnsupportedError(message: string): boolean {
  return message.includes("STT_PROVIDER_ERROR:400")
    && /model|unsupported|invalid argument|INVALID_ARGUMENT/i.test(message);
}

/** Accept only protobuf Duration forms: "1.250s" or {seconds, nanos}. Bare numbers are rejected. */
export function parseGoogleDurationToMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return null;
  if (typeof value === "object") {
    const record = value as { seconds?: unknown; nanos?: unknown };
    if (!("seconds" in record) && !("nanos" in record)) return null;
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
    const startMs = parseGoogleDurationToMs(words[0]?.startTime ?? words[0]?.start_time);
    const endMs = parseGoogleDurationToMs(words[words.length - 1]?.endTime ?? words[words.length - 1]?.end_time);
    if (startMs == null || endMs == null) throw new Error("STT_TIMESTAMP_INVALID");
    if (startMs < 0 || endMs < 0) throw new Error("STT_TIMESTAMP_NEGATIVE");
    if (endMs <= startMs) throw new Error("STT_SEGMENT_INVERTED");
    if (chunkDurationMs != null && chunkDurationMs > 0) {
      if (startMs > chunkDurationMs + GOOGLE_STT_CHUNK_TOLERANCE_MS
        || endMs > chunkDurationMs + GOOGLE_STT_CHUNK_TOLERANCE_MS) {
        throw new Error(
          `STT_CHUNK_TIMESTAMP_OUT_OF_RANGE:start=${startMs}:end=${endMs}:chunk=${chunkDurationMs}`,
        );
      }
    }
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

/** Reindex only. Never mutates start_ms / end_ms. */
export function reindexSegmentsPreservingTimes(segments: CanonicalSttSegment[]): CanonicalSttSegment[] {
  return segments.map((segment, index) => ({
    ...segment,
    id: `seg-${String(index + 1).padStart(3, "0")}`,
    index,
  }));
}

export function assertRawSegmentChronology(segments: CanonicalSttSegment[]): void {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.start_ms < 0 || segment.end_ms < 0) throw new Error("STT_TIMESTAMP_NEGATIVE");
    if (segment.end_ms <= segment.start_ms) throw new Error("STT_SEGMENT_INVERTED");
    if (index > 0) {
      const previous = segments[index - 1];
      if (segment.start_ms < previous.start_ms) {
        throw new Error(`STT_SEGMENTS_UNORDERED:index=${index}`);
      }
      if (segment.start_ms < previous.end_ms) {
        throw new Error(
          `STT_CHUNK_SEGMENTS_OVERLAP:prev_end=${previous.end_ms}:start=${segment.start_ms}`,
        );
      }
    }
  }
}

export function collectRawChunkDiagnostics(
  response: GoogleSttRecognizeResponse,
  chunk: Mp3Chunk,
  chunkIndex: number,
): RawChunkTimestampDiagnostics {
  const words = (response.results ?? []).flatMap((result) => result.alternatives?.[0]?.words ?? []);
  const first = words.length ? parseGoogleDurationToMs(words[0]?.startTime ?? words[0]?.start_time) : null;
  const last = words.length
    ? parseGoogleDurationToMs(words[words.length - 1]?.endTime ?? words[words.length - 1]?.end_time)
    : null;
  const text = (response.results ?? [])
    .map((result) => result.alternatives?.[0]?.transcript?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return {
    chunk_index: chunkIndex,
    physical_duration_ms: chunk.durationMs,
    sample_rate_hz: chunk.sampleRateHz,
    mpeg_version: chunk.mpegVersion,
    first_raw_offset_ms: first,
    last_raw_offset_ms: last,
    raw_overshoot_ms: last == null ? null : last - chunk.durationMs,
    segment_count: (response.results ?? []).filter((result) => result.alternatives?.[0]?.transcript?.trim()).length,
    text_preview: text.slice(0, 160),
  };
}

export function detectBoundaryTextIssues(
  leftText: string,
  rightText: string,
): { duplicated_tail: string | null; suspicious_gap: boolean } {
  const leftTokens = leftText.trim().split(/\s+/).filter(Boolean);
  const rightTokens = rightText.trim().split(/\s+/).filter(Boolean);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return { duplicated_tail: null, suspicious_gap: false };
  }
  let duplicated: string | null = null;
  const max = Math.min(6, leftTokens.length, rightTokens.length);
  for (let size = max; size >= 2; size -= 1) {
    const leftTail = leftTokens.slice(-size).join(" ").toLowerCase();
    const rightHead = rightTokens.slice(0, size).join(" ").toLowerCase();
    if (leftTail === rightHead) {
      duplicated = leftTokens.slice(-size).join(" ");
      break;
    }
  }
  return { duplicated_tail: duplicated, suspicious_gap: false };
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
  mpegVersion?: number | null;
  sampleRateHz?: number | null;
  channels?: number | null;
  firstStartMs: number | null;
  lastEndMs: number | null;
  timestampStatus: "verified" | "unverified";
  transcriptEndMs: number | null;
  timestampDriftMs: number | null;
  overshootMs?: number | null;
  trailingGapMs?: number | null;
  coverageRatio?: number | null;
  chunkDiagnostics?: RawChunkTimestampDiagnostics[];
}): Record<string, unknown> {
  return {
    path: "dedicated_stt",
    content_hash: input.contentHash,
    encoding: "MP3",
    language_code: input.language,
    enable_word_time_offsets: true,
    enable_automatic_punctuation: true,
    sample_rate_hertz: input.sampleRateHz ?? null,
    mpeg_version: input.mpegVersion ?? null,
    channels: input.channels ?? null,
    chunk_max_duration_ms: GOOGLE_STT_CHUNK_MAX_MS,
    chunk_count: input.chunkCount,
    audio_duration_ms: input.audioDurationMs,
    mp3_frame_count: input.mp3FrameCount,
    first_segment_start_ms: input.firstStartMs,
    last_segment_end_ms: input.lastEndMs,
    timestamp_status: input.timestampStatus,
    transcript_end_ms: input.transcriptEndMs,
    timestamp_drift_ms: input.timestampDriftMs,
    overshoot_ms: input.overshootMs ?? null,
    trailing_gap_ms: input.trailingGapMs ?? null,
    coverage_ratio: input.coverageRatio ?? null,
    timestamp_source: AUDIO_TIMESTAMP_SOURCE,
    timestamp_provider: GOOGLE_STT_PROVIDER,
    model_id: input.modelId,
    transformations_applied: [],
    chunk_diagnostics: input.chunkDiagnostics ?? [],
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
  sampleRateHertz: number;
  apiKey: string;
}): Promise<GoogleSttRecognizeResponse> {
  const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${input.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        encoding: "MP3",
        sampleRateHertz: input.sampleRateHertz,
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

async function recognizeAllChunks(
  chunks: Mp3Chunk[],
  modelId: string,
  language: string,
  recognize: RecognizeChunkFn,
): Promise<GoogleSttRecognizeResponse[]> {
  return await Promise.all(chunks.map((chunk) =>
    recognize({
      audioBytes: chunk.bytes,
      modelId,
      language,
      sampleRateHertz: chunk.sampleRateHz,
    })
  ));
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
  const preferredModel = input.modelId || GOOGLE_STT_DEFAULT_MODEL;
  const audioMeta = readMp3Duration(input.bytes);
  const chunks = splitMp3ByMaxDurationMs(input.bytes, GOOGLE_STT_CHUNK_MAX_MS);
  if (chunks.length === 0) throw new Error("STT_AUDIO_UNREADABLE");
  const recognize = input.recognize ?? ((chunkInput) => defaultRecognizeChunk({
    ...chunkInput,
    apiKey: readGoogleSttApiKey(input.apiKey),
  }));

  let modelId = preferredModel;
  let responses: GoogleSttRecognizeResponse[];
  try {
    responses = await recognizeAllChunks(chunks, modelId, language, recognize);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (preferredModel === GOOGLE_STT_DEFAULT_MODEL && isModelUnsupportedError(message)) {
      modelId = GOOGLE_STT_FALLBACK_MODEL;
      responses = await recognizeAllChunks(chunks, modelId, language, recognize);
    } else {
      throw error instanceof Error ? error : new Error("STT_PROVIDER_ERROR");
    }
  }

  const chunkDiagnostics = responses.map((response, index) =>
    collectRawChunkDiagnostics(response, chunks[index], index)
  );
  for (const diagnostic of chunkDiagnostics) {
    if (diagnostic.raw_overshoot_ms != null && diagnostic.raw_overshoot_ms > GOOGLE_STT_CHUNK_TOLERANCE_MS) {
      throw new Error(
        `STT_CHUNK_TIMESTAMP_OUT_OF_RANGE:chunk=${diagnostic.chunk_index}:overshoot=${diagnostic.raw_overshoot_ms}`,
      );
    }
  }

  const segmentsByChunk = responses.map((response, index) =>
    googleSpeechResultsToSegments(response.results, chunks[index].startMs, 0, chunks[index].durationMs)
  );
  const boundaryIssues = [];
  for (let index = 1; index < segmentsByChunk.length; index += 1) {
    const left = segmentsByChunk[index - 1];
    const right = segmentsByChunk[index];
    if (left.length === 0 || right.length === 0) continue;
    const leftText = left.map((segment) => segment.text).join(" ");
    const rightText = right.map((segment) => segment.text).join(" ");
    const issue = detectBoundaryTextIssues(leftText, rightText);
    if (issue.duplicated_tail) {
      throw new Error(`STT_CHUNK_BOUNDARY_TEXT_DUPLICATE:${issue.duplicated_tail}`);
    }
    boundaryIssues.push({
      between_chunks: [index - 1, index],
      left_last_end_ms: left[left.length - 1].end_ms,
      right_first_start_ms: right[0].start_ms,
      duplicated_tail: null,
    });
  }

  const segments = reindexSegmentsPreservingTimes(segmentsByChunk.flat());
  if (segments.length === 0) throw new Error("STT_TIMESTAMPS_MISSING");
  assertRawSegmentChronology(segments);

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
      transformations_applied: [],
      sample_rate_hz: audioMeta?.sampleRateHz ?? chunks[0]?.sampleRateHz ?? null,
      mpeg_version: audioMeta?.mpegVersion ?? chunks[0]?.mpegVersion ?? null,
      channels: audioMeta?.channels ?? chunks[0]?.channels ?? null,
      chunk_diagnostics: chunkDiagnostics,
      boundary_diagnostics: boundaryIssues,
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
