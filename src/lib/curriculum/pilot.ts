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

/**
 * Lecture pédagogique du plan cumulatif 80h/100h/120h (voir
 * docs/plan-formation-80-100-120-civique-v1.md). Le manifest curriculum-v2
 * porte déjà cette information via `palier` par séance :
 * - "A2" = tronc commun S01–S25 + E1 + E2 (80h)
 * - "B1" = extension commune B1/B2, S26–S31 + E3 (+20h, cumul 100h)
 * - "B2" = extension B2 uniquement, S32–S37 + E4 (+20h, cumul 120h)
 */
export type CurriculumTier = "tronc_80" | "extension_b1" | "extension_b2";

export function isEvaluationSession(session: Pick<TrainingSession, "code">): boolean {
  return session.code.startsWith("E");
}

export function getSessionTier(session: Pick<TrainingSession, "palier">): CurriculumTier {
  if (session.palier === "B2") return "extension_b2";
  if (session.palier === "B1") return "extension_b1";
  return "tronc_80";
}

export function getSessionTierBadgeLabel(session: Pick<TrainingSession, "code" | "palier">): string {
  if (isEvaluationSession(session)) return "Évaluation";
  const tier = getSessionTier(session);
  if (tier === "extension_b2") return "+20h B2";
  if (tier === "extension_b1") return "+20h B1/B2";
  return "80h tronc commun";
}

export const CURRICULUM_TIER_FILTERS = [
  { value: "tous", label: "Tous", heures: null },
  { value: "tronc_80", label: "Tronc commun 80h", heures: 80 },
  { value: "b1_100", label: "Parcours B1 100h", heures: 100 },
  { value: "b2_120", label: "Parcours B2 120h", heures: 120 },
  { value: "extensions", label: "Extensions uniquement", heures: null },
] as const;

export type CurriculumTierFilter = (typeof CURRICULUM_TIER_FILTERS)[number]["value"];

export function matchesCurriculumTierFilter(
  session: Pick<TrainingSession, "palier">,
  filter: CurriculumTierFilter,
): boolean {
  switch (filter) {
    case "tronc_80":
      return session.palier === "A2";
    case "b1_100":
      return session.palier === "A2" || session.palier === "B1";
    case "extensions":
      return session.palier === "B1" || session.palier === "B2";
    case "b2_120":
    case "tous":
    default:
      return true;
  }
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
