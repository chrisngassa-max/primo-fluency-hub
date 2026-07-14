import s01Source from "../../../content/curriculum/v2/S01-v3/exercices-interactifs.json";
import type {
  AttemptCorrectionResponse,
  LearnerActivity,
  LearnerSessionBlock,
  SubmitAnswerResponse,
} from "@/lib/curriculum/learnerSession";
// Même sanitizer (liste BLANCHE) que le vrai parcours de séance
// (get-seance-content) — jamais une seconde exclusion de clés dupliquée ici :
// c'est exactement ce type de duplication qui avait laissé fuiter le
// nouveau champ `correction` (Lot 2) via ce chemin de démo avant ce
// correctif (JSON.stringify(...).not.toContain("bonne_reponse") le prouve).
import { sanitizeItem } from "../../../supabase/functions/_shared/session-content-sanitizer.ts";

export type DemoLevel = "A1" | "A2" | "B1" | "B2";

interface RawExercise {
  metadata_code: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: DemoLevel;
  civic_content?: boolean;
  contenu: {
    items: Array<{
      question?: string;
      texte?: string;
      enonce?: string;
      consigne?: string;
      options?: string[];
      bonne_reponse?: string;
      explication?: string;
    }>;
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
  item_results: NonNullable<AttemptCorrectionResponse["item_results"]>;
}

const STORAGE_KEY = "captcf:s01-demo-attempts:v1";
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
  answers: Record<string, string>;
}): Promise<SubmitAnswerResponse> {
  const exercise = exerciseById.get(input.exerciseId);
  if (!exercise) throw new Error("Exercice de démonstration introuvable.");
  const itemResults: NonNullable<AttemptCorrectionResponse["item_results"]> = {};
  let correct = 0;
  exercise.contenu.items.forEach((item, index) => {
    const given = input.answers[String(index)] ?? "";
    const expected = item.bonne_reponse ?? "";
    const isCorrect = given.trim().toLocaleLowerCase("fr") === expected.trim().toLocaleLowerCase("fr");
    if (isCorrect) correct += 1;
    itemResults[String(index)] = {
      question: item.question ?? item.texte ?? item.enonce ?? `Question ${index + 1}`,
      reponse_donnee: given,
      bonne_reponse: expected,
      correct: isCorrect,
      explication: item.explication ?? null,
    };
  });
  const attempt: DemoAttempt = {
    attempt_id: `demo-attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exercise_id: input.exerciseId,
    status: "completed",
    released: false,
    viewed_at: null,
    score_normalized: Math.round((correct / Math.max(1, exercise.contenu.items.length)) * 100),
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
  return {
    attempt_id: attempt.attempt_id,
    status: attempt.status,
    released: true,
    score_normalized: attempt.score_normalized,
    item_results: attempt.item_results,
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
