// process-homework-generation-queue
// Cron-triggered (toutes les 5 min) — traite la file homework_generation_queue.
// FOR UPDATE SKIP LOCKED LIMIT 5, backoff exponentiel, alerte formateur si failed.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface QueueRow {
  id: string;
  eleve_id: string;
  formateur_id: string;
  session_id: string | null;
  completed_serie: number | null;
  attempts: number;
  max_attempts: number;
}

async function pickBatch(supabase: any): Promise<QueueRow[]> {
  // Pas de FOR UPDATE SKIP LOCKED via PostgREST → on simule via RPC SQL.
  // On utilise une fonction RPC créée à la volée (pas dispo) ; à défaut,
  // on fait un select + update atomique en passant à 'processing'.
  // Stratégie : SELECT 5 lignes éligibles, puis UPDATE conditionnel id+status='pending|failed'.
  const { data, error } = await supabase
    .from("homework_generation_queue")
    .select("id, eleve_id, formateur_id, session_id, completed_serie, attempts, max_attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", 999) // sera comparé à max_attempts plus bas
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) throw error;
  const rows: QueueRow[] = (data ?? []) as any;
  // Filtre attempts < max_attempts (impossible côté postgrest direct sur 2 colonnes)
  const eligible = rows.filter((r) => r.attempts < r.max_attempts);

  // Verrou : on tente de passer chaque ligne à 'processing' uniquement si encore éligible.
  const claimed: QueueRow[] = [];
  for (const r of eligible) {
    const { data: upd, error: upErr } = await supabase
      .from("homework_generation_queue")
      .update({ status: "processing" })
      .eq("id", r.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!upErr && upd) claimed.push(r);
  }
  return claimed;
}

async function callGenerateSeries(row: QueueRow): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-next-homework-series`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        eleveIds: [row.eleve_id],
        formateurId: row.formateur_id,
        sessionId: row.session_id ?? undefined,
        targetCount: 5,
        estimatedDuration: 30,
        force: false, // file = élève sans devoirs en attente
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: `HTTP ${resp.status}: ${txt.slice(0, 300)}` };
    }
    const json = await resp.json();
    if (json?.success === false) return { ok: false, error: json?.error ?? "unknown" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function tryCreateAlert(supabase: any, row: QueueRow, errorMessage: string) {
  try {
    await supabase.from("alertes").insert({
      formateur_id: row.formateur_id,
      eleve_id: row.eleve_id,
      type: "score_risque", // type existant — message explicite
      message: `Génération automatique de la prochaine série de devoirs en échec après ${row.max_attempts} tentatives (série ${row.completed_serie ?? "?"}). Relance manuelle nécessaire. ${errorMessage.slice(0, 200)}`,
    });
  } catch (e) {
    console.warn("[queue] alert insert failed", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const claimed = await pickBatch(supabase);
    if (claimed.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const row of claimed) {
      const res = await callGenerateSeries(row);
      if (res.ok) {
        await supabase
          .from("homework_generation_queue")
          .update({ status: "done", processed_at: new Date().toISOString(), error_message: null })
          .eq("id", row.id);
        results.push({ id: row.id, status: "done" });
      } else {
        const newAttempts = row.attempts + 1;
        if (newAttempts >= row.max_attempts) {
          await supabase
            .from("homework_generation_queue")
            .update({
              status: "failed",
              attempts: newAttempts,
              error_message: res.error ?? "unknown",
              processed_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          await tryCreateAlert(supabase, row, res.error ?? "");
          results.push({ id: row.id, status: "failed", error: res.error });
        } else {
          const delaySeconds = 60 * Math.pow(2, newAttempts);
          const next = new Date(Date.now() + delaySeconds * 1000).toISOString();
          await supabase
            .from("homework_generation_queue")
            .update({
              status: "pending",
              attempts: newAttempts,
              error_message: res.error ?? null,
              next_attempt_at: next,
            })
            .eq("id", row.id);
          results.push({ id: row.id, status: "retry", attempts: newAttempts, next_attempt_at: next });
        }
      }
    }

    return new Response(JSON.stringify({ processed: claimed.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-homework-generation-queue error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
