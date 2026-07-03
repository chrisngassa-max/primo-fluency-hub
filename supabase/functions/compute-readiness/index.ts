/**
 * compute-readiness — calcule et persiste les snapshots IPE (algo_version 1).
 * Pas d'IA, pas de consentement requis.
 *
 * Body: { eleve_id?: string, batch?: boolean }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadConfig } from "../_shared/readiness.ts";
import {
  computeReadinessForEleve,
  listActiveEleveIds,
} from "./gather.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let body: { eleve_id?: string; batch?: boolean } = {};
  try {
    if (req.headers.get("content-type")?.includes("application/json")) {
      body = await req.json();
    }
  } catch {
    /* empty body ok for batch cron */
  }

  const config = loadConfig();
  const eleveIds: string[] = [];

  if (body.eleve_id) {
    eleveIds.push(body.eleve_id);
  } else if (body.batch !== false) {
    eleveIds.push(...(await listActiveEleveIds(admin)));
  } else {
    return json(400, { error: "eleve_id or batch:true required" });
  }

  const results: Array<{ eleve_id: string; objectif: string; inserted: number; error?: string }> = [];

  for (const eleveId of eleveIds) {
    try {
      const computed = await computeReadinessForEleve(admin, eleveId, config);
      const { error: insertError } = await admin
        .from("readiness_snapshots")
        .insert(computed.snapshots);
      if (insertError) throw insertError;
      results.push({
        eleve_id: eleveId,
        objectif: computed.objectif,
        inserted: computed.snapshots.length,
      });
    } catch (e) {
      results.push({
        eleve_id: eleveId,
        objectif: "?",
        inserted: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const ok = results.filter((r) => !r.error).length;
  return json(200, {
    algo_version: config.algo_version,
    processed: results.length,
    success: ok,
    results,
  });
});
