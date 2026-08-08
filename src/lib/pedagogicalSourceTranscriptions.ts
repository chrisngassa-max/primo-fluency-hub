import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as any;

export type TranscriptionStatus = "pending" | "processing" | "ready" | "reviewed" | "error";

export interface PedagogicalSourceTranscription {
  id: string;
  source_id: string;
  status: TranscriptionStatus;
  raw_text: string | null;
  reviewed_text: string | null;
  language_detected: string | null;
  error_details: Record<string, unknown> | null;
  provider_parameters: {
    audio_duration_ms?: number | null;
    transcript_end_ms?: number | null;
    timestamp_drift_ms?: number | null;
    timestamp_status?: "verified" | "unverified";
  } | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface TranscriptionSegment {
  id: string;
  transcription_id: string;
  segment_key: string;
  sequence_index: number;
  speaker_label: string | null;
  start_ms: number;
  end_ms: number;
  raw_text: string;
  reviewed_text: string | null;
  confidence: number | null;
}

export async function fetchCurrentTranscription(sourceId: string): Promise<{
  transcription: PedagogicalSourceTranscription | null;
  segments: TranscriptionSegment[];
}> {
  const { data: transcription, error } = await supabase
    .from("pedagogical_source_transcriptions")
    .select("id, source_id, status, raw_text, reviewed_text, language_detected, error_details, reviewed_at, reviewed_by, provider_parameters")
    .eq("source_id", sourceId).eq("is_current", true).maybeSingle();
  if (error) throw error;
  if (!transcription) return { transcription: null, segments: [] };
  const { data: segments, error: segmentError } = await supabase
    .from("pedagogical_source_transcription_segments")
    .select("id, transcription_id, segment_key, sequence_index, speaker_label, start_ms, end_ms, raw_text, reviewed_text, confidence")
    .eq("transcription_id", transcription.id).order("sequence_index");
  if (segmentError) throw segmentError;
  return { transcription: transcription as PedagogicalSourceTranscription, segments: (segments ?? []) as TranscriptionSegment[] };
}

export async function transcribePedagogicalSource(sourceId: string, force = false) {
  const { data, error } = await supabase.functions.invoke("transcribe-pedagogical-source", { body: { sourceId, force } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { transcription_id: string; status: TranscriptionStatus; cached: boolean };
}

export async function saveTranscriptionReview(
  transcriptionId: string,
  reviewedText: string,
  segments: Array<Pick<TranscriptionSegment, "id" | "reviewed_text">>,
  userId: string,
  sourceId: string,
): Promise<{ published_family_count: number }> {
  void userId;
  void sourceId;
  if (!reviewedText.trim() || segments.some((segment) => !segment.reviewed_text?.trim())) {
    throw new Error("Le texte complet et chaque segment doivent être renseignés.");
  }
  const { data, error } = await supabase.rpc("validate_pedagogical_source_transcription_review", {
    p_transcription_id: transcriptionId,
    p_reviewed_text: reviewedText.trim(),
    p_segments: segments.map((segment) => ({
      id: segment.id,
      reviewed_text: segment.reviewed_text?.trim(),
    })),
  });
  if (error) throw error;
  return {
    published_family_count: Number(data?.published_family_count ?? 0),
  };
}
