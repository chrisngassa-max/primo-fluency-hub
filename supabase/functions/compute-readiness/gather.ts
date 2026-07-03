/**
 * Agrège les données élève pour le moteur IPE (edge function compute-readiness).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildMaitriseStats,
  computeCompetenceIPE,
  computeGlobalIPE,
  getNiveauRequisScale,
  loadConfig,
  markNonResolvedErrors,
  type CompetenceEpreuve,
  type CompetenceIPE,
  type CompetenceIPEInput,
  type CompetenceIPEResult,
  type ErrorEventInput,
  type Objectif,
  type PreuveExamen,
  type ReadinessConfig,
} from "../_shared/readiness.ts";

const EPREUVES: CompetenceEpreuve[] = ["CO", "CE", "EE", "EO"];
const DB_COMPETENCE_MAP: Record<CompetenceIPE, string> = {
  CO: "CO",
  CE: "CE",
  EE: "EE",
  EO: "EO",
  ST: "Structures",
  GLOBAL: "GLOBAL",
};

const ERROR_EVENT_TYPES = [
  "reponse_incorrecte",
  "erreur_repetee",
] as const;

export interface ReadinessSnapshotRow {
  eleve_id: string;
  competence: CompetenceIPE;
  score: number;
  bande: string;
  confiance: string;
  composantes: Record<string, unknown>;
  algo_version: number;
  window_start: string;
  window_end: string;
}

export interface ComputeReadinessResult {
  eleve_id: string;
  objectif: Objectif;
  snapshots: ReadinessSnapshotRow[];
}

export function resolveObjectif(input: {
  parcoursNiveau?: string | null;
  typeDemarche?: string | null;
  profilObjectif?: string | null;
  groupNiveau?: string | null;
}): Objectif {
  const candidates = [
    input.parcoursNiveau,
    input.groupNiveau,
    input.profilObjectif,
  ]
    .filter(Boolean)
    .map((v) => String(v).toUpperCase());

  if (candidates.some((v) => v.includes("B1") || v.includes("B2"))) return "B1";
  if (input.typeDemarche === "naturalisation") return "B1";
  return "A2";
}

function dbCompetenceToIPE(dbComp: string): CompetenceIPE | null {
  if (dbComp === "Structures") return "ST";
  if (EPREUVES.includes(dbComp as CompetenceEpreuve)) return dbComp as CompetenceEpreuve;
  return null;
}

function daysSince(isoDate: string | null | undefined, now: Date): number | null {
  if (!isoDate) return null;
  const ms = now.getTime() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export async function computeReadinessForEleve(
  admin: SupabaseClient,
  eleveId: string,
  config: ReadinessConfig = loadConfig(),
  now = new Date(),
): Promise<ComputeReadinessResult> {
  const windowDays = config.maitrise_periode.window_days;
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const [
    profilRes,
    levelsRes,
    groupRes,
    resultatsRes,
    eventsRes,
    testRes,
    typesRes,
  ] = await Promise.all([
    admin
      .from("profils_eleves")
      .select(
        "objectif_tcf, type_demarche, dernier_score_phase2_co, dernier_score_phase2_ce",
      )
      .eq("eleve_id", eleveId)
      .maybeSingle(),
    admin
      .from("student_competency_levels")
      .select("competence, niveau_actuel")
      .eq("eleve_id", eleveId),
    admin
      .from("group_members")
      .select("group_id, groups(niveau, type_demarche, is_active)")
      .eq("eleve_id", eleveId)
      .limit(1)
      .maybeSingle(),
    admin
      .from("resultats")
      .select("score, created_at, exercice:exercices(competence, difficulte)")
      .eq("eleve_id", eleveId)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString()),
    admin
      .from("session_live_events")
      .select(
        "event_type, competence, created_at, type_erreur_id, type_erreur:types_erreur(id, gravite_base, competences)",
      )
      .eq("eleve_id", eleveId)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString()),
    admin
      .from("test_resultats_apprenants")
      .select("score_co, score_ce, score_ee, score_eo, date_test")
      .eq("apprenant_id", eleveId)
      .order("date_test", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("types_erreur").select("id, gravite_base, competences"),
  ]);

  if (profilRes.error) throw profilRes.error;
  if (levelsRes.error) throw levelsRes.error;
  if (groupRes.error) throw groupRes.error;
  if (resultatsRes.error) throw resultatsRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (testRes.error) throw testRes.error;
  if (typesRes.error) throw typesRes.error;

  const groupId = groupRes.data?.group_id ?? null;
  let parcoursRow: { niveau_cible?: string | null; type_demarche?: string | null } | null = null;
  if (groupId) {
    const parcoursRes = await admin
      .from("parcours")
      .select("niveau_cible, type_demarche")
      .eq("group_id", groupId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (parcoursRes.error) throw parcoursRes.error;
    parcoursRow = parcoursRes.data;
  }

  const group = groupRes.data?.groups as {
    niveau?: string | null;
    type_demarche?: string | null;
  } | null;

  const objectif = resolveObjectif({
    parcoursNiveau: parcoursRow?.niveau_cible ?? null,
    typeDemarche: parcoursRow?.type_demarche ?? group?.type_demarche ?? profilRes.data?.type_demarche,
    profilObjectif: profilRes.data?.objectif_tcf,
    groupNiveau: group?.niveau,
  });

  const minDifficulte = getNiveauRequisScale(objectif, config) - 1;
  const niveauByComp = new Map<string, number>();
  for (const row of levelsRes.data ?? []) {
    niveauByComp.set(row.competence, Number(row.niveau_actuel) || 0);
  }

  const resultsByComp = new Map<CompetenceIPE, Array<{ score: number; created_at: string }>>();
  for (const comp of [...EPREUVES, "ST" as CompetenceIPE]) {
    resultsByComp.set(comp, []);
  }

  let lastActivityAt: string | null = null;
  for (const row of resultatsRes.data ?? []) {
    const ex = row.exercice as { competence?: string; difficulte?: number } | null;
    if (!ex?.competence) continue;
    if ((ex.difficulte ?? 0) < minDifficulte) continue;
    const ipeComp = dbCompetenceToIPE(ex.competence);
    if (!ipeComp || ipeComp === "GLOBAL") continue;
    resultsByComp.get(ipeComp)!.push({
      score: Number(row.score) || 0,
      created_at: row.created_at,
    });
    if (!lastActivityAt || row.created_at > lastActivityAt) {
      lastActivityAt = row.created_at;
    }
  }

  const graviteByCode = new Map<string, number>();
  for (const t of typesRes.data ?? []) {
    graviteByCode.set(t.id, Number(t.gravite_base) || 2);
  }

  const interventions: Array<{ typeCode: string | null; createdAt: string }> = [];
  const rawErrors: Array<{
    typeCode: string;
    graviteBase: number;
    createdAt: string;
    competence: string | null;
  }> = [];

  for (const ev of eventsRes.data ?? []) {
    const typeRow = ev.type_erreur as { id?: string; gravite_base?: number; competences?: string[] } | null;
    const typeCode = typeRow?.id ?? ev.type_erreur_id ?? null;

    if (ev.event_type === "intervention_recue") {
      interventions.push({ typeCode, createdAt: ev.created_at });
      continue;
    }

    if (!ERROR_EVENT_TYPES.includes(ev.event_type as typeof ERROR_EVENT_TYPES[number])) {
      continue;
    }
    if (!typeCode) continue;

    rawErrors.push({
      typeCode,
      graviteBase: Number(typeRow?.gravite_base ?? graviteByCode.get(typeCode) ?? 2),
      createdAt: ev.created_at,
      competence: ev.competence,
    });
  }

  function examScoreFor(comp: CompetenceEpreuve): PreuveExamen {
    const test = testRes.data;
    const profil = profilRes.data;
    const key = comp.toLowerCase() as "co" | "ce" | "ee" | "eo";
    const fromTest = test?.[`score_${key}` as keyof typeof test] as number | null | undefined;
    const phase2Key = comp === "CO" || comp === "CE"
      ? (`dernier_score_phase2_${key}` as "dernier_score_phase2_co" | "dernier_score_phase2_ce")
      : null;
    const fromPhase2 = phase2Key ? profil?.[phase2Key] : null;
    const score = fromTest ?? fromPhase2;
    if (score == null) return { hasExam: false, scorePct: null };
    return { hasExam: true, scorePct: Number(score) };
  }

  function errorsForComp(comp: CompetenceIPE): ErrorEventInput[] {
    const dbComp = DB_COMPETENCE_MAP[comp];
    const filtered = rawErrors.filter((e) => {
      if (comp === "ST") return e.competence === "ST" || e.competence === "Structures";
      return e.competence === comp || e.competence === dbComp;
    });
    return markNonResolvedErrors(
      filtered.map((e) => ({
        typeCode: e.typeCode,
        graviteBase: e.graviteBase,
        createdAt: e.createdAt,
      })),
      interventions,
    );
  }

  const daysSinceActivity = daysSince(lastActivityAt, now);
  const competencyResults: Partial<Record<CompetenceEpreuve, CompetenceIPEResult>> = {};
  let stResult: CompetenceIPEResult | null = null;

  for (const comp of [...EPREUVES, "ST" as CompetenceIPE]) {
    const maitrise = buildMaitriseStats(resultsByComp.get(comp) ?? []);
    const input: CompetenceIPEInput = {
      competence: comp,
      objectif,
      niveauValide: niveauByComp.get(comp === "ST" ? "Structures" : comp) ??
        niveauByComp.get(comp) ?? 0,
      maitrisePeriode: maitrise,
      preuveExamen: comp === "ST" ? { hasExam: false, scorePct: null } : examScoreFor(comp as CompetenceEpreuve),
      errorEvents: errorsForComp(comp),
      daysSinceLastActivity: daysSinceActivity,
    };
    const result = computeCompetenceIPE(input, config);
    if (comp === "ST") stResult = result;
    else competencyResults[comp as CompetenceEpreuve] = result;
  }

  const globalResult = computeGlobalIPE({
    objectif,
    competencies: competencyResults as Record<CompetenceEpreuve, CompetenceIPEResult>,
    st: stResult!,
  }, config);

  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();
  const algoVersion = config.algo_version;

  const snapshots: ReadinessSnapshotRow[] = [];

  const pushSnapshot = (comp: CompetenceIPE, result: CompetenceIPEResult) => {
    snapshots.push({
      eleve_id: eleveId,
      competence: comp,
      score: result.score,
      bande: result.bande,
      confiance: result.confiance,
      composantes: result.composantes as unknown as Record<string, unknown>,
      algo_version: algoVersion,
      window_start: windowStartIso,
      window_end: windowEndIso,
    });
  };

  for (const comp of EPREUVES) pushSnapshot(comp, competencyResults[comp]!);
  pushSnapshot("ST", stResult!);
  pushSnapshot("GLOBAL", globalResult);

  return { eleve_id: eleveId, objectif, snapshots };
}

export async function listActiveEleveIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from("group_members")
    .select("eleve_id, groups!inner(is_active)")
    .eq("groups.is_active", true);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.eleve_id))];
}
