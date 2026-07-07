/**
 * Lot 9 — Lecture banque Supabase pour sélection pré-séance (read-only).
 * Aucune écriture, aucune génération IA.
 */
import {
  FRESHNESS_MAX_OCCURRENCES,
  FRESHNESS_WINDOW_DAYS,
} from "../../supabase/functions/_shared/exercise-search.ts";
import type {
  PreSessionCandidate,
  ValidationIssueRef,
} from "./pre-session-selection";

/** Statuts validation inclus dans le pool pré-séance (hors draft). */
export const PRE_SESSION_BANK_VALIDATION_STATUSES = [
  "validated_auto",
  "approved_human",
  "needs_review",
  "rejected",
] as const;

export const PRE_SESSION_BANK_SELECT =
  "id, titre, consigne, competence, niveau_vise, format, difficulte, contenu, contexte_irn, theme, niveau_guidage, sous_competence, metadata_code, metadata_skill, mode, objectif_tcf, is_ai_generated, source, validation_status, validation_issues, validation_score";

export interface BankExerciseRow {
  id: string;
  titre?: string | null;
  consigne?: string | null;
  competence?: string | null;
  niveau_vise?: string | null;
  format?: string | null;
  difficulte?: number | null;
  contenu?: unknown;
  contexte_irn?: string | null;
  theme?: string | null;
  niveau_guidage?: string | null;
  sous_competence?: string | null;
  metadata_code?: string | null;
  metadata_skill?: string | null;
  mode?: string | null;
  objectif_tcf?: string | null;
  is_ai_generated?: boolean | null;
  source?: string | null;
  validation_status?: string | null;
  validation_issues?: unknown;
  validation_score?: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = { from: (table: string) => any };

export function normalizeValidationIssues(raw: unknown): ValidationIssueRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      code: String(item.code ?? ""),
      severity: item.severity === "error" ? "error" : "warning",
      layer: item.layer != null ? String(item.layer) : undefined,
    }))
    .filter((issue) => issue.code.length > 0);
}

/** Mappe une ligne `exercices` vers le format attendu par `preSessionSelectExercises`. */
export function mapBankRowToPreSessionCandidate(
  row: BankExerciseRow,
  freshness?: { fresh: boolean; recent_occurrences: number },
): PreSessionCandidate {
  return {
    id: row.id,
    titre: row.titre ?? null,
    consigne: row.consigne ?? null,
    competence: row.competence ?? null,
    niveau_vise: row.niveau_vise ?? null,
    format: row.format ?? null,
    difficulte: row.difficulte ?? null,
    contenu: row.contenu,
    contexte_irn: row.contexte_irn ?? null,
    theme: row.theme ?? null,
    niveau_guidage: row.niveau_guidage ?? null,
    sous_competence: row.sous_competence ?? null,
    metadata_code: row.metadata_code ?? null,
    metadata_skill: row.metadata_skill ?? null,
    mode: row.mode ?? null,
    objectif_tcf: row.objectif_tcf ?? null,
    is_ai_generated: row.is_ai_generated ?? null,
    source: row.source ?? null,
    validation_status: row.validation_status ?? "draft",
    validation_issues: normalizeValidationIssues(row.validation_issues),
    validation_score: row.validation_score ?? null,
    fresh: freshness?.fresh ?? true,
    recent_occurrences: freshness?.recent_occurrences ?? 0,
  };
}

async function countRecentOccurrences(
  supabase: SupabaseClientLike,
  exerciceIds: string[],
  eleveIds: string[],
  windowDays: number,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (exerciceIds.length === 0) return counts;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const bump = (rows: { exercice_id?: string | null }[] | null | undefined) => {
    for (const r of rows ?? []) {
      if (!r.exercice_id) continue;
      counts.set(r.exercice_id, (counts.get(r.exercice_id) ?? 0) + 1);
    }
  };

  let devoirsQuery = supabase
    .from("devoirs")
    .select("exercice_id")
    .in("exercice_id", exerciceIds)
    .gte("created_at", since);
  if (eleveIds.length > 0) devoirsQuery = devoirsQuery.in("eleve_id", eleveIds);
  const { data: devoirs } = await devoirsQuery;
  bump(devoirs);

  let resultatsQuery = supabase
    .from("resultats")
    .select("exercice_id")
    .in("exercice_id", exerciceIds)
    .gte("created_at", since);
  if (eleveIds.length > 0) resultatsQuery = resultatsQuery.in("eleve_id", eleveIds);
  const { data: resultats } = await resultatsQuery;
  bump(resultats);

  return counts;
}

export interface FetchPreSessionBankOptions {
  eleveIds?: string[];
  freshnessWindowDays?: number;
  freshnessMaxOccurrences?: number;
  candidateLimit?: number;
}

/**
 * Charge le pool banque legacy_bank (read-only) et enrichit la fraîcheur.
 * Lève une erreur si Supabase échoue — pas de fallback silencieux.
 */
export async function fetchPreSessionBankCandidates(
  supabase: SupabaseClientLike,
  options: FetchPreSessionBankOptions = {},
): Promise<PreSessionCandidate[]> {
  const {
    eleveIds = [],
    freshnessWindowDays = FRESHNESS_WINDOW_DAYS,
    freshnessMaxOccurrences = FRESHNESS_MAX_OCCURRENCES,
    candidateLimit = 5000,
  } = options;

  const { data: rows, error } = await supabase
    .from("exercices")
    .select(PRE_SESSION_BANK_SELECT)
    .eq("is_template", false)
    .is("eleve_id", null)
    .eq("validation_profile", "legacy_bank")
    .in("validation_status", [...PRE_SESSION_BANK_VALIDATION_STATUSES])
    .limit(candidateLimit);

  if (error) {
    throw new Error(error.message);
  }

  const bankRows: BankExerciseRow[] = Array.isArray(rows) ? rows : [];
  if (bankRows.length === 0) return [];

  const exerciceIds = bankRows.map((r) => r.id);
  const occurrences = await countRecentOccurrences(
    supabase,
    exerciceIds,
    eleveIds,
    freshnessWindowDays,
  );

  return bankRows.map((row) => {
    const recent = occurrences.get(row.id) ?? 0;
    return mapBankRowToPreSessionCandidate(row, {
      recent_occurrences: recent,
      fresh: recent < freshnessMaxOccurrences,
    });
  });
}
