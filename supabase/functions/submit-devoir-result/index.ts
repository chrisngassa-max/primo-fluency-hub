// @ts-nocheck
/**
 * submit-devoir-result — Vague 2.
 *
 * Le client envoie SEULEMENT les réponses brutes. Cette fonction :
 *  1. Authentifie l'élève (JWT).
 *  2. Vérifie que le devoir lui appartient et est encore actif.
 *  3. Charge l'exercice côté serveur (service role).
 *  4. Corrige (QCM normalisé / IA pour productions libres).
 *  5. Insère la ligne `resultats`.
 *  6. Met à jour `devoirs.statut` + `nb_reussites_consecutives`.
 *  7. Retourne { score, correction_detaillee, devoir_statut, ai_failed }.
 *
 * Sécurité : aucune écriture de score/statut côté client.
 * Tolérance pannes IA : score QCM partiel, items IA flaggés ai_failed.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corrigerExerciceServer } from "../_shared/correction-server.ts";

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
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Auth via JWT élève
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing authorization" });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return json(401, { error: "Invalid token" });
  }
  const userId = userData.user.id;

  // 2. Parse body
  // Deux modes :
  //   - mode "devoir" : { devoir_id, answers, [transcription, audio_path] }
  //     → écrit resultats(devoir_id) + update devoirs.statut
  //   - mode "exercice" : { exercice_id, answers, session_id? }
  //     → écrit resultats sans devoir_id (cas BilanSeance, exos en classe)
  let body: {
    devoir_id?: string;
    exercice_id?: string;
    session_id?: string;
    answers?: Record<string, unknown>;
    transcription?: string;
    audio_path?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const devoirId = body.devoir_id;
  const standaloneExerciceId = body.exercice_id;
  const answers = body.answers ?? {};
  if (!devoirId && !standaloneExerciceId) {
    return json(400, { error: "devoir_id or exercice_id required" });
  }

  // 3. Service role pour bypasser RLS et corriger sans risque de tampering
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 3a. Charger le devoir + vérifier propriété + statut (mode devoir uniquement)
  let devoir: { id: string; eleve_id: string; exercice_id: string; statut: string; nb_reussites_consecutives: number } | null = null;
  let targetExerciceId = standaloneExerciceId!;
  if (devoirId) {
    const { data, error: devErr } = await admin
      .from("devoirs")
      .select("id, eleve_id, exercice_id, statut, nb_reussites_consecutives, formateur_id")
      .eq("id", devoirId)
      .maybeSingle();
    if (devErr) return json(500, { error: "Failed to load devoir", details: devErr.message });
    if (!data) return json(404, { error: "Devoir not found" });
    if (data.eleve_id !== userId) return json(403, { error: "Not your devoir" });
    if (data.statut !== "en_attente") {
      return json(409, { error: "Devoir already finalized", statut: data.statut });
    }
    devoir = data as typeof devoir;
    targetExerciceId = data.exercice_id;
  }

  // 3b. Charger l'exercice
  const { data: ex, error: exErr } = await admin
    .from("exercices")
    .select("id, titre, consigne, contenu, format, competence, niveau_vise, formateur_id")
    .eq("id", devoir.exercice_id)
    .maybeSingle();
  if (exErr || !ex) return json(500, { error: "Failed to load exercice", details: exErr?.message });

  const contenu = (ex.contenu ?? {}) as Record<string, unknown>;
  const items = Array.isArray(contenu.items) ? contenu.items as Array<Record<string, unknown>> : [];
  const metadata = (contenu.metadata ?? {}) as { code?: string };

  // 4. Correction côté serveur
  let correction: unknown[] = [];
  let score = 0;
  let aiFailed = false;
  try {
    const result = await corrigerExerciceServer({
      format: ex.format,
      competence: ex.competence,
      items,
      answers,
      metadata,
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE,
    });
    correction = result.correction;
    score = result.score;
    aiFailed = result.ai_failed;
  } catch (e) {
    console.error("[submit-devoir-result] correction failed:", (e as Error).message);
    return json(500, { error: "Correction server error", details: (e as Error).message });
  }

  // 5. Insert resultats (en service role → RLS bypass)
  const reponses_eleve = body.transcription
    ? { ...answers, transcription: body.transcription, audio_path: body.audio_path }
    : answers;

  const { error: insErr } = await admin.from("resultats").insert({
    eleve_id: userId,
    exercice_id: ex.id,
    devoir_id: devoirId,
    score,
    reponses_eleve,
    correction_detaillee: correction,
    tentative: 1,
  } as Record<string, unknown>);
  if (insErr) {
    console.error("[submit-devoir-result] insert resultats failed:", insErr.message);
    return json(500, { error: "Failed to save result", details: insErr.message });
  }

  // 6. Update devoir statut (logique pédagogique inchangée)
  const passed = score >= 80;
  const newConsecutive = passed ? (devoir.nb_reussites_consecutives ?? 0) + 1 : 0;
  const newStatut = newConsecutive >= 2 ? "arrete" : "fait";

  const { error: updErr } = await admin
    .from("devoirs")
    .update({
      statut: newStatut,
      nb_reussites_consecutives: newConsecutive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", devoirId);
  if (updErr) {
    console.error("[submit-devoir-result] update devoir failed:", updErr.message);
    // Le résultat est déjà inséré, on ne fait pas échouer le client
  }

  return json(200, {
    score,
    correction_detaillee: correction,
    devoir_statut: newStatut,
    ai_failed: aiFailed,
  });
});
