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

const JSON_FENCES = /^```(?:json)?\s*|\s*```$/gi;

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

export async function transcribeAudioWithGemini(bytes: Uint8Array, mimeType: string): Promise<CanonicalTranscription> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
  const prompt = `Transcris cet audio en français de façon strictement verbatim. Ne corrige jamais silencieusement la grammaire. Préserve négations, nombres, dates, heures et noms propres. Segmente chronologiquement, indique les changements de locuteur quand possible et des timestamps. Réponds uniquement avec ce JSON:
{"language":"fr","full_text":"...","segments":[{"segment_key":"seg-001","sequence_index":0,"speaker_label":"speaker_1","start_ms":0,"end_ms":4200,"text":"...","confidence":null}]}
Les timestamps peuvent être des millisecondes ou MM:SS / HH:MM:SS.`;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: bytesToBase64(bytes) } }] }],
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_TRANSCRIPTION_FAILED:${response.status}:${(await response.text()).slice(0, 500)}`);
  const raw = (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("GEMINI_TRANSCRIPTION_EMPTY");
  return parseGeminiTranscription(raw);
}
