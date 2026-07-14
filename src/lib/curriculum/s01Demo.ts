import s01Source from "../../../content/curriculum/v2/S01-v3/exercices-interactifs.json";
import type {
  AttemptCorrectionResponse,
  LearnerActivity,
  LearnerAnswerValue,
  LearnerSessionBlock,
  SubmitAnswerResponse,
} from "@/lib/curriculum/learnerSession";
// Mêmes modules partagés que le vrai parcours de séance — Lot 2.1, point 4 :
// aucune logique parallèle recréée ici.
//   - sanitizeItem            : liste blanche (get-seance-content).
//   - findMissingRequiredJustifications : garde-fou justification obligatoire
//     (submit-seance-answer), reproduit ici en défense en profondeur locale
//     puisqu'il n'y a pas de second serveur à appeler.
//   - corrigerExerciceServer  : LE moteur de correction (réponse fermée +
//     évaluation de la justification + consommation de item.correction).
//     supabaseUrl volontairement `https://demo.invalid` (RFC 2606, jamais
//     résolvable) : les formats évalués par IA échouent proprement sur le
//     fallback déjà existant ("IA indisponible") au lieu d'un appel réseau
//     réel — cohérent avec "Simulation locale : aucune donnée envoyée à
//     Supabase."
//   - filterReleasedItemResults : même liste blanche dédiée post-libération.
import { sanitizeItem } from "../../../supabase/functions/_shared/session-content-sanitizer.ts";
import { findMissingRequiredJustifications } from "../../../supabase/functions/_shared/justification-guard.ts";
import { corrigerExerciceServer } from "../../../supabase/functions/_shared/correction-server.ts";
import { filterReleasedItemResults } from "../../../supabase/functions/_shared/released-correction-filter.ts";

export type DemoLevel = "A1" | "A2" | "B1" | "B2";

interface RawExerciseItem {
  question?: string;
  texte?: string;
  enonce?: string;
  consigne?: string;
  options?: string[];
  bonne_reponse?: string;
  explication?: string;
  indice?: string;
  banque_mots?: string[];
  justification_prompt?: string;
  justification_required?: boolean;
  justification_type?: string;
  correction?: unknown;
  [key: string]: unknown;
}

interface RawExercise {
  metadata_code: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: DemoLevel;
  civic_content?: boolean;
  contenu: {
    items: RawExerciseItem[];
    metadata?: { activity_code?: string };
  };
}

interface DemoAttempt {
  attempt_id: string;
  exercise_id: string;
  status: "completed";
  released: boolean;
  viewed_at: string | null;
  score_normalized: number;
  score_provisional: boolean;
  // Stockage COMPLET (miroir de exercise_attempts.item_results) : filtré
  // uniquement à la LECTURE (fetchS01DemoCorrection), jamais à l'écriture —
  // même contrat que submit-seance-answer / get-attempt-correction.
  item_results: Record<string, unknown>;
}

const STORAGE_KEY = "captcf:s01-demo-attempts:v1";
const DEMO_SUPABASE_URL = "https://demo.invalid";
const rawExercises = (s01Source.exercises ?? []) as RawExercise[];
const exerciseById = new Map(rawExercises.map((exercise) => [exercise.metadata_code, exercise]));

const activityTitles: Record<string, string> = {
  "S01.LEXIQUE": "Lexique de la séance",
  "S01.ACCUEIL": "Comprendre le parcours",
  "S01.CO": "Compréhension orale",
  "S01.CE": "Compréhension écrite",
  "S01.STRUCTURES": "Structures de la langue",
  "S01.PRODUCTION": "Produire et prendre la parole",
  "S01.CIVIQUE": "Repères civiques",
};

function readAttempts(): DemoAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as DemoAttempt[];
  } catch {
    return [];
  }
}

function writeAttempts(attempts: DemoAttempt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
}

function activityCodeFor(exercise: RawExercise): string {
  return exercise.contenu.metadata?.activity_code ?? `S01.${exercise.competence}`;
}

export async function fetchS01DemoContent(level: DemoLevel): Promise<{
  session_id: string;
  activities: LearnerActivity[];
  blocks: LearnerSessionBlock[];
}> {
  const selected = rawExercises.filter((exercise) => exercise.niveau_vise === level);
  const codes = Array.from(new Set(selected.map(activityCodeFor)));
  const activities = codes.map((code, index) => ({
    id: `demo-activity-${code}`,
    activity_code: code,
    title: activityTitles[code] ?? code.replace("S01.", ""),
    objective: "Parcourir la séance sous forme interactive.",
    display_order: index + 1,
    pedagogical_status: "demo",
  }));
  const attempts = readAttempts();
  const blocks: LearnerSessionBlock[] = selected.map((exercise, index) => {
    const attempt = attempts.find((entry) => entry.exercise_id === exercise.metadata_code);
    return {
      kind: "exercise",
      id: exercise.metadata_code,
      activity_id: `demo-activity-${activityCodeFor(exercise)}`,
      display_order: index + 1,
      titre: exercise.titre,
      consigne: exercise.consigne,
      competence: exercise.competence,
      format: exercise.format,
      niveau_vise: exercise.niveau_vise,
      civic_content: Boolean(exercise.civic_content),
      is_bonus: false,
      items: exercise.contenu.items.map((item) => sanitizeItem(item)),
      my_attempt: attempt
        ? { attempt_id: attempt.attempt_id, status: attempt.status, correction_released: attempt.released }
        : null,
    };
  });
  return { session_id: `demo-s01-${level}`, activities, blocks };
}

export async function submitS01DemoAnswer(input: {
  exerciseId: string;
  answers: Record<string, LearnerAnswerValue>;
}): Promise<SubmitAnswerResponse> {
  const exercise = exerciseById.get(input.exerciseId);
  if (!exercise) throw new Error("Exercice de démonstration introuvable.");

  // Même défense en profondeur que submit-seance-answer/index.ts : rejette
  // AVANT tout enregistrement si une justification requise manque. Rien
  // n'est perdu côté appelant (aucun state local modifié ici).
  const missing = findMissingRequiredJustifications(exercise.contenu.items, input.answers);
  if (missing.length > 0) {
    throw new Error("Justification requise manquante pour au moins une réponse.");
  }

  const result = await corrigerExerciceServer({
    format: exercise.format,
    competence: exercise.competence,
    items: exercise.contenu.items,
    answers: input.answers,
    supabaseUrl: DEMO_SUPABASE_URL,
    serviceRoleKey: "demo-local-only",
  });

  const itemResults = Object.fromEntries(
    result.correction.map((c, idx) => [
      String(idx),
      {
        question: c.question,
        reponse_donnee: c.reponse_eleve,
        bonne_reponse: c.bonne_reponse,
        correct: c.correct,
        explication: c.explication ?? null,
        learner_justification: c.learner_justification ?? null,
        hint_used: c.hint_used ?? false,
        answer_correct: c.answer_correct,
        justification_status: c.justification_status,
        justification_score: c.justification_score,
        justification_feedback: c.justification_feedback,
        overall_status: c.overall_status,
        score_provisional: c.score_provisional,
        preuve_support: c.preuve_support ?? null,
        explication_distracteurs: c.explication_distracteurs ?? [],
        erreur_diagnostiquee: c.erreur_diagnostiquee ?? null,
        remediation: c.remediation ?? null,
        justification_ouverte: c.justification_ouverte ?? null,
      },
    ]),
  );

  const attempt: DemoAttempt = {
    attempt_id: `demo-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exercise_id: input.exerciseId,
    status: "completed",
    released: false,
    viewed_at: null,
    score_normalized: result.score,
    score_provisional: result.score_provisional,
    item_results: itemResults,
  };
  writeAttempts([...readAttempts().filter((entry) => entry.exercise_id !== input.exerciseId), attempt]);
  return {
    attempt_id: attempt.attempt_id,
    status: attempt.status,
    progress: { total_items: exercise.contenu.items.length, answered: Object.keys(input.answers).length },
  };
}

export async function fetchS01DemoCorrection(attemptId: string): Promise<AttemptCorrectionResponse> {
  const attempt = readAttempts().find((entry) => entry.attempt_id === attemptId);
  if (!attempt) return { status: "not_started", released: false };
  if (!attempt.released) return { attempt_id: attempt.attempt_id, status: attempt.status, released: false };
  // Même liste blanche dédiée que get-attempt-correction : item.correction
  // et tout champ hors liste blanche ne quittent jamais cette fonction,
  // même en démonstration.
  return {
    attempt_id: attempt.attempt_id,
    status: attempt.status,
    released: true,
    score_normalized: attempt.score_normalized,
    item_results: filterReleasedItemResults(attempt.item_results as never) as AttemptCorrectionResponse["item_results"],
    correction_viewed_at: attempt.viewed_at,
  };
}

export function releaseS01DemoCorrection(attemptId: string) {
  writeAttempts(readAttempts().map((attempt) => attempt.attempt_id === attemptId ? { ...attempt, released: true } : attempt));
}

export function markS01DemoCorrectionViewed(attemptId: string) {
  writeAttempts(readAttempts().map((attempt) => attempt.attempt_id === attemptId ? { ...attempt, viewed_at: new Date().toISOString() } : attempt));
}

export function resetS01Demo() {
  localStorage.removeItem(STORAGE_KEY);
}
