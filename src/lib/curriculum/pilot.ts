import { supabase as _supabase } from "@/integrations/supabase/client";
import type { TrainingSession } from "./types";

const supabase = _supabase as any;

export const CURRICULUM_PALIERS = ["A2", "B1", "B2"] as const;
export type CurriculumPalier = (typeof CURRICULUM_PALIERS)[number];

export function defaultPalierCible(trainingSession: Pick<TrainingSession, "palier" | "code">): CurriculumPalier {
  if (CURRICULUM_PALIERS.includes(trainingSession.palier as CurriculumPalier)) {
    return trainingSession.palier as CurriculumPalier;
  }
  return "A2";
}

export function formatPalierParcoursLabel(palier: string): string {
  return `Palier parcours · ${palier}`;
}

export async function findPilotSession(params: {
  groupId: string;
  trainingSessionId: string;
}): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("group_id", params.groupId)
    .eq("training_session_id", params.trainingSessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createOrOpenPilotSession(params: {
  trainingSession: TrainingSession;
  groupId: string;
  palierCible: CurriculumPalier;
  dateSeance?: string;
}): Promise<{ id: string; created: boolean }> {
  const existing = await findPilotSession({
    groupId: params.groupId,
    trainingSessionId: params.trainingSession.id,
  });
  if (existing) return { id: existing.id, created: false };

  const dateSeance =
    params.dateSeance ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      titre: `${params.trainingSession.code} : ${params.trainingSession.titre}`,
      group_id: params.groupId,
      date_seance: dateSeance,
      niveau_cible: params.palierCible,
      curriculum_palier_cible: params.palierCible,
      training_session_id: params.trainingSession.id,
      duree_minutes: params.trainingSession.duree_minutes ?? 180,
      generation_automatique_activee: true,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, created: true };
}
