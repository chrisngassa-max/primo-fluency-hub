import { supabase as _supabase } from "@/integrations/supabase/client";
import { fetchActivePlanVersion } from "@/lib/curriculum/api";

const supabase = _supabase as any;

export const CURRICULUM_EXERCISE_SOURCE = "curriculum_v2";
const NIVEAUX = ["A1", "A2", "B1", "B2"] as const;

export interface CurriculumExerciceRow {
  id: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  niveau_vise: string;
  metadata_code: string | null;
  contenu: { metadata?: Record<string, unknown>; items?: unknown[] };
}

export interface AttachedCurriculumPath {
  code: string;
  trainingSessionId: string;
  totalExercises: number;
  linkedExercises: number;
}


export function selectNiveauxForPalier(palierCible: string, includeHeterogeneous = true): string[] {
  const primary = NIVEAUX.includes(palierCible as (typeof NIVEAUX)[number]) ? palierCible : "A2";
  if (!includeHeterogeneous) return [primary];
  return [...NIVEAUX];
}

export function orderExercicesForPilot(
  exercices: CurriculumExerciceRow[],
  palierCible: string,
): CurriculumExerciceRow[] {
  const niveauRank = Object.fromEntries(NIVEAUX.map((n, i) => [n, i]));
  const primary = NIVEAUX.includes(palierCible as (typeof NIVEAUX)[number]) ? palierCible : "A2";

  return [...exercices].sort((a, b) => {
    const aMeta = a.contenu?.metadata ?? {};
    const bMeta = b.contenu?.metadata ?? {};
    const aVariant = aMeta.niveau ? 0 : 1;
    const bVariant = bMeta.niveau ? 0 : 1;
    if (aVariant !== bVariant) return aVariant - bVariant;

    const aPri = a.niveau_vise === primary ? 0 : 1;
    const bPri = b.niveau_vise === primary ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;

    if (a.niveau_vise === b.niveau_vise) {
      const aStep = Number((aMeta.learning_path as Record<string, unknown> | undefined)?.step_order ?? 0);
      const bStep = Number((bMeta.learning_path as Record<string, unknown> | undefined)?.step_order ?? 0);
      if (aStep !== bStep) return aStep - bStep;
    }

    return (niveauRank[a.niveau_vise as keyof typeof niveauRank] ?? 99)
      - (niveauRank[b.niveau_vise as keyof typeof niveauRank] ?? 99);
  });
}

/** Charge les exercices banque issus du pont curriculum pour une seance plan. */
export async function fetchCurriculumExercicesForTrainingSession(
  trainingSessionId: string,
  sessionCode?: string | null,
): Promise<CurriculumExerciceRow[]> {
  let query = supabase
    .from("exercices")
    .select("id, titre, consigne, competence, format, niveau_vise, metadata_code, contenu")
    .eq("source", CURRICULUM_EXERCISE_SOURCE)
    .eq("is_template", false)
    .is("eleve_id", null);

  if (sessionCode) {
    query = query.like("metadata_code", `cv2:${sessionCode}:%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as CurriculumExerciceRow[];
  return rows.filter((row) => {
    const meta = row.contenu?.metadata ?? {};
    return meta.training_session_id === trainingSessionId;
  });
}

export function pickCurriculumExercicesForPilot(
  rows: CurriculumExerciceRow[],
  palierCible?: string | null,
  includeHeterogeneous = true,
): CurriculumExerciceRow[] {
  const allowedNiveaux = new Set(selectNiveauxForPalier(palierCible ?? "A2", includeHeterogeneous));

  const variants = rows.filter((row) => {
    const niveau = row.contenu?.metadata?.niveau as string | undefined;
    return niveau && allowedNiveaux.has(niveau);
  });

  const civic = rows.filter((row) => String(row.metadata_code ?? "").includes(":civic:"));
  return orderExercicesForPilot([...variants, ...civic], palierCible ?? "A2");
}

export async function linkCurriculumExercicesToSession(
  sessionId: string,
  exerciceIds: string[],
): Promise<number> {
  if (exerciceIds.length === 0) return 0;

  const { data: existing, error: existingError } = await supabase
    .from("session_exercices")
    .select("exercice_id, ordre")
    .eq("session_id", sessionId)
    .in("exercice_id", exerciceIds);
  if (existingError) throw existingError;

  const existingIds = new Set((existing ?? []).map((row: { exercice_id: string }) => row.exercice_id));
  const missingIds = exerciceIds.filter((exerciceId) => !existingIds.has(exerciceId));
  if (missingIds.length === 0) return 0;

  const { data: currentOrderRows, error: orderError } = await supabase
    .from("session_exercices")
    .select("ordre")
    .eq("session_id", sessionId)
    .order("ordre", { ascending: false })
    .limit(1);
  if (orderError) throw orderError;

  const startOrder = Number(currentOrderRows?.[0]?.ordre ?? 0);
  const links = missingIds.map((exerciceId, index) => ({
    session_id: sessionId,
    exercice_id: exerciceId,
    ordre: startOrder + index + 1,
    statut: "planifie" as const,
  }));
  const { error } = await supabase.from("session_exercices").insert(links);
  if (error) throw error;
  return links.length;
}

export async function attachCurriculumPathToSession(params: {
  sessionId: string;
  sessionCode: string;
  palierCible?: string | null;
}): Promise<AttachedCurriculumPath> {
  const plan = await fetchActivePlanVersion();
  if (!plan) throw new Error("Aucun plan de formation actif n'est disponible.");

  const { data: trainingSession, error: trainingSessionError } = await supabase
    .from("training_sessions")
    .select("id, code, palier")
    .eq("plan_version_id", plan.id)
    .eq("code", params.sessionCode)
    .maybeSingle();
  if (trainingSessionError) throw trainingSessionError;
  if (!trainingSession) throw new Error(`La séance ${params.sessionCode} est absente du plan actif.`);

  const effectivePalier = ["A2", "B1", "B2"].includes(params.palierCible ?? "")
    ? params.palierCible!
    : trainingSession.palier;
  const rows = await fetchCurriculumExercicesForTrainingSession(
    trainingSession.id,
    trainingSession.code,
  );
  const selected = pickCurriculumExercicesForPilot(rows, effectivePalier, true);
  if (selected.length === 0) {
    throw new Error(`Aucune activité publiée n'est disponible pour ${trainingSession.code}.`);
  }

  const linkedExercises = await linkCurriculumExercicesToSession(
    params.sessionId,
    selected.map((exercise) => exercise.id),
  );
  const { error: sessionError } = await supabase
    .from("sessions")
    .update({
      training_session_id: trainingSession.id,
      curriculum_palier_cible: effectivePalier,
    })
    .eq("id", params.sessionId);
  if (sessionError) throw sessionError;

  return {
    code: trainingSession.code,
    trainingSessionId: trainingSession.id,
    totalExercises: selected.length,
    linkedExercises,
  };
}
