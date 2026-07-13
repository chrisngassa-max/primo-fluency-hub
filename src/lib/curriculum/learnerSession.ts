import { supabase } from "@/integrations/supabase/client";

/**
 * Couche d'accès apprenant au parcours de séance — REVU après relecture
 * indépendante (2026-07-13). N'interroge plus jamais `session_documents`,
 * `session_document_links` ni `exercices.contenu` directement : ces tables
 * n'ont plus aucune policy RLS SELECT apprenant (voir migration
 * 20260713090000, section 3). Tout passe par les edge functions
 * `get-seance-content` / `submit-seance-answer` / `get-attempt-correction`,
 * qui recalculent l'autorisation et ne renvoient jamais bonne_reponse/
 * score avant libération formateur.
 */

export interface LearnerActivity {
  id: string;
  activity_code: string;
  title: string;
  objective: string | null;
  display_order: number;
  pedagogical_status: string;
}

export interface LearnerSupportBlock {
  kind: "support";
  id: string;
  activity_id: string | null;
  display_order: number;
  title: string;
  content_html: string | null;
  content_json: unknown;
}

/** Item nettoyé : jamais de bonne_reponse/explication/barème (voir edge function). */
export interface SanitizedItem {
  question?: string;
  texte?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
}

export interface LearnerExerciseBlock {
  kind: "exercise";
  id: string;
  activity_id: string | null;
  display_order: number;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: string;
  civic_content: boolean;
  items: SanitizedItem[];
}

export type LearnerSessionBlock = LearnerSupportBlock | LearnerExerciseBlock;

async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function fetchSeanceContent(sessionCode: string): Promise<{
  activities: LearnerActivity[];
  blocks: LearnerSessionBlock[];
}> {
  return invokeEdgeFunction("get-seance-content", { session_code: sessionCode });
}

export interface AttemptCorrectionResponse {
  attempt_id?: string;
  status: string;
  released: boolean;
  score_normalized?: number;
  item_results?: Record<string, { question: string; reponse_donnee: string; bonne_reponse: string; correct: boolean; explication: string | null }>;
  correction_viewed_at?: string | null;
}

export async function fetchAttemptCorrection(exerciseId: string): Promise<AttemptCorrectionResponse> {
  return invokeEdgeFunction("get-attempt-correction", { exercise_id: exerciseId });
}

export interface SubmitAnswerResponse {
  attempt_id: string;
  status: string;
  progress: { total_items: number; answered: number };
}

/**
 * Envoie les réponses au serveur pour correction. Ne reçoit JAMAIS le
 * score ni la correction en retour (relecture indépendante, point 2) —
 * uniquement une confirmation de complétion.
 */
export async function submitSeanceAnswer(input: {
  exerciseId: string;
  sessionCode: string;
  answers: Record<string, string>;
}): Promise<SubmitAnswerResponse> {
  return invokeEdgeFunction("submit-seance-answer", {
    exercise_id: input.exerciseId,
    session_code: input.sessionCode,
    answers: input.answers,
  });
}

/**
 * Marque la correction d'une tentative comme vue. Écriture directe (pas une
 * edge function) : autorisée par RLS (learner_own_attempts, propriétaire
 * uniquement) ET par le trigger guard_exercise_attempts_learner_writes, qui
 * n'accepte ce changement que si correction_released_at est déjà posé —
 * un apprenant ne peut donc jamais "voir" une correction non libérée.
 */
export async function markCorrectionViewed(attemptId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("exercise_attempts")
    .update({ correction_viewed_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (error) throw error;
}
