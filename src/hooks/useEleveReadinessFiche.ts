// @ts-nocheck — schema-dependent code; types regenerate after supabase migrations apply
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  type ReadinessCompetence,
  type ReadinessConfigJson,
  type ReadinessObjectif,
  type ReadinessSnapshot,
  EPREUVES,
  latestSnapshotsByCompetence,
  isSnapshotStale,
  resolveObjectifFromParcours,
  categorizeDevoirs,
  topWeightedErrors,
  bucketSnapshotsWeekly,
  STALE_SNAPSHOT_DAYS,
} from "@/lib/readinessDisplay";

const ALL_COMPETENCES: ReadinessCompetence[] = [...EPREUVES, "ST", "GLOBAL"];
const ERROR_WINDOW_DAYS = 28;
const DEVOIRS_PERIOD_DAYS = 28;

export interface EleveReadinessFicheData {
  profile: { id: string; prenom: string; nom: string } | null;
  objectif: ReadinessObjectif;
  objectifLibelle: string;
  parcoursTitre: string | null;
  config: ReadinessConfigJson | null;
  latest: Map<ReadinessCompetence, ReadinessSnapshot>;
  previousGlobal: ReadinessSnapshot | null;
  history: ReadinessSnapshot[];
  weeklyProgression: ReturnType<typeof bucketSnapshotsWeekly>;
  devoirsCounts: ReturnType<typeof categorizeDevoirs>;
  topErrors: ReturnType<typeof topWeightedErrors>;
  isStale: boolean;
  lastComputedAt: string | null;
}

async function fetchReadinessConfig(): Promise<ReadinessConfigJson | null> {
  const { data, error } = await supabase
    .from("readiness_config" as "profiles")
    .select("config")
    .eq("active", true)
    .order("algo_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("readiness_config fetch:", error.message);
    return null;
  }
  return (data as { config?: ReadinessConfigJson } | null)?.config ?? null;
}

async function fetchEleveFiche(eleveId: string): Promise<EleveReadinessFicheData> {
  const sinceErrors = new Date(
    Date.now() - ERROR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sinceDevoirs = new Date(
    Date.now() - DEVOIRS_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  );

  const [
    profileRes,
    snapshotsRes,
    config,
    memberRes,
    devoirsRes,
    eventsRes,
    typesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("id", eleveId)
      .maybeSingle(),
    supabase
      .from("readiness_snapshots" as "profiles")
      .select("*")
      .eq("eleve_id", eleveId)
      .order("created_at", { ascending: false })
      .limit(500),
    fetchReadinessConfig(),
    supabase
      .from("group_members")
      .select("group_id, groups(nom, niveau, type_demarche)")
      .eq("eleve_id", eleveId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("devoirs")
      .select("statut, date_echeance, nb_reussites_consecutives, created_at")
      .eq("eleve_id", eleveId)
      .gte("created_at", sinceDevoirs.toISOString()),
    supabase
      .from("session_live_events")
      .select("type_erreur_id, event_type, created_at")
      .eq("eleve_id", eleveId)
      .gte("created_at", sinceErrors)
      .in("event_type", ["reponse_incorrecte", "erreur_repetee"]),
    supabase.from("types_erreur").select("id, libelle_court, gravite_base"),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (snapshotsRes.error) throw snapshotsRes.error;
  if (memberRes.error) throw memberRes.error;
  if (devoirsRes.error) throw devoirsRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (typesRes.error) throw typesRes.error;

  const snapshots = (snapshotsRes.data ?? []) as unknown as ReadinessSnapshot[];
  const latest = latestSnapshotsByCompetence(snapshots);

  const globalSnaps = snapshots.filter((s) => s.competence === "GLOBAL");
  const previousGlobal = globalSnaps[1] ?? null;

  let parcoursTitre: string | null = null;
  let parcoursNiveau: string | null = null;
  let parcoursDemarche: string | null = null;

  const groupId = memberRes.data?.group_id;
  if (groupId) {
    const { data: parcours } = await supabase
      .from("parcours")
      .select("titre, niveau_cible, type_demarche")
      .eq("group_id", groupId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (parcours) {
      parcoursTitre = parcours.titre;
      parcoursNiveau = parcours.niveau_cible;
      parcoursDemarche = parcours.type_demarche;
    }
  }

  const group = memberRes.data?.groups as {
    type_demarche?: string | null;
    niveau?: string | null;
  } | null;

  const objectif = resolveObjectifFromParcours({
    niveauCible: parcoursNiveau ?? group?.niveau,
    typeDemarche: parcoursDemarche ?? group?.type_demarche,
  });

  const objectifLibelle =
    config?.objectifs?.[objectif]?.libelle ??
    (objectif === "B1" ? "Naturalisation" : "Carte de résident");

  const typesMap = new Map(
    (typesRes.data ?? []).map((t) => [
      t.id,
      { label: t.libelle_court, gravite: t.gravite_base ?? 3 },
    ]),
  );

  const globalLatest = latest.get("GLOBAL");
  const lastComputedAt = globalLatest?.created_at ?? null;

  return {
    profile: profileRes.data,
    objectif,
    objectifLibelle,
    parcoursTitre,
    config,
    latest,
    previousGlobal,
    history: snapshots,
    weeklyProgression: bucketSnapshotsWeekly(snapshots, ALL_COMPETENCES),
    devoirsCounts: categorizeDevoirs(devoirsRes.data ?? [], sinceDevoirs),
    topErrors: topWeightedErrors(eventsRes.data ?? [], typesMap),
    isStale: isSnapshotStale(globalLatest),
    lastComputedAt,
  };
}

export function useEleveReadinessFiche(eleveId: string | undefined) {
  const queryClient = useQueryClient();
  const [recalculating, setRecalculating] = useState(false);
  const [autoRecalcAttempted, setAutoRecalcAttempted] = useState(false);

  const query = useQuery({
    queryKey: ["eleve-readiness-fiche", eleveId],
    queryFn: () => fetchEleveFiche(eleveId!),
    enabled: !!eleveId,
  });

  const recalculate = useCallback(async () => {
    if (!eleveId) return;
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-readiness", {
        body: { eleve_id: eleveId },
      });
      if (error) throw error;
      const result = (data as { results?: Array<{ error?: string }> })?.results?.[0];
      if (result?.error) throw new Error(result.error);
      toast.success("IPE recalculé avec succès");
      await queryClient.invalidateQueries({ queryKey: ["eleve-readiness-fiche", eleveId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Échec du recalcul IPE : " + msg);
    } finally {
      setRecalculating(false);
    }
  }, [eleveId, queryClient]);

  useEffect(() => {
    if (
      !eleveId ||
      autoRecalcAttempted ||
      !query.data ||
      query.isFetching ||
      recalculating
    ) {
      return;
    }
    if (query.data.isStale) {
      setAutoRecalcAttempted(true);
      void recalculate();
    }
  }, [eleveId, autoRecalcAttempted, query.data, query.isFetching, recalculating, recalculate]);

  const global = query.data?.latest.get("GLOBAL");
  const bandConfig = global && query.data?.config?.bands?.[global.bande];

  return {
    ...query,
    recalculate,
    recalculating,
    global,
    bandConfig,
    staleDays: STALE_SNAPSHOT_DAYS,
  };
}

export interface GroupeReadinessSummary {
  group: { id: string; nom: string };
  medianIpe: number | null;
  students: Array<{
    eleveId: string;
    nom: string;
    globalScore: number | null;
    bande: string | null;
    confiance: string | null;
  }>;
}

export async function fetchGroupeReadinessSummary(
  groupeId: string,
): Promise<GroupeReadinessSummary> {
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("id, nom")
    .eq("id", groupeId)
    .single();
  if (groupErr) throw groupErr;

  const { data: members, error: memErr } = await supabase
    .from("group_members")
    .select("eleve_id, profiles:profiles!group_members_eleve_id_fkey(id, prenom, nom)")
    .eq("group_id", groupeId);
  if (memErr) throw memErr;

  const eleveIds = (members ?? []).map((m) => m.eleve_id);
  if (!eleveIds.length) {
    return { group, medianIpe: null, students: [] };
  }

  const { data: snapshots, error: snapErr } = await supabase
    .from("readiness_snapshots" as "profiles")
    .select("*")
    .in("eleve_id", eleveIds)
    .eq("competence", "GLOBAL")
    .order("created_at", { ascending: false });
  if (snapErr) throw snapErr;

  const latestByEleve = new Map<string, ReadinessSnapshot>();
  for (const row of (snapshots ?? []) as unknown as ReadinessSnapshot[]) {
    if (!latestByEleve.has(row.eleve_id)) {
      latestByEleve.set(row.eleve_id, row);
    }
  }

  const students = (members ?? []).map((m) => {
    const prof = m.profiles as { prenom?: string; nom?: string } | null;
    const snap = latestByEleve.get(m.eleve_id);
    return {
      eleveId: m.eleve_id,
      nom: `${prof?.prenom ?? ""} ${prof?.nom ?? ""}`.trim() || "Élève",
      globalScore: snap ? Number(snap.score) : null,
      bande: snap?.bande ?? null,
      confiance: snap?.confiance ?? null,
    };
  });

  students.sort((a, b) => (b.globalScore ?? -1) - (a.globalScore ?? -1));

  const scores = students
    .map((s) => s.globalScore)
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b);

  let medianIpe: number | null = null;
  if (scores.length) {
    const mid = Math.floor(scores.length / 2);
    medianIpe =
      scores.length % 2 === 0
        ? Math.round(((scores[mid - 1] + scores[mid]) / 2) * 10) / 10
        : scores[mid];
  }

  return { group, medianIpe, students };
}

export function useGroupeReadinessFiche(groupeId: string | undefined) {
  return useQuery({
    queryKey: ["groupe-readiness-fiche", groupeId],
    queryFn: () => fetchGroupeReadinessSummary(groupeId!),
    enabled: !!groupeId,
  });
}
