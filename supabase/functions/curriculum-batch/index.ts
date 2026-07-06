import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SESSION_CODES = [
  ...Array.from({ length: 37 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`),
  "E1", "E2", "E3", "E4",
];

const COST_PER_SESSION_FAKE = 0;
const COST_PER_SESSION_REAL = 0.35;
const DEFAULT_COST_CAP = 50;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const WORKER_HINT = "BATCH_STORE=supabase npm run curriculum:worker -- --once";

async function assertPlanVersion(admin: ReturnType<typeof createClient>, planVersionId: string) {
  const { data, error } = await admin
    .from("training_plan_versions")
    .select("id, version, statut")
    .eq("id", planVersionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw Object.assign(
      new Error(`plan_version_id introuvable (${planVersionId}). Appliquez la migration seed curriculum v2.`),
      { status: 404 },
    );
  }
  return data;
}

function resolveSessionRange(from?: string, to?: string): string[] {
  const fromCode = from ?? SESSION_CODES[0];
  const toCode = to ?? SESSION_CODES[SESSION_CODES.length - 1];
  const fromIdx = SESSION_CODES.indexOf(fromCode);
  const toIdx = SESSION_CODES.indexOf(toCode);
  if (fromIdx === -1 || toIdx === -1 || fromIdx > toIdx) {
    throw new Error(`Plage invalide : ${fromCode} → ${toCode}`);
  }
  return SESSION_CODES.slice(fromIdx, toIdx + 1);
}

function estimateCost(sessionCount: number, providers: Record<string, string>) {
  const usesFake =
    (providers.content ?? "fake") === "fake" &&
    (providers.image ?? "svg") === "svg";
  const perSession = usesFake ? COST_PER_SESSION_FAKE : COST_PER_SESSION_REAL;
  return {
    session_count: sessionCount,
    cout_estime_eur: Number((sessionCount * perSession).toFixed(4)),
    plafond_eur: DEFAULT_COST_CAP,
    providers,
    stubbed: true,
  };
}

async function assertFormateur(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw Object.assign(new Error("Non autorisé"), { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error } = await caller.auth.getUser();
  if (error || !user) throw Object.assign(new Error("Non autorisé"), { status: 401 });

  const { data: isFormateur } = await admin.rpc("has_role", { _user_id: user.id, _role: "formateur" });
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

  if (!isFormateur && !isAdmin) {
    throw Object.assign(new Error("Accès réservé aux formateurs"), { status: 403 });
  }

  return { admin, user };
}

async function handleEstimate(body: Record<string, unknown>) {
  const sessionCodes = resolveSessionRange(body.from as string, body.to as string);
  const providers = {
    content: (Deno.env.get("CONTENT_PROVIDER") ?? "fake").toLowerCase(),
    image: (Deno.env.get("IMAGE_PROVIDER") ?? "svg").toLowerCase(),
    tts: (Deno.env.get("TTS_PROVIDER") ?? "fake").toLowerCase(),
  };
  return estimateCost(sessionCodes.length, providers);
}

async function handleStart(
  admin: ReturnType<typeof createClient>,
  user: { id: string; email?: string },
  body: Record<string, unknown>,
) {
  const planVersionId = body.plan_version_id as string;
  if (!planVersionId) throw Object.assign(new Error("plan_version_id requis"), { status: 400 });

  await assertPlanVersion(admin, planVersionId);

  let sessionCodes: string[];
  try {
    sessionCodes = resolveSessionRange(body.from as string, body.to as string);
  } catch (e) {
    throw Object.assign(
      new Error(e instanceof Error ? e.message : String(e)),
      { status: 400, action: "start" },
    );
  }

  const publish = body.publish !== false;
  const costCap = Number(body.cost_cap_eur ?? DEFAULT_COST_CAP);
  if (!Number.isFinite(costCap) || costCap < 0) {
    throw Object.assign(new Error("cost_cap_eur invalide"), { status: 400, action: "start" });
  }

  const providers = {
    content: (Deno.env.get("CONTENT_PROVIDER") ?? "fake").toLowerCase(),
    image: (Deno.env.get("IMAGE_PROVIDER") ?? "svg").toLowerCase(),
  };
  const estimate = estimateCost(sessionCodes.length, providers);

  if (estimate.cout_estime_eur > costCap) {
    return json(400, {
      error: `Coût estimé (${estimate.cout_estime_eur} €) dépasse le plafond (${costCap} €).`,
      action: "start",
      hint: "Augmentez cost_cap_eur ou réduisez la plage from/to.",
    });
  }

  const { data: batch, error: batchError } = await admin
    .from("resource_generation_batches")
    .insert({
      plan_version_id: planVersionId,
      configuration: {
        session_codes: sessionCodes,
        from: sessionCodes[0],
        to: sessionCodes.at(-1),
        publish,
        providers,
        cost_cap_eur: costCap,
      },
      cout_estime_eur: estimate.cout_estime_eur,
      etat: "running",
      compteurs: { sessions: sessionCodes.length, queued: sessionCodes.length },
      created_by: user.email ?? user.id,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (batchError) throw batchError;

  const jobRows = sessionCodes.map((sessionCode) => ({
    batch_id: batch.id,
    session_code: sessionCode,
    resource_id: "*",
    statut: "queued",
    idempotency_key: `${batch.id}:${sessionCode}:orchestrator`,
    depends_on: [],
  }));

  const { error: jobsError } = await admin.from("resource_generation_jobs").upsert(jobRows, {
    onConflict: "idempotency_key",
  });
  if (jobsError) throw jobsError;

  return json(200, {
    batch_id: batch.id,
    message: `Batch créé (${sessionCodes.length} séances). Lancez le worker pour l'orchestration complète.`,
    worker_hint: WORKER_HINT,
    cli_hint: `BATCH_STORE=supabase CURRICULUM_PLAN_VERSION_ID=${planVersionId} npm run curriculum:worker -- --batch-id ${batch.id}`,
    action: "start",
  });
}

async function handleResume(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const batchId = body.batch_id as string;
  if (!batchId) throw Object.assign(new Error("batch_id requis"), { status: 400, action: "resume" });

  const { data: existing, error: fetchError } = await admin
    .from("resource_generation_batches")
    .select("id, etat")
    .eq("id", batchId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!existing) throw Object.assign(new Error(`Batch introuvable : ${batchId}`), { status: 404, action: "resume" });

  const { data: batch, error } = await admin
    .from("resource_generation_batches")
    .update({ etat: "running", updated_at: new Date().toISOString() })
    .eq("id", batchId)
    .select()
    .single();

  if (error) throw error;

  return json(200, {
    batch_id: batchId,
    message: `Batch ${batchId.slice(0, 8)}… marqué comme running.`,
    worker_hint: WORKER_HINT,
    cli_hint: `BATCH_STORE=supabase npm run curriculum:worker -- --batch-id ${batchId}`,
    action: "resume",
  });
}

async function handleStatus(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const batchId = body.batch_id as string;
  if (!batchId) throw new Error("batch_id requis");

  const { data: batch, error } = await admin
    .from("resource_generation_batches")
    .select("*")
    .eq("id", batchId)
    .single();
  if (error) throw error;

  const { data: jobs } = await admin
    .from("resource_generation_jobs")
    .select("*")
    .eq("batch_id", batchId);

  return json(200, { batch, jobs: jobs ?? [] });
}

async function handleRestore(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const publicationId = body.publication_id as string;
  if (!publicationId) throw new Error("publication_id requis");

  const { data: publication, error: pubError } = await admin
    .from("curriculum_publications")
    .select("id, plan_version_id, session_resource_id, version, published_at, published_by, previous_publication_id")
    .eq("id", publicationId)
    .single();

  if (pubError || !publication) throw new Error("Publication introuvable");

  const sessionResourceId = publication.session_resource_id;

  const { data: resourceRow } = await admin
    .from("session_resources")
    .select("id, version, resource_id, session_id")
    .eq("id", sessionResourceId)
    .single();

  if (body.cohort_check !== false) {
    const { data: pins } = await admin
      .from("cohort_resource_pins")
      .select("id, cohort_id, pinned_version")
      .eq("session_resource_id", sessionResourceId);

    const currentVersion = resourceRow?.version ?? publication.version;
    const blocking = (pins ?? []).filter((p) => p.pinned_version >= currentVersion);
    if (blocking.length > 0) {
      return json(409, {
        ok: false,
        message: `${blocking.length} cohorte(s) épinglée(s) sur cette version — restauration bloquée.`,
      });
    }
  }

  const targetVersion = publication.version;

  if (!resourceRow) throw new Error("Ressource introuvable");

  const sessionId = resourceRow.session_id;
  const { data: sessionResources } = await admin
    .from("session_resources")
    .select("id, resource_id, kind, version, statut")
    .eq("session_id", sessionId);

  const supportRes = (sessionResources ?? []).find(
    (r) => r.resource_id.includes("support") || r.kind?.includes("support"),
  );
  const corrigeRes = (sessionResources ?? []).find(
    (r) => r.resource_id.includes("corrige") || r.kind?.includes("corrige"),
  );

  if (supportRes && corrigeRes && supportRes.version !== corrigeRes.version) {
    return json(409, {
      ok: false,
      message: `Incohérence atomique : support v${supportRes.version} / corrigé v${corrigeRes.version}. Utilisez action=restore_session pour une restauration groupée.`,
      action: "restore",
      hint: "restore_session avec session_code + plan_version_id",
    });
  }

  await admin
    .from("session_resources")
    .update({ statut: "superseded" })
    .eq("session_id", sessionId)
    .eq("resource_id", resourceRow.resource_id)
    .eq("statut", "published");

  await admin
    .from("session_resources")
    .update({ statut: "published", published_at: new Date().toISOString() })
    .eq("id", sessionResourceId);

  return json(200, {
    ok: true,
    message: `Ressource ${resourceRow.resource_id} restaurée en v${targetVersion}.`,
    stubbed: false,
  });
}

/** Restauration atomique de toutes les ressources publiées d'une séance (support + corrigé alignés). */
async function handleRestoreSession(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const sessionCode = body.session_code as string;
  const planVersionId = body.plan_version_id as string;
  if (!sessionCode || !planVersionId) {
    throw Object.assign(new Error("session_code et plan_version_id requis"), { status: 400, action: "restore_session" });
  }

  const { data: session, error: sessionError } = await admin
    .from("training_sessions")
    .select("id, code")
    .eq("plan_version_id", planVersionId)
    .eq("code", sessionCode)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) {
    throw Object.assign(new Error(`Séance ${sessionCode} introuvable`), { status: 404, action: "restore_session" });
  }

  const { data: resources } = await admin
    .from("session_resources")
    .select("id, resource_id, kind, version, statut")
    .eq("session_id", session.id);

  const published = (resources ?? []).filter((r) => r.statut === "published");
  if (published.length === 0) {
    return json(400, { ok: false, message: `Aucune ressource publiée pour ${sessionCode}.`, action: "restore_session" });
  }

  if (body.cohort_check !== false) {
    for (const res of published) {
      const { data: pins } = await admin
        .from("cohort_resource_pins")
        .select("id, cohort_id, pinned_version")
        .eq("session_resource_id", res.id);
      const blocking = (pins ?? []).filter((p) => p.pinned_version >= res.version);
      if (blocking.length > 0) {
        return json(409, {
          ok: false,
          message: `${blocking.length} cohorte(s) épinglée(s) sur ${res.resource_id} — restauration bloquée.`,
          action: "restore_session",
        });
      }
    }
  }

  const supportRes = published.find((r) => r.resource_id.includes("support") || r.kind?.includes("support"));
  const corrigeRes = published.find((r) => r.resource_id.includes("corrige") || r.kind?.includes("corrige"));
  if (supportRes && corrigeRes && supportRes.version !== corrigeRes.version) {
    return json(409, {
      ok: false,
      message: `Incohérence atomique : support v${supportRes.version} / corrigé v${corrigeRes.version}.`,
      action: "restore_session",
    });
  }

  const restoreTargets: { resourceId: string; targetRowId: string; targetVersion: number }[] = [];
  for (const res of published) {
    const { data: latestPub } = await admin
      .from("curriculum_publications")
      .select("id, version, previous_publication_id")
      .eq("session_resource_id", res.id)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestPub?.previous_publication_id) {
      return json(400, {
        ok: false,
        message: `Ressource ${res.resource_id} : aucune version précédente à restaurer.`,
        action: "restore_session",
      });
    }

    const { data: prevPub } = await admin
      .from("curriculum_publications")
      .select("id, session_resource_id, version")
      .eq("id", latestPub.previous_publication_id)
      .single();

    if (!prevPub) {
      return json(400, { ok: false, message: `Publication précédente introuvable pour ${res.resource_id}.`, action: "restore_session" });
    }

    restoreTargets.push({ resourceId: res.resource_id, targetRowId: prevPub.session_resource_id, targetVersion: prevPub.version });
  }

  const targetVersions = restoreTargets.map((t) => t.targetVersion);
  if (new Set(targetVersions).size > 1) {
    return json(409, {
      ok: false,
      message: `Versions cibles incohérentes entre ressources (${targetVersions.join(", ")}).`,
      action: "restore_session",
    });
  }

  await admin.from("session_resources").update({ statut: "superseded" }).eq("session_id", session.id).eq("statut", "published");

  const now = new Date().toISOString();
  for (const target of restoreTargets) {
    await admin
      .from("session_resources")
      .update({ statut: "published", published_at: now })
      .eq("id", target.targetRowId);
  }

  return json(200, {
    ok: true,
    message: `Séance ${sessionCode} restaurée (${restoreTargets.length} ressource(s), v${targetVersions[0]}).`,
    restored: restoreTargets.map((t) => ({ resource_id: t.resourceId, version: t.targetVersion })),
    action: "restore_session",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { admin, user } = await assertFormateur(req);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action as string;

    switch (action) {
      case "estimate":
        return json(200, await handleEstimate(body));
      case "start":
        return (await handleStart(admin, user, body)) as Response;
      case "resume":
        return await handleResume(admin, body);
      case "status":
        return await handleStatus(admin, body);
      case "restore":
        return await handleRestore(admin, body);
      case "restore_session":
        return await handleRestoreSession(admin, body);
      default:
        return json(400, {
          error: `action inconnue : ${action}`,
          hint: "Actions valides : estimate, start, resume, status, restore, restore_session",
        });
    }
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : String(e);
    const action = (e as { action?: string }).action;
    return json(status, { error: message, ...(action ? { action } : {}) });
  }
});
