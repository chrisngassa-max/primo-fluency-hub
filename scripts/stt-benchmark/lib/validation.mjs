import { open } from "node:fs/promises";

export function validateCanonicalResult(value) {
  const errors = [];
  const required = ["schema_version", "provider", "model", "audio_id", "language", "latency_ms", "estimated_cost_usd", "text", "segments"];
  for (const key of required) {
    if (!(key in value) || value[key] === undefined) errors.push(`missing:${key}`);
  }
  if (value.schema_version !== "1.0") errors.push("schema_version:must_equal_1.0");
  for (const key of ["provider", "model", "audio_id", "language"]) {
    if (typeof value[key] !== "string" || value[key].trim() === "") errors.push(`${key}:non_empty_string`);
  }
  if (typeof value.text !== "string") errors.push("text:string");
  if (typeof value.latency_ms !== "number" || value.latency_ms < 0) errors.push("latency_ms:non_negative_number");
  if (value.estimated_cost_usd !== null && (typeof value.estimated_cost_usd !== "number" || value.estimated_cost_usd < 0)) errors.push("estimated_cost_usd:null_or_non_negative_number");
  if (!Array.isArray(value.segments)) errors.push("segments:must_be_array");
  for (const [index, segment] of (value.segments ?? []).entries()) {
    if (!segment.id) errors.push(`segments[${index}].id:required`);
    if (!Number.isInteger(segment.start_ms)) errors.push(`segments[${index}].start_ms:integer`);
    if (!Number.isInteger(segment.end_ms)) errors.push(`segments[${index}].end_ms:integer`);
    if (typeof segment.text !== "string") errors.push(`segments[${index}].text:string`);
    if (!("speaker" in segment)) errors.push(`segments[${index}].speaker:required`);
    if (!("confidence" in segment)) errors.push(`segments[${index}].confidence:required`);
    if (segment.confidence !== null && (typeof segment.confidence !== "number" || segment.confidence < 0 || segment.confidence > 1)) {
      errors.push(`segments[${index}].confidence:zero_to_one_or_null`);
    }
  }
  return errors;
}

export async function assertUsableAudioFile(audioPath) {
  const handle = await open(audioPath, "r");
  try {
    const prefix = Buffer.alloc(16);
    const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
    const decodedPrefix = prefix.subarray(0, bytesRead).toString("utf8");
    if (decodedPrefix.startsWith("FAKE-MP3::")) throw new Error(`Corpus audio factice refuse: ${audioPath}`);
    if (bytesRead === 0) throw new Error(`Fichier audio vide: ${audioPath}`);
  } finally {
    await handle.close();
  }
}
