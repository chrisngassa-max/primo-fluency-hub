import { supabase as _supabase } from "@/integrations/supabase/client";
// session_activities / session_documents_learner_view /
// session_document_links_learner_view sont ajoutées par
// supabase/migrations/20260713090000_s01_integrated_session_model.sql.
// Cast en `any` en attendant la régénération des types Supabase,
// comme le reste des modules curriculum v2 (cf. documents.ts, exerciseLinks.ts).
const supabase = _supabase as any;

export interface LearnerActivity {
  id: string;
  session_code: string;
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
  document_type: string;
  title: string;
  content_html: string | null;
  content_json: unknown;
}

export interface LearnerExerciseBlock {
  kind: "exercise";
  id: string; // session_document_links.id
  exercice_id: string;
  activity_id: string | null;
  display_order: number;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: string;
  contenu: { items: Array<Record<string, unknown>>; metadata?: Record<string, unknown> };
  civic_content: boolean;
}

export type LearnerSessionBlock = LearnerSupportBlock | LearnerExerciseBlock;

const ACTIVITY_COLUMNS = "id, session_code, activity_code, title, objective, display_order, pedagogical_status";
const SUPPORT_COLUMNS = "id, session_code, document_type, title, content_html, content_json, display_order, activity_id, pedagogical_status";
const LINK_COLUMNS = "id, session_code, linked_type, linked_id, display_order, activity_id";
const EXERCISE_COLUMNS = "id, titre, consigne, competence, format, niveau_vise, contenu, civic_content";

export async function fetchSessionActivities(sessionCode: string): Promise<LearnerActivity[]> {
  const { data, error } = await supabase
    .from("session_activities")
    .select(ACTIVITY_COLUMNS)
    .eq("session_code", sessionCode)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LearnerActivity[];
}

/**
 * Contenu de séance visible par l'apprenant, jamais un PDF/DOCX : ces vues
 * n'exposent structurellement pas file_url/source_file_path (voir la
 * migration). Les supports sont filtrés au niveau (niveau_vise de
 * l'exercice le cas échéant) côté appelant si besoin.
 */
export async function fetchLearnerSessionBlocks(sessionCode: string): Promise<LearnerSessionBlock[]> {
  const [{ data: supports, error: supportsError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from("session_documents_learner_view")
      .select(SUPPORT_COLUMNS)
      .eq("session_code", sessionCode)
      .order("display_order", { ascending: true }),
    supabase
      .from("session_document_links_learner_view")
      .select(LINK_COLUMNS)
      .eq("session_code", sessionCode)
      .order("display_order", { ascending: true }),
  ]);
  if (supportsError) throw supportsError;
  if (linksError) throw linksError;

  const linkedIds: string[] = (links ?? []).map((l: { linked_id: string }) => l.linked_id);
  let exercisesById = new Map<string, Record<string, unknown>>();
  if (linkedIds.length > 0) {
    const { data: exercises, error: exercisesError } = await supabase
      .from("exercices")
      .select(EXERCISE_COLUMNS)
      .in("id", linkedIds);
    if (exercisesError) throw exercisesError;
    exercisesById = new Map((exercises ?? []).map((e: { id: string }) => [e.id, e]));
  }

  const supportBlocks: LearnerSessionBlock[] = (supports ?? []).map((doc: Record<string, unknown>) => ({
    kind: "support",
    id: doc.id as string,
    activity_id: (doc.activity_id as string | null) ?? null,
    display_order: doc.display_order as number,
    document_type: doc.document_type as string,
    title: doc.title as string,
    content_html: (doc.content_html as string | null) ?? null,
    content_json: doc.content_json,
  }));

  const exerciseBlocks: LearnerSessionBlock[] = (links ?? [])
    .map((link: Record<string, unknown>) => {
      const exercice = exercisesById.get(link.linked_id as string);
      if (!exercice) return null; // exercice pas encore publishable/published : invisible, pas d'erreur
      return {
        kind: "exercise" as const,
        id: link.id as string,
        exercice_id: exercice.id as string,
        activity_id: (link.activity_id as string | null) ?? null,
        display_order: link.display_order as number,
        titre: exercice.titre as string,
        consigne: exercice.consigne as string,
        competence: exercice.competence as string,
        format: exercice.format as string,
        niveau_vise: exercice.niveau_vise as string,
        contenu: exercice.contenu as LearnerExerciseBlock["contenu"],
        civic_content: Boolean(exercice.civic_content),
      };
    })
    .filter((block): block is LearnerExerciseBlock => block !== null);

  return [...supportBlocks, ...exerciseBlocks].sort((a, b) => a.display_order - b.display_order);
}

export interface ExerciseAttemptState {
  id: string;
  status: string;
  correction_released_at: string | null;
  correction_viewed_at: string | null;
  answers: Record<string, string> | null;
  item_results: unknown;
  score_normalized: number | null;
}

/** Dernière tentative de CET apprenant pour cet exercice (le cas échéant). */
export async function fetchOwnExerciseAttempt(exerciseId: string, learnerId: string): Promise<ExerciseAttemptState | null> {
  const { data, error } = await supabase
    .from("exercise_attempts")
    .select("id, status, correction_released_at, correction_viewed_at, answers, item_results, score_normalized")
    .eq("exercise_id", exerciseId)
    .eq("learner_id", learnerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ExerciseAttemptState | null) ?? null;
}

export async function markCorrectionViewed(attemptId: string): Promise<void> {
  const { error } = await supabase
    .from("exercise_attempts")
    .update({ correction_viewed_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (error) throw error;
}

export interface SubmitAttemptInput {
  exerciseId: string;
  learnerId: string;
  answers: Record<string, string>;
  itemResults: unknown;
  scoreNormalized: number;
}

/**
 * Écrit la tentative directement (RLS learner_own_attempts). Réutilise la
 * même table que le reste de la plateforme (exercise_attempts) — pas de
 * moteur parallèle. La correction reste invisible tant que le formateur ne
 * l'a pas libérée (trigger guard_exercise_attempts_release_columns empêche
 * l'apprenant de poser correction_released_at lui-même).
 */
export async function submitExerciseAttempt(input: SubmitAttemptInput): Promise<void> {
  const { error } = await supabase.from("exercise_attempts").insert({
    exercise_id: input.exerciseId,
    learner_id: input.learnerId,
    status: "completed",
    completed_at: new Date().toISOString(),
    answers: input.answers,
    item_results: input.itemResults,
    score_normalized: input.scoreNormalized,
    source_app: "seance_apprenant",
  });
  if (error) throw error;
}
