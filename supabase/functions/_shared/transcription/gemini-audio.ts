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

const JSON_FENCES = /^```(?:json)?\s*|\s*```$/gi;

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
