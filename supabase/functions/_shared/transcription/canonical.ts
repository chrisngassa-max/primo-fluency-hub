export type CanonicalTranscriptionSegment = {
  segment_key: string;
  sequence_index: number;
  speaker_label: string | null;
  start_ms: number;
  end_ms: number;
  text: string;
  confidence: number | null;
};

export type CanonicalTranscription = {
  language: string;
  full_text: string;
  segments: CanonicalTranscriptionSegment[];
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function normalizeTimestampToMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Math.round(Number(text));
  const parts = text.split(":").map((part) => part.trim());
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (!parts.every((part) => /^\d+(?:\.\d+)?$/.test(part))) return null;
  const values = parts.map(Number);
  const seconds = parts.length === 2
    ? values[0] * 60 + values[1]
    : values[0] * 3600 + values[1] * 60 + values[2];
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : null;
}

export function validateCanonicalTranscription(value: CanonicalTranscription): string[] {
  const errors: string[] = [];
  if (!value.full_text) errors.push("TRANSCRIPTION_TEXT_EMPTY");
  if (value.segments.length === 0) errors.push("TRANSCRIPTION_SEGMENTS_EMPTY");
  const keys = new Set<string>();
  let previousEnd = -1;
  value.segments.forEach((segment, index) => {
    if (!segment.segment_key || keys.has(segment.segment_key)) errors.push(`TRANSCRIPTION_SEGMENT_KEY_INVALID:${index}`);
    keys.add(segment.segment_key);
    if (segment.sequence_index !== index) errors.push(`TRANSCRIPTION_SEQUENCE_INVALID:${index}`);
    if (!Number.isInteger(segment.start_ms) || segment.start_ms < 0) errors.push(`TRANSCRIPTION_START_INVALID:${index}`);
    if (!Number.isInteger(segment.end_ms) || segment.end_ms <= segment.start_ms) errors.push(`TRANSCRIPTION_END_INVALID:${index}`);
    if (segment.start_ms < previousEnd) errors.push(`TRANSCRIPTION_CHRONOLOGY_INVALID:${index}`);
    previousEnd = Math.max(previousEnd, segment.end_ms);
    if (!segment.text) errors.push(`TRANSCRIPTION_SEGMENT_TEXT_EMPTY:${index}`);
  });
  if (value.segments.length > 0 && previousEnd > 8 * 60 * 60 * 1000) errors.push("TRANSCRIPTION_DURATION_IMPLAUSIBLE");
  const joined = value.segments.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim();
  if (joined && value.full_text && !value.full_text.replace(/\s+/g, " ").includes(joined.slice(0, Math.min(40, joined.length)))) {
    errors.push("TRANSCRIPTION_FULL_TEXT_INCOHERENT");
  }
  return errors;
}
