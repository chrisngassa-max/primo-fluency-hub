import { object, string, type Row } from "./store.ts";

export const HOMEWORK_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INACTIVE_DEVOIR_STATUTS = new Set(["expire", "fait", "arrete", "archive"]);

export const EMPTY_RESUME_MESSAGE = "Aucun devoir à reprendre pour le moment.";
export const AMBIGUOUS_RESUME_MESSAGE =
  "Plusieurs devoirs sont disponibles. Demande à ton formateur lequel reprendre.";

export type HomeworkRow = {
  id: unknown;
  eleve_id: unknown;
  exercice_id: unknown;
  statut: unknown;
};

export type ExerciseRow = {
  id: unknown;
  contenu?: unknown;
};

export type DecisionRow = {
  eleve_id: unknown;
  reason_student?: unknown;
  context_snapshot?: unknown;
  created_at?: unknown;
};

export type AssignedHomeworkResume =
  | { status: "empty"; message: string }
  | { status: "ambiguous"; message: string }
  | {
    status: "resume";
    devoirId: string;
    exerciseId: string;
    route: string;
    reasonStudent: string | null;
    hasStoredAudio: boolean;
    audioUrl: string | null;
  };

export function snapshotDevoirId(snapshot: unknown): string | null {
  const id = string(object(snapshot).devoir_id);
  return HOMEWORK_UUID.test(id) ? id : null;
}

export function storedInstructionAudioUrl(contenu: unknown): string | null {
  const data = object(contenu);
  const audio = object(data.audio);
  const url = string(audio.url) || string(audio.audio_url) || string(data.audio_url);
  if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) return url;
  return null;
}

export function hasStoredInstructionAudio(contenu: unknown): boolean {
  const audio = object(object(contenu).audio);
  const linked = HOMEWORK_UUID.test(string(audio.source_id))
    || /^sha256:[0-9a-f]{64}$/.test(string(audio.source_content_hash));
  return Boolean(linked && storedInstructionAudioUrl(contenu));
}

function asDevoir(row: HomeworkRow | Row): { id: string; eleve_id: string; exercice_id: string; statut: string } | null {
  const id = string(row.id);
  const eleve_id = string(row.eleve_id);
  const exercice_id = string(row.exercice_id);
  const statut = string(row.statut);
  if (!HOMEWORK_UUID.test(id) || !HOMEWORK_UUID.test(eleve_id) || !HOMEWORK_UUID.test(exercice_id)) return null;
  return { id, eleve_id, exercice_id, statut };
}

/** Même règle que le Lot 1 : décision liée via snapshot.devoir_id, jamais via devoir_genere. */
export function pickLinkedHomeworkRecommendation(params: {
  uid: string;
  currentDevoirId?: string | null;
  routes: DecisionRow[];
  devoirs: HomeworkRow[];
  exercises: ExerciseRow[];
}): { text: string; route: string; devoirId: string; exerciseId: string } | null {
  const { uid, currentDevoirId = null } = params;
  const devoirById = new Map(
    params.devoirs.map(asDevoir).filter((row): row is NonNullable<typeof row> => row !== null)
      .map((row) => [row.id, row]),
  );
  const exerciseIds = new Set(
    params.exercises.map((row) => string(row.id)).filter((id) => HOMEWORK_UUID.test(id)),
  );
  const ranked = [...params.routes].sort((a, b) => string(b.created_at).localeCompare(string(a.created_at)));
  for (const route of ranked) {
    if (string(route.eleve_id) !== uid) continue;
    const assignedId = snapshotDevoirId(route.context_snapshot);
    if (!assignedId || assignedId === currentDevoirId) continue;
    const devoir = devoirById.get(assignedId);
    if (!devoir || devoir.eleve_id !== uid || devoir.id !== assignedId) continue;
    if (devoir.statut !== "en_attente" || INACTIVE_DEVOIR_STATUTS.has(devoir.statut)) continue;
    if (!exerciseIds.has(devoir.exercice_id)) continue;
    const reason = string(route.reason_student).trim();
    if (!reason) continue;
    return { text: reason, route: `/eleve/devoirs/${assignedId}`, devoirId: assignedId, exerciseId: devoir.exercice_id };
  }
  return null;
}

export function buildAssignedHomeworkResume(params: {
  authUserId: string;
  currentDevoirId?: string | null;
  devoirs: HomeworkRow[];
  exercises: ExerciseRow[];
  decisions: DecisionRow[];
}): AssignedHomeworkResume {
  const uid = params.authUserId;
  const currentDevoirId = params.currentDevoirId ?? null;
  const exerciseById = new Map(
    params.exercises
      .map((row) => [string(row.id), row] as const)
      .filter(([id]) => HOMEWORK_UUID.test(id)),
  );
  const admissible = params.devoirs.map(asDevoir).filter((devoir): devoir is NonNullable<typeof devoir> => {
    if (!devoir) return false;
    if (devoir.eleve_id !== uid) return false;
    if (devoir.id === currentDevoirId) return false;
    if (devoir.statut !== "en_attente" || INACTIVE_DEVOIR_STATUTS.has(devoir.statut)) return false;
    return exerciseById.has(devoir.exercice_id);
  });

  const picked = pickLinkedHomeworkRecommendation({
    uid,
    currentDevoirId,
    routes: params.decisions,
    devoirs: params.devoirs,
    exercises: params.exercises,
  });
  const chosen = picked
    ? admissible.find((devoir) => devoir.id === picked.devoirId)
    : admissible.length === 1
    ? admissible[0]
    : null;

  if (chosen) {
    const exercise = exerciseById.get(chosen.exercice_id);
    const audioUrl = storedInstructionAudioUrl(exercise?.contenu);
    return {
      status: "resume",
      devoirId: chosen.id,
      exerciseId: chosen.exercice_id,
      route: `/eleve/devoirs/${chosen.id}`,
      reasonStudent: picked?.devoirId === chosen.id ? picked.text : null,
      hasStoredAudio: hasStoredInstructionAudio(exercise?.contenu),
      audioUrl,
    };
  }
  if (admissible.length > 1) {
    return { status: "ambiguous", message: AMBIGUOUS_RESUME_MESSAGE };
  }
  return { status: "empty", message: EMPTY_RESUME_MESSAGE };
}
