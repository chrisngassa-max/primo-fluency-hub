import { supabase as _supabase } from "@/integrations/supabase/client";
// Curriculum v2 tables are added via supabase/migrations/20260705220000_*.sql.
// Until Supabase types are regenerated post-deploy, cast the client to `any`
// so this module compiles against the current generated Database type.
const supabase = _supabase as any;
import { CURRICULUM_SESSIONS } from "./sessions";
import type {
  BatchStatusResponse,
  CostEstimate,
  CurriculumPublication,
  ResourceGenerationBatch,
  ResourceGenerationJob,
  SessionProgressRow,
  SessionResource,
  TrainingPlanVersion,
  TrainingSession,
  ValidationReport,
} from "./types";

const BATCH_FN = "curriculum-batch";

export async function fetchActivePlanVersion(): Promise<TrainingPlanVersion | null> {
  const { data: active } = await supabase
    .from("training_plan_versions")
    .select("id, version, statut, heures_a2, heures_b1, heures_b2")
    .eq("statut", "active")
    .maybeSingle();

  if (active) return active as TrainingPlanVersion;

  const { data: latest } = await supabase
    .from("training_plan_versions")
    .select("id, version, statut, heures_a2, heures_b1, heures_b2")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latest as TrainingPlanVersion | null) ?? null;
}

export async function fetchLatestBatch(planVersionId: string): Promise<ResourceGenerationBatch | null> {
  const { data, error } = await supabase
    .from("resource_generation_batches")
    .select("*")
    .eq("plan_version_id", planVersionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ResourceGenerationBatch | null;
}

export async function fetchBatchJobs(batchId: string): Promise<ResourceGenerationJob[]> {
  const { data, error } = await supabase
    .from("resource_generation_jobs")
    .select("*")
    .eq("batch_id", batchId)
    .order("session_code");

  if (error) throw error;
  return (data ?? []) as ResourceGenerationJob[];
}

export async function fetchTrainingSessions(planVersionId: string): Promise<TrainingSession[]> {
  const { data, error } = await supabase
    .from("training_sessions")
    .select("id, plan_version_id, code, ordre, titre, palier, statut")
    .eq("plan_version_id", planVersionId)
    .order("ordre");

  if (error) throw error;
  return (data ?? []) as TrainingSession[];
}

export async function fetchSessionResources(sessionIds: string[]): Promise<SessionResource[]> {
  if (sessionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("session_resources")
    .select(
      "id, session_id, resource_id, kind, version, chemin, mime, hash, statut, published_at, metadata, previous_resource_version_id",
    )
    .in("session_id", sessionIds);

  if (error) throw error;
  return (data ?? []) as SessionResource[];
}

export async function fetchValidationReports(resourceIds: string[]): Promise<ValidationReport[]> {
  if (resourceIds.length === 0) return [];

  const { data, error } = await supabase
    .from("validation_reports")
    .select("id, session_resource_id, validateur, modele, scores, bloquants, rapport, created_at")
    .in("session_resource_id", resourceIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ValidationReport[];
}

export async function fetchPublications(planVersionId: string): Promise<CurriculumPublication[]> {
  const { data, error } = await supabase
    .from("curriculum_publications")
    .select("id, plan_version_id, session_resource_id, version, published_at, published_by, previous_publication_id")
    .eq("plan_version_id", planVersionId)
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CurriculumPublication[];
}

function detectVersionMismatch(resources: SessionResource[]): boolean {
  const byKind = new Map<string, number>();
  for (const r of resources) {
    if (r.statut === "published" || r.statut === "publishable") {
      const key = r.kind.includes("corrige") || r.resource_id.includes("corrige")
        ? "corrige"
        : r.kind.includes("support") || r.resource_id.includes("support")
          ? "support"
          : null;
      if (key) byKind.set(key, r.version);
    }
  }
  const supportV = byKind.get("support");
  const corrigeV = byKind.get("corrige");
  return supportV != null && corrigeV != null && supportV !== corrigeV;
}

export function buildSessionProgress(
  jobs: ResourceGenerationJob[],
  dbSessions: TrainingSession[],
  resourcesBySessionCode: Map<string, SessionResource[]>,
): SessionProgressRow[] {
  const jobsBySession = new Map<string, ResourceGenerationJob[]>();
  for (const job of jobs) {
    const list = jobsBySession.get(job.session_code) ?? [];
    list.push(job);
    jobsBySession.set(job.session_code, list);
  }

  const dbByCode = new Map(dbSessions.map((s) => [s.code, s]));

  return CURRICULUM_SESSIONS.map((manifestEntry) => {
    const sessionJobs = jobsBySession.get(manifestEntry.session_code) ?? [];
    const primaryJob = sessionJobs[0] ?? null;
    const resources = resourcesBySessionCode.get(manifestEntry.session_code) ?? [];

    const generated = resources.filter((r) =>
      ["generated", "deterministic_checked", "ai_reviewed", "publishable", "published"].includes(r.statut),
    ).length;
    const validated = resources.filter((r) =>
      ["ai_reviewed", "publishable", "published"].includes(r.statut),
    ).length;
    const published = resources.filter((r) => r.statut === "published").length;
    const quarantined =
      resources.filter((r) => r.statut === "quarantined").length +
      sessionJobs.filter((j) => j.statut === "quarantined").length;

    const lastError =
      primaryJob?.erreurs?.length
        ? String(
            Array.isArray(primaryJob.erreurs)
              ? primaryJob.erreurs[primaryJob.erreurs.length - 1]
              : primaryJob.erreurs,
          )
        : null;

    return {
      session_code: manifestEntry.session_code,
      titre: dbByCode.get(manifestEntry.session_code)?.titre ?? manifestEntry.titre,
      palier: manifestEntry.palier,
      ordre: manifestEntry.ordre,
      generated,
      validated,
      published,
      quarantined,
      total_resources: resources.length || 0,
      job_statut: primaryJob?.statut ?? null,
      last_error: lastError,
      version_mismatch: detectVersionMismatch(resources),
    };
  });
}

export async function loadBatchStatus(batchId: string): Promise<BatchStatusResponse> {
  const { data: batch, error } = await supabase
    .from("resource_generation_batches")
    .select("*")
    .eq("id", batchId)
    .single();

  if (error) throw error;

  const jobs = await fetchBatchJobs(batchId);
  const dbSessions = await fetchTrainingSessions(batch.plan_version_id);
  const resources = await fetchSessionResources(dbSessions.map((s) => s.id));

  const codeBySessionId = new Map(dbSessions.map((s) => [s.id, s.code]));
  const resourcesBySessionCode = new Map<string, SessionResource[]>();
  for (const r of resources) {
    const code = codeBySessionId.get(r.session_id);
    if (!code) continue;
    const list = resourcesBySessionCode.get(code) ?? [];
    list.push(r);
    resourcesBySessionCode.set(code, list);
  }

  const session_progress = buildSessionProgress(jobs, dbSessions, resourcesBySessionCode);
  const global = {
    total_sessions: session_progress.length,
    generated: session_progress.filter((s) => s.generated > 0).length,
    validated: session_progress.filter((s) => s.validated > 0).length,
    published: session_progress.filter((s) => s.published > 0).length,
    quarantined: session_progress.filter((s) => s.quarantined > 0).length,
    progress_pct: Math.round(
      (session_progress.filter((s) => s.job_statut === "succeeded").length / session_progress.length) * 100,
    ),
  };

  return { batch: batch as ResourceGenerationBatch, jobs, session_progress, global };
}

export async function invokeCurriculumBatch<T extends Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(BATCH_FN, { body });
  if (error) throw error;
  const payload = data as T & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

export async function estimateBatchCost(params: {
  plan_version_id: string;
  from?: string;
  to?: string;
  publish?: boolean;
}): Promise<CostEstimate> {
  return invokeCurriculumBatch<CostEstimate>({ action: "estimate", ...params });
}

export async function startBatch(params: {
  plan_version_id: string;
  from?: string;
  to?: string;
  publish?: boolean;
  cost_cap_eur?: number;
}): Promise<{ batch_id: string; message: string; stubbed?: boolean }> {
  return invokeCurriculumBatch({ action: "start", ...params });
}

export async function resumeBatch(batchId: string): Promise<{ batch_id: string; message: string; stubbed?: boolean }> {
  return invokeCurriculumBatch({ action: "resume", batch_id: batchId });
}

export async function restorePublication(params: {
  publication_id: string;
  cohort_check?: boolean;
}): Promise<{ ok: boolean; message: string; stubbed?: boolean }> {
  return invokeCurriculumBatch({ action: "restore", ...params });
}

export async function restoreSession(params: {
  plan_version_id: string;
  session_code: string;
  cohort_check?: boolean;
}): Promise<{ ok: boolean; message: string; restored?: { resource_id: string; version: number }[] }> {
  return invokeCurriculumBatch({ action: "restore_session", ...params });
}
