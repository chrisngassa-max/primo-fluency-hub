import { supabase } from "@/integrations/supabase/client";
import type { PedagogicalSource } from "./pedagogicalSources";
import type { TranscriptionStatus } from "./pedagogicalSourceTranscriptions";

export type SourceUsabilityResult = {
  source_id: string;
  review_status: "utilisable";
  updated_at: string;
  changed: boolean;
};

export const SOURCE_REVIEW_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Reconnectez-vous pour relire cette source.",
  STAFF_ROLE_REQUIRED: "Cette action est réservée aux formateurs et administrateurs.",
  SOURCE_FORBIDDEN: "Cette source appartient à un autre formateur.",
  SOURCE_NOT_FOUND: "Cette source n’existe plus. Revenez à la liste du Studio.",
  SOURCE_NOT_AUDIO: "Cette action nécessite une source audio.",
  SOURCE_HASH_REQUIRED: "Le fichier doit être haché avant la revue.",
  SOURCE_MP3_MISSING: "Le fichier audio n’est pas disponible.",
  TRANSCRIPTION_NOT_FOUND: "La transcription est absente. Terminez l’étape de transcription.",
  REVIEWED_TRANSCRIPTION_REQUIRED: "Relisez et enregistrez la correction de la transcription.",
  SOURCE_NOT_ANALYZED: "Terminez l’analyse de la source avant de confirmer.",
  SOURCE_RIGHTS_REQUIRED: "Renseignez les droits et autorisez la réutilisation pour la génération IA.",
  SOURCE_REVIEW_INVALID_STATE: "Le statut actuel ne permet pas de marquer cette source comme utilisable.",
  SOURCE_REVIEW_CONFIRMATION_REQUIRED: "Confirmez explicitement la revue de la source.",
  SOURCE_REVIEW_CONFLICT: "La source a changé ou une autre opération est en cours. Actualisez puis relisez avant de confirmer.",
  SOURCE_REVIEW_DIRECT_WRITE_FORBIDDEN: "Utilisez le dialogue de revue pour modifier le statut de la source.",
};

export function sourceReviewError(error: unknown): string {
  const value = error as { message?: string; code?: string } | null;
  const message = value?.message ?? String(error ?? "");
  if (["40001", "40P01", "55P03"].includes(value?.code ?? "")) return SOURCE_REVIEW_MESSAGES.SOURCE_REVIEW_CONFLICT;
  for (const [code, text] of Object.entries(SOURCE_REVIEW_MESSAGES)) if (message.includes(code)) return text;
  return "La revue n’a pas pu être confirmée. Vérifiez votre connexion, actualisez la source puis réessayez.";
}

// UI assistance only: the RPC revalidates every condition under a row lock.
export function sourceReviewBlock(source: PedagogicalSource, transcription: TranscriptionStatus | null | undefined, userId: string | undefined, role: string | null): string | null {
  if (!userId) return "AUTH_REQUIRED";
  if (role !== "formateur" && role !== "admin") return "STAFF_ROLE_REQUIRED";
  if (role !== "admin" && source.created_by !== userId) return "SOURCE_FORBIDDEN";
  if (source.review_status !== "brouillon") return "SOURCE_REVIEW_INVALID_STATE";
  if (source.source_kind !== "audio") return "SOURCE_NOT_AUDIO";
  if (!source.content_hash?.match(/^sha256:[a-f0-9]{64}$/)) return "SOURCE_HASH_REQUIRED";
  if (!source.storage_path || !source.storage_bucket) return "SOURCE_MP3_MISSING";
  if (!transcription) return "TRANSCRIPTION_NOT_FOUND";
  if (transcription !== "reviewed") return "REVIEWED_TRANSCRIPTION_REQUIRED";
  if (source.status !== "analyzed") return "SOURCE_NOT_ANALYZED";
  if (!source.rights_status?.trim() || !source.reusable_for_ai) return "SOURCE_RIGHTS_REQUIRED";
  return null;
}

export async function markSourceUsable(source: PedagogicalSource): Promise<SourceUsabilityResult> {
  // Narrow local typing until generated DB types include the new local migration.
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: "mark_pedagogical_source_usable", args: {
    p_source_id: string; p_confirmed: boolean; p_expected_updated_at: string;
  }) => Promise<{ data: SourceUsabilityResult[] | null; error: unknown }>;
  const { data, error } = await rpc("mark_pedagogical_source_usable", {
    p_source_id: source.id, p_confirmed: true, p_expected_updated_at: source.updated_at,
  });
  if (error) throw error;
  if (!data?.[0] || data[0].source_id !== source.id || data[0].review_status !== "utilisable") throw new Error("Invalid source review response");
  return data[0];
}
