import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPedagogicalDirectives,
  type PedagogicalDirectives,
} from "./pedagogical-directives.ts";

export type ProgressionMode = "demarrage" | "consolide" | "augmente" | "remediation";

export interface WeakCompetence {
  c: string;
  avg: number;
}

export interface StudentProgressionProfile {
  eleve_id: string;
  progression: ProgressionMode;
  averageLast5: number | null;
  weakCompetences: WeakCompetence[];
  profile: any | null;
  outcome: any | null;
  directives: PedagogicalDirectives;
}

function normalizeCompetence(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (raw === "co" || raw.includes("comprehension orale")) return "co";
  if (raw === "ce" || raw.includes("comprehension ecrite") || raw.includes("lecture")) return "ce";
  if (raw === "ee" || raw.includes("expression ecrite") || raw.includes("production ecrite")) return "ee";
  if (raw === "eo" || raw.includes("expression orale") || raw.includes("production orale")) return "eo";
  if (raw.includes("structure") || raw.includes("grammaire") || raw.includes("syntaxe")) return "structures";
  return raw;
}

function filterResultsByCompetence(results: any[], targetCompetence?: string | null): any[] {
  const target = normalizeCompetence(targetCompetence);
  if (!target) return results ?? [];
  return (results ?? []).filter((row: any) => normalizeCompetence(row?.exercice?.competence) === target);
}

export function deriveProgressionFromResults(results: any[], targetCompetence?: string | null): {
  progression: ProgressionMode;
  averageLast5: number | null;
} {
  const scopedResults = filterResultsByCompetence(results, targetCompetence);
  const last5 = scopedResults.slice(0, 5);
  const averageLast5 = last5.length
    ? Math.round(last5.reduce((sum: number, row: any) => sum + (row.score ?? 0), 0) / last5.length)
    : null;

  if (scopedResults.length === 0) return { progression: "demarrage", averageLast5 };
  if (averageLast5 !== null && averageLast5 >= 80) return { progression: "augmente", averageLast5 };
  if (averageLast5 !== null && averageLast5 >= 60) return { progression: "consolide", averageLast5 };
  return { progression: "remediation", averageLast5 };
}

/**
 * Variante avec historique : empêche les oscillations rapides entre
 * remediation et consolide en exigeant N résultats consécutifs ≥ seuilSortie
 * pour quitter le mode remediation.
 */
export function deriveProgressionWithHistory(
  results: any[],
  targetCompetence?: string | null,
  options: { seuilSortie?: number; nConsecutifs?: number } = {},
): { progression: ProgressionMode; averageLast5: number | null; consecutive_successes: number } {
  const seuilSortie = options.seuilSortie ?? 62;
  const nConsecutifs = options.nConsecutifs ?? 3;

  const base = deriveProgressionFromResults(results, targetCompetence);

  if (base.progression !== "remediation") {
    return { ...base, consecutive_successes: 0 };
  }

  const scoped = filterResultsByCompetence(results, targetCompetence);
  let consecutive = 0;
  for (const r of scoped) {
    if ((r.score ?? 0) >= seuilSortie) consecutive++;
    else break;
  }

  if (consecutive >= nConsecutifs) {
    return {
      progression: "consolide",
      averageLast5: base.averageLast5,
      consecutive_successes: consecutive,
    };
  }

  return { ...base, consecutive_successes: consecutive };
}

export function computeWeakCompetencesFromResults(results: any[], max = 3): WeakCompetence[] {
  const compStats: Record<string, { sum: number; n: number }> = {};
  for (const result of results ?? []) {
    const competence = result?.exercice?.competence;
    if (!competence) continue;
    if (!compStats[competence]) compStats[competence] = { sum: 0, n: 0 };
    compStats[competence].sum += result.score ?? 0;
    compStats[competence].n++;
  }

  return Object.entries(compStats)
    .map(([c, stats]) => ({ c, avg: stats.n ? Math.round(stats.sum / stats.n) : 0 }))
    .filter((item) => item.avg < 70)
    .sort((a, b) => a.avg - b.avg)
    .slice(0, max);
}

export async function computeProgressionForEleves(
  supabase: SupabaseClient,
  eleveIds: string[],
  options: { sessionId?: string | null; targetCompetence?: string | null } = {},
): Promise<Record<string, StudentProgressionProfile>> {
  const uniqueIds = Array.from(new Set((eleveIds ?? []).filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const [{ data: profils }, { data: levels }, { data: results }, outcomesRes] = await Promise.all([
    supabase
      .from("profils_eleves")
      .select("eleve_id, niveau_actuel, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures, priorites_pedagogiques, vitesse_lecture")
      .in("eleve_id", uniqueIds),
    supabase
      .from("student_competency_levels")
      .select("eleve_id, competence, niveau_actuel")
      .in("eleve_id", uniqueIds),
    supabase
      .from("resultats")
      .select("eleve_id, exercice_id, score, created_at, exercice:exercices(competence, format, titre, sous_competence)")
      .in("eleve_id", uniqueIds)
      .order("created_at", { ascending: false })
      .limit(uniqueIds.length * 15),
    options.sessionId
      ? supabase
          .from("session_student_outcomes")
          .select("eleve_id, objectif_status, besoin_pedagogique")
          .eq("session_id", options.sessionId)
          .in("eleve_id", uniqueIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map<string, any>();
  (profils ?? []).forEach((profile: any) => profileById.set(profile.eleve_id, profile));

  const outcomeById = new Map<string, any>();
  ((outcomesRes as any).data ?? []).forEach((outcome: any) => outcomeById.set(outcome.eleve_id, outcome));

  const levelByEleve: Record<string, Record<string, number>> = {};
  (levels ?? []).forEach((level: any) => {
    if (!levelByEleve[level.eleve_id]) levelByEleve[level.eleve_id] = {};
    levelByEleve[level.eleve_id][level.competence] = level.niveau_actuel;
  });

  const output: Record<string, StudentProgressionProfile> = {};
  for (const eleveId of uniqueIds) {
    const myResults = (results ?? []).filter((row: any) => row.eleve_id === eleveId);
    const weakCompetences = computeWeakCompetencesFromResults(myResults);
    const targetCompetence =
      options.targetCompetence ??
      weakCompetences[0]?.c ??
      Object.entries(levelByEleve[eleveId] ?? {}).sort((a, b) => a[1] - b[1])[0]?.[0] ??
      null;
    const result = deriveProgressionWithHistory(myResults, targetCompetence);
    const { progression, averageLast5 } = result;

    const profile = profileById.get(eleveId) ?? null;
    const outcome = outcomeById.get(eleveId) ?? null;
    const directives = buildPedagogicalDirectives({
      profile,
      outcome,
      progression,
      weakCompetences: weakCompetences.map((item) => item.c),
      targetCompetence,
    });

    output[eleveId] = {
      eleve_id: eleveId,
      progression,
      averageLast5,
      weakCompetences,
      profile,
      outcome,
      directives,
    };
  }

  return output;
}
