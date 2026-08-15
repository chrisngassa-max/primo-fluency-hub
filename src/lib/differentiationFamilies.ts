import { supabase as _supabase } from "@/integrations/supabase/client";

/**
 * Typage applicatif de `differentiation_families`.
 *
 * Convention repo : `src/integrations/supabase/types.ts` est généré via
 * `node scripts/generate-types.mjs` (local) — la génération `--linked` depuis
 * le projet prod `gudcenhmzlcvhgbgklzw` est interdite par le script.
 * Tant que la migration `target_level` n'est pas appliquée localement puis
 * régénérée, la table n'apparaît pas (ou sans `target_level`) dans Database.
 * Ce module porte donc le typage métier explicite de `target_level`.
 */
const supabase = _supabase as any;

export type SliceLevel = "A1" | "A2" | "B1" | "B2";
export const SLICE_LEVELS: SliceLevel[] = ["A1", "A2", "B1", "B2"];

export type DifferentiationFamily = {
  id: string;
  family_id: string;
  target_level?: SliceLevel | null;
  generation_status: "queued" | "generating" | "generated" | "failed";
  validation_status: "pending" | "passed" | "passed_with_warnings" | "failed";
  review_status: "draft" | "in_review" | "validated" | "rejected" | "published" | "archived";
  validation_report: {
    status?: string;
    blocking?: Array<{ code?: string; message?: string }>;
    warnings?: Array<{ code?: string; message?: string }>;
    requires_human_review?: string[];
  };
  payload: any;
  published_exercise_id: string | null;
  generation_error: { message?: string; code?: string; support_compatibility?: any } | null;
};

export type DifferentiationFamilyFeedback = {
  id: string;
  target_type: string;
  target_id: string | null;
  issue_type: string;
  comment: string;
  created_by: string | null;
  created_at: string;
};

export type LevelGenerationResult =
  | { level: SliceLevel; ok: true; cached?: boolean; family_id: string; payload?: any; support_compatibility?: any }
  | { level: SliceLevel; ok: false; error: string; message?: string; support_compatibility?: any; family_id?: string };

function resolveFamilyLevel(family: DifferentiationFamily): SliceLevel {
  const fromColumn = family.target_level;
  if (fromColumn && SLICE_LEVELS.includes(fromColumn)) return fromColumn;
  const fromPayload = family.payload?.generated_levels?.[0] ?? family.payload?.generation?.target_level;
  if (fromPayload && SLICE_LEVELS.includes(fromPayload)) return fromPayload;
  if (family.payload?.variants?.A1) return "A1";
  if (family.payload?.variants?.B1) return "B1";
  if (family.payload?.variants?.B2) return "B2";
  return "A2";
}

export function getFamilyTargetLevel(family: DifferentiationFamily): SliceLevel {
  return resolveFamilyLevel(family);
}

export function getFamilyVariant(family: DifferentiationFamily) {
  const level = getFamilyTargetLevel(family);
  return family.payload?.variants?.[level] ?? family.payload?.variants?.A2 ?? null;
}

export async function fetchDifferentiationFamiliesForSource(sourceId: string): Promise<DifferentiationFamily[]> {
  const { data, error } = await supabase
    .from("differentiation_families")
    .select("id, family_id, target_level, generation_status, validation_status, review_status, validation_report, payload, published_exercise_id, generation_error")
    .eq("source_id", sourceId)
    .neq("review_status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DifferentiationFamily[];
}

/** @deprecated Prefer fetchDifferentiationFamiliesForSource. */
export async function fetchLatestDifferentiationFamily(sourceId: string): Promise<DifferentiationFamily | null> {
  const families = await fetchDifferentiationFamiliesForSource(sourceId);
  return families[0] ?? null;
}

export function pickLatestFamilyPerLevel(families: DifferentiationFamily[]): Partial<Record<SliceLevel, DifferentiationFamily>> {
  const result: Partial<Record<SliceLevel, DifferentiationFamily>> = {};
  for (const family of families) {
    const level = getFamilyTargetLevel(family);
    if (!result[level]) result[level] = family;
  }
  return result;
}

export async function fetchDifferentiationFamilyFeedback(familyId: string): Promise<DifferentiationFamilyFeedback[]> {
  const { data, error } = await supabase
    .from("differentiation_family_feedback")
    .select("id, target_type, target_id, issue_type, comment, created_by, created_at")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DifferentiationFamilyFeedback[];
}

export async function generateDifferentiationFamily(
  sourceId: string,
  options: { forceRegenerate?: boolean; targetLevel?: SliceLevel } = {},
) {
  const { forceRegenerate = false, targetLevel = "A2" } = options;
  const { data, error } = await supabase.functions.invoke("generate-differentiation-family", {
    body: { sourceId, force_regenerate: forceRegenerate, target_level: targetLevel },
  });
  if (error) throw error;
  if (data?.error) {
    const err = new Error(data.message || data.error) as Error & {
      code?: string;
      support_compatibility?: unknown;
      family_id?: string;
      target_level?: string;
    };
    err.code = data.error;
    err.support_compatibility = data.support_compatibility;
    err.family_id = data.family_id;
    err.target_level = data.target_level ?? targetLevel;
    throw err;
  }
  return data;
}

/**
 * Orchestration front bornée : une génération par niveau, séquentielle
 * (concurrence 1) pour éviter 4 appels non contrôlés.
 */
export async function generateDifferentiationFamiliesForLevels(
  sourceId: string,
  levels: SliceLevel[],
  options: { forceRegenerate?: boolean; concurrency?: number } = {},
): Promise<LevelGenerationResult[]> {
  const uniqueLevels = Array.from(new Set(levels));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 1, 2));
  const results: LevelGenerationResult[] = [];
  let index = 0;

  async function worker() {
    while (index < uniqueLevels.length) {
      const current = uniqueLevels[index];
      index += 1;
      try {
        const data = await generateDifferentiationFamily(sourceId, {
          forceRegenerate: options.forceRegenerate,
          targetLevel: current,
        });
        results.push({
          level: current,
          ok: true,
          cached: Boolean(data?.cached),
          family_id: data.family_id,
          payload: data.payload,
          support_compatibility: data.support_compatibility,
        });
      } catch (error: any) {
        results.push({
          level: current,
          ok: false,
          error: error?.code || error?.message || "FAMILY_GENERATION_FAILED",
          message: error?.message,
          support_compatibility: error?.support_compatibility,
          family_id: error?.family_id,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueLevels.length) }, () => worker()));
  return uniqueLevels.map((level) => results.find((entry) => entry.level === level)!);
}

export async function updateDifferentiationFamilyReview(
  familyId: string,
  reviewStatus: "in_review" | "validated" | "rejected",
) {
  const { error } = await supabase
    .from("differentiation_families")
    .update({ review_status: reviewStatus })
    .eq("id", familyId);
  if (error) throw error;
}

export async function addDifferentiationFamilyFeedback(
  familyId: string,
  userId: string,
  comment: string,
  targetType = "family",
  targetId?: string,
) {
  const { error } = await supabase.from("differentiation_family_feedback").insert({
    family_id: familyId,
    target_type: targetType,
    target_id: targetId,
    issue_type: "other",
    comment: comment.trim(),
    created_by: userId,
  });
  if (error) throw error;
}

export async function publishDifferentiationFamily(familyId: string) {
  const { data, error } = await supabase.functions.invoke("publish-differentiation-family", { body: { familyId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { exercise_id: string; target_level?: SliceLevel; niveau_vise?: SliceLevel };
}
