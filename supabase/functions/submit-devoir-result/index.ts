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
import { classifyAndEmitErrors } from "../_shared/classifyAndEmitErrors.ts";
import { resolveLiveSessionId } from "../_shared/resolveLiveSessionId.ts";
import { resolveLearningPathOutcome } from "../_shared/learning-path-routing.ts";

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
  let devoir: { id: string; eleve_id: string; exercice_id: string; statut: string; nb_reussites_consecutives: number; formateur_id?: string | null; session_id?: string | null } | null = null;
  let targetExerciceId = standaloneExerciceId!;
  if (devoirId) {
    const { data, error: devErr } = await admin
      .from("devoirs")
      .select("id, eleve_id, exercice_id, statut, nb_reussites_consecutives, formateur_id, session_id")
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
    .select("id, titre, consigne, contenu, format, competence, niveau_vise, formateur_id, metadata_code, source")
    .eq("id", targetExerciceId)
    .maybeSingle();
  if (exErr || !ex) return json(500, { error: "Failed to load exercice", details: exErr?.message });

  const contenu = (ex.contenu ?? {}) as Record<string, unknown>;
  const items = Array.isArray(contenu.items) ? contenu.items as Array<Record<string, unknown>> : [];
  const metadata = (contenu.metadata ?? {}) as {
    code?: string;
    session_code?: string;
    family_id?: string;
    niveau?: string;
    learning_path?: {
      step_order?: number;
      step_count?: number;
      adaptive_policy?: {
        remediation_below?: number;
        consolidation_from?: number;
        extension_from?: number;
      };
    };
  };
  const learningPathMeta = metadata.learning_path;

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

  // 4b. Détection bonus : la ligne session_exercices(session_id, exercice_id) prime,
  //     puis fallback sur des marqueurs textuels dans le titre / la consigne.
  let isBonus = false;
  if (body.session_id) {
    const { data: seRow } = await admin
      .from("session_exercices")
      .select("is_bonus")
      .eq("session_id", body.session_id)
      .eq("exercice_id", ex.id)
      .maybeSingle();
    if (seRow?.is_bonus === true) isBonus = true;
  }
  if (!isBonus) {
    const haystack = `${ex.titre ?? ""} ${ex.consigne ?? ""}`.toLowerCase();
    if (/\bbonus\b|approfondiss/.test(haystack)) isBonus = true;
  }
  // Si le devoir provient d'un parcours d'approfondissement (source_label),
  // on considère également le résultat comme bonus.
  if (!isBonus && devoir) {
    const { data: devSrc } = await admin
      .from("devoirs")
      .select("source_label")
      .eq("id", devoir.id)
      .maybeSingle();
    const lbl = (devSrc?.source_label ?? "").toLowerCase();
    if (lbl.includes("approfondissement") || lbl.includes("bonus")) isBonus = true;
  }

  // 5. Insert resultats (en service role → RLS bypass)
  const reponses_eleve = body.transcription
    ? { ...answers, transcription: body.transcription, audio_path: body.audio_path }
    : answers;

  const insertPayload: Record<string, unknown> = {
    eleve_id: userId,
    exercice_id: ex.id,
    score,
    reponses_eleve,
    correction_detaillee: correction,
    tentative: 1,
    is_bonus: isBonus,
  };
  if (devoirId) insertPayload.devoir_id = devoirId;

  const { error: insErr } = await admin.from("resultats").insert(insertPayload);
  if (insErr) {
    console.error("[submit-devoir-result] insert resultats failed:", insErr.message);
    return json(500, { error: "Failed to save result", details: insErr.message });
  }

  // 5b. BilanSeance: auto-create remediation devoir when score < 80 (service role)
  let devoirCreated = false;
  if (!devoirId && !learningPathMeta && score < 80 && ex.formateur_id) {
    const { count: activeCount, error: countErr } = await admin
      .from("devoirs")
      .select("id", { count: "exact", head: true })
      .eq("eleve_id", userId)
      .eq("statut", "en_attente");
    if (!countErr && (activeCount ?? 0) < 3) {
      const { data: existing } = await admin
        .from("devoirs")
        .select("id")
        .eq("eleve_id", userId)
        .eq("exercice_id", ex.id)
        .eq("statut", "en_attente")
        .maybeSingle();
      if (!existing) {
        const raison = score < 60 ? "remediation" : "consolidation";
        const { error: devInsErr } = await admin.from("devoirs").insert({
          eleve_id: userId,
          exercice_id: ex.id,
          formateur_id: ex.formateur_id,
          session_id: body.session_id ?? null,
          raison,
          statut: "en_attente",
          contexte: "devoir",
        });
        if (!devInsErr) devoirCreated = true;
        else console.warn("[submit-devoir-result] auto devoir failed:", devInsErr.message);
      }
    }
  }

  // 6. Update devoir statut (mode devoir uniquement)
  let newStatut: string | null = null;
  if (devoir && devoirId) {
    const passed = score >= 80;
    const newConsecutive = passed ? (devoir.nb_reussites_consecutives ?? 0) + 1 : 0;
    newStatut = newConsecutive >= 2 ? "arrete" : "fait";

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
  }

  // Parcours progressif : choisit et assigne réellement la prochaine étape.
  // <60 : reprise de l’étape courante ; 60-79 : étape suivante ; >=80 : saut vers
  // l’étape de transfert. Les parcours legacy sans metadata restent inchangés.
  let adaptiveNext: Record<string, unknown> | null = null;
  if (learningPathMeta && metadata.session_code && metadata.niveau) {
    const currentOrder = Number(learningPathMeta.step_order ?? 1);
    const stepCount = Number(learningPathMeta.step_count ?? 1);
    const outcome = resolveLearningPathOutcome(score, learningPathMeta.adaptive_policy, currentOrder, stepCount);
    adaptiveNext = { decision: outcome.decision, next_step_order: outcome.nextStepOrder, assigned: false };

    if (outcome.nextStepOrder != null) {
      const prefix = `cv2:${metadata.session_code}:variant:${metadata.niveau}`;
      const { data: siblingRows, error: siblingErr } = await admin
        .from("exercices")
        .select("id, contenu")
        .eq("source", "curriculum_v2")
        .like("metadata_code", `${prefix}%`);

      if (!siblingErr) {
        const nextExercise = (siblingRows ?? []).find((row: any) => {
          const siblingMetadata = row?.contenu?.metadata ?? {};
          return siblingMetadata.family_id === metadata.family_id
            && Number(siblingMetadata.learning_path?.step_order) === outcome.nextStepOrder;
        });
        const formateurId = devoir?.formateur_id ?? ex.formateur_id;
        const sessionId = devoir?.session_id ?? body.session_id ?? null;

        if (nextExercise?.id && formateurId) {
          const { count: activeCount } = await admin
            .from("devoirs")
            .select("id", { count: "exact", head: true })
            .eq("eleve_id", userId)
            .eq("statut", "en_attente");
          const { data: existingNext } = await admin
            .from("devoirs")
            .select("id")
            .eq("eleve_id", userId)
            .eq("exercice_id", nextExercise.id)
            .eq("statut", "en_attente")
            .neq("id", devoirId ?? "00000000-0000-0000-0000-000000000000")
            .maybeSingle();

          if (!existingNext && (activeCount ?? 0) < 3) {
            const { error: nextErr } = await admin.from("devoirs").insert({
              eleve_id: userId,
              exercice_id: nextExercise.id,
              formateur_id: formateurId,
              session_id: sessionId,
              raison: outcome.decision === "remediation" ? "remediation" : "consolidation",
              statut: "en_attente",
              contexte: "devoir",
              source_label: `learning_path_${outcome.decision}`,
            });
            if (!nextErr) {
              devoirCreated = true;
              adaptiveNext.assigned = true;
              adaptiveNext.exercice_id = nextExercise.id;
            } else {
              console.warn("[submit-devoir-result] adaptive next devoir failed:", nextErr.message);
            }
          }
        }
      } else {
        console.warn("[submit-devoir-result] sibling lookup failed:", siblingErr.message);
      }
    }
  }
  // Sprint 3 : classification taxonomique + émission live events
  // Fire-and-forget : on ne bloque pas la réponse si ça échoue.
  const liveSessionId = await resolveLiveSessionId(admin, {
    devoirSessionId: (devoir as any)?.session_id ?? null,
    bodySessionId: body.session_id ?? null,
    exerciceId: ex.id,
    eleveId: userId,
  });

  if (liveSessionId) {
    classifyAndEmitErrors({
      sessionId: liveSessionId,
      eleveId: userId,
      exerciceId: ex.id,
      competence: ex.competence,
      consigne: ex.consigne,
      items,
      answers,
      correction,
      score,
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE,
    }).catch((e) =>
      console.warn("[submit-devoir-result] classifyAndEmitErrors:", (e as Error).message)
    );
  }

  return json(200, {
    score,
    correction_detaillee: correction,
    devoir_statut: newStatut,
    devoir_created: devoirCreated,
    adaptive_next: adaptiveNext,
    ai_failed: aiFailed,
  });
});
