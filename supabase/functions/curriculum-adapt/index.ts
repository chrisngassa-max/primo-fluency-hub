import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

interface AdaptRequest {
  plan_version_id: string;
  session_code: string;
  adaptation_rules?: string[];
  pseudonymized_errors?: { competence?: string; pattern?: string; count?: number }[];
}

/**
 * Lot 6 (stub) — adaptation pédagogique post-séance.
 * Entrées : ressources publiées uniquement, règles d'adaptation du brief,
 * erreurs pseudonymisées (jamais de données nominatives).
 * Sortie : resource_ids des ressources publiées utilisées comme base.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { admin } = await assertFormateur(req);
    const body = (await req.json().catch(() => ({}))) as AdaptRequest;

    const { plan_version_id: planVersionId, session_code: sessionCode } = body;
    if (!planVersionId || !sessionCode) {
      return json(400, { ok: false, message: "plan_version_id et session_code requis." });
    }

    const { data: session, error: sessionError } = await admin
      .from("training_sessions")
      .select("id, code")
      .eq("plan_version_id", planVersionId)
      .eq("code", sessionCode)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      return json(404, { ok: false, message: `Séance ${sessionCode} introuvable.` });
    }

    const { data: resources, error: resourcesError } = await admin
      .from("session_resources")
      .select("id, resource_id, kind, version, statut")
      .eq("session_id", session.id)
      .eq("statut", "published");

    if (resourcesError) throw resourcesError;

    const published = resources ?? [];
    if (published.length === 0) {
      return json(400, {
        ok: false,
        message: `Aucune ressource publiée pour ${sessionCode}. Publiez d'abord via curriculum:publish.`,
      });
    }

    const adaptationRules = Array.isArray(body.adaptation_rules) ? body.adaptation_rules : [];
    const pseudonymizedErrors = Array.isArray(body.pseudonymized_errors) ? body.pseudonymized_errors : [];

    // Stub : retourne les resource_ids publiés comme base d'adaptation.
    // L'implémentation complète (lot 6) sélectionnera un sous-ensemble selon
    // les règles et les patterns d'erreurs pseudonymisés.
    const resourceIds = published.map((r) => r.resource_id);

    return json(200, {
      ok: true,
      stubbed: true,
      session_code: sessionCode,
      resource_ids: resourceIds,
      adaptation_rules_received: adaptationRules.length,
      error_patterns_received: pseudonymizedErrors.length,
      message: `[STUB] ${resourceIds.length} ressource(s) publiée(s) identifiée(s) pour adaptation.`,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : String(e);
    return json(status, { ok: false, error: message });
  }
});
