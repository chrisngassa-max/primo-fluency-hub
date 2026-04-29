// @ts-nocheck
/**
 * finalize-test-session — Vague 2.
 *
 * Le client envoie SEULEMENT le session_id. Cette fonction :
 *  1. Authentifie l'élève.
 *  2. Vérifie qu'il est propriétaire de la session et qu'elle n'est pas terminée.
 *  3. Recalcule les scores par compétence à partir de test_reponses (source de vérité).
 *  4. Calcule profil_final + groupe_suggere côté serveur.
 *  5. UPDATE test_sessions avec scores + statut='termine' (service role).
 *  6. INSERT test_resultats_apprenants (snapshot final).
 *  7. Retourne scores + profil + groupe.
 *
 * Le client ne peut plus écrire les score_* finaux (RLS Vague 2 + trigger Vague 1).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function calculerProfilFinal(p: { co: number; ce: number; eo: number; ee: number }): string {
  const moyenne = (p.co + p.ce + p.eo + p.ee) / 4;
  if (moyenne <= 1.5) return "A0_bas";
  if (moyenne <= 2.5) return "A0_intermediaire";
  if (moyenne <= 3.5) return "A0_haut";
  return "A1_maitrise";
}

function suggererGroupe(profil: string): string {
  if (profil === "A0_bas" || profil === "A0_intermediaire") return "groupe_1";
  return "groupe_2";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing authorization" });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return json(401, { error: "Invalid token" });
  const userId = userData.user.id;

  // 2. Body
  let body: { session_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const sessionId = body.session_id;
  if (!sessionId) return json(400, { error: "session_id required" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 2a. Vérifier la session
  const { data: session, error: sErr } = await admin
    .from("test_sessions")
    .select("id, apprenant_id, statut, palier_co, palier_ce, palier_eo, palier_ee")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) return json(500, { error: "Failed to load session", details: sErr.message });
  if (!session) return json(404, { error: "Session not found" });
  if (session.apprenant_id !== userId) return json(403, { error: "Not your session" });
  if (session.statut === "termine") {
    return json(409, { error: "Session already finalized" });
  }

  // 3. Recalcule les scores par compétence depuis test_reponses (source de vérité,
  //    déjà non-modifiable par l'élève grâce au trigger guard Vague 1).
  const { data: reponses, error: rErr } = await admin
    .from("test_reponses")
    .select("competence, score_obtenu, est_correct, palier")
    .eq("session_id", sessionId);
  if (rErr) return json(500, { error: "Failed to load reponses", details: rErr.message });

  const scores = { co: 0, ce: 0, eo: 0, ee: 0 };
  const paliersMax = { co: 1, ce: 1, eo: 1, ee: 1 };

  for (const r of reponses ?? []) {
    const comp = String(r.competence ?? "").toLowerCase();
    if (!(comp in scores)) continue;
    const k = comp as "co" | "ce" | "eo" | "ee";
    // score_obtenu est posé par le serveur lors de la réponse (1 = correct, 0 sinon).
    // Si null (production libre non encore évaluée), on prend est_correct.
    const pts = r.score_obtenu != null ? Number(r.score_obtenu) : (r.est_correct ? 1 : 0);
    scores[k] += isFinite(pts) ? pts : 0;
    const p = Number(r.palier ?? 1);
    if (p > paliersMax[k]) paliersMax[k] = p;
  }

  const profil = calculerProfilFinal(paliersMax);
  const groupe = suggererGroupe(profil);

  // 4. UPDATE test_sessions (service role → bypass RLS, pas de tampering possible)
  const { error: updErr } = await admin
    .from("test_sessions")
    .update({
      statut: "termine",
      date_fin: new Date().toISOString(),
      score_co: scores.co,
      score_ce: scores.ce,
      score_eo: scores.eo,
      score_ee: scores.ee,
      profil_final: profil,
      groupe_suggere: groupe,
    })
    .eq("id", sessionId);
  if (updErr) {
    console.error("[finalize-test-session] update failed:", updErr.message);
    return json(500, { error: "Failed to finalize", details: updErr.message });
  }

  // 5. Snapshot dans test_resultats_apprenants
  const { error: snapErr } = await admin
    .from("test_resultats_apprenants")
    .insert({
      apprenant_id: userId,
      session_id: sessionId,
      score_total: scores.co + scores.ce + scores.eo + scores.ee,
      score_co: scores.co,
      score_ce: scores.ce,
      score_eo: scores.eo,
      score_ee: scores.ee,
      palier_final_co: paliersMax.co,
      palier_final_ce: paliersMax.ce,
      palier_final_eo: paliersMax.eo,
      palier_final_ee: paliersMax.ee,
      profil_final: profil,
      groupe_suggere: groupe,
    } as Record<string, unknown>);
  if (snapErr) {
    // Non-bloquant : la session est déjà finalisée
    console.error("[finalize-test-session] snapshot failed:", snapErr.message);
  }

  return json(200, {
    scores,
    paliers_final: paliersMax,
    profil_final: profil,
    groupe_suggere: groupe,
  });
});
