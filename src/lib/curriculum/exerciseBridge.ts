import { supabase as _supabase } from "@/integrations/supabase/client";

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

  const links = exerciceIds.map((exerciceId, index) => ({
    session_id: sessionId,
    exercice_id: exerciceId,
    ordre: index + 1,
    statut: "planifie" as const,
  }));

  const { error } = await supabase.from("session_exercices").insert(links);
  if (error) throw error;
  return links.length;
}
