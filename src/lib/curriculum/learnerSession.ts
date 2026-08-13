import { supabase } from "@/integrations/supabase/client";
import type { LearnerAnswerValue } from "@/lib/curriculum/justificationAnswer";

export type { LearnerAnswerValue } from "@/lib/curriculum/justificationAnswer";

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
}

/** Item nettoyé : jamais de bonne_reponse/explication/barème (voir edge function). */
export interface SanitizedItem {
  question?: string;
  texte?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
}

/** État de la tentative de CET apprenant pour cet exercice, DANS CETTE
 * séance précise uniquement (jamais "la dernière tentative tous groupes
 * confondus" — voir get-seance-content, 4e relecture point 1). */
export interface WorkedExample {
  level: string;
  format: string;
  instruction: string;
  question: string;
  highlighted_text?: string;
  options?: string[];
  response: string;
  completed_response?: string;
  explanation_steps: string[];
}

export interface MyAttemptSummary {
  attempt_id: string;
  status: string;
  correction_released: boolean;
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
  is_bonus: boolean;
  items: SanitizedItem[];
  worked_example?: WorkedExample;
  /** Vrai si un audio original résolvable existe (CO publié depuis une source
   *  pédagogique audio). Le frontend résout l'URL signée au moment de la
   *  lecture via resolve-exercise-audio. La transcription complète n'est pas
   *  transmise en séance (évite la fuite des réponses). */
  has_original_audio?: boolean;
  my_attempt: MyAttemptSummary | null;
}

export type LearnerSessionBlock = LearnerSupportBlock | LearnerExerciseBlock;

async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function fetchSeanceContent(sessionCode: string): Promise<{
  session_id: string;
  activities: LearnerActivity[];
  blocks: LearnerSessionBlock[];
}> {
  return invokeEdgeFunction("get-seance-content", { session_code: sessionCode });
}

export interface AttemptItemResult {
  question: string;
  reponse_donnee: string;
  bonne_reponse: string;
  correct: boolean;
  explication: string | null;
  learner_justification?: string | null;
  // Lot 2.1, points 2/5/6 — modèle de résultat étendu, filtré par une liste
  // blanche dédiée côté serveur (released-correction-filter.ts) : présent
  // uniquement après libération.
  hint_used?: boolean;
  answer_correct?: boolean;
  justification_status?: "not_required" | "missing" | "unrelated" | "restates_answer_without_evidence" | "accepted" | "pending_review";
  justification_score?: number | null;
  justification_feedback?: string;
  overall_status?: "incorrect" | "partial" | "provisional" | "complete";
  score_provisional?: boolean;
  preuve_support?: string | null;
  explication_distracteurs?: string[];
  erreur_diagnostiquee?: string | null;
  remediation?: string | null;
  justification_ouverte?: { elements_attendus: string[]; criteres_evaluation: string[] } | null;
}

export interface AttemptCorrectionResponse {
  attempt_id?: string;
  status: string;
  released: boolean;
  score_normalized?: number;
  item_results?: Record<string, AttemptItemResult>;
  correction_viewed_at?: string | null;
}

/** Reçoit attempt_id (pas exercise_id) — voir edge function get-attempt-correction. */
export async function fetchAttemptCorrection(attemptId: string): Promise<AttemptCorrectionResponse> {
  return invokeEdgeFunction("get-attempt-correction", { attempt_id: attemptId });
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
  answers: Record<string, LearnerAnswerValue>;
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
