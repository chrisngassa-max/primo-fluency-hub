import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveExerciseAudio } from "../_shared/pedagogical-source-audio.ts";

/**
 * resolve-exercise-audio
 *
 * Résout l'URL signée (courte durée) du MP3 original d'un exercice CO publié
 * depuis une famille de différenciation A2. L'URL n'est JAMAIS persistée.
 *
 * Autorisation (exactement UN contexte par requête, sinon AUTH_CONTEXT_AMBIGUOUS) :
 *  - { exercise_id, session_code } : enrollment groupe/séance ET appartenance
 *    exercice↔séance (session_document_links). JWT obligatoire.
 *  - { exercise_id, devoir_id }    : devoirs.id = devoir_id AND eleve = caller
 *    AND exercice_id = exercise_id. JWT obligatoire.
 *  - { exercise_id, play_token }   : jeton public ; play_token + is_live_ready
 *    vérifiés côté serveur. AUCUN JWT requis (mode public).
 *  - { exercise_id, preview }      : JWT formateur propriétaire de l'exercice
 *    (exercices.formateur_id) ou admin. Les apprenants sont refusés.
 *
 * La fonction est déployée avec verify_jwt = false (config.toml) pour permettre
 * le mode play_token public ; TOUTE l'authentification est refaite manuellement
 * ici. Aucune route n'est implicitement authentifiée par un simple identifiant.
 *
 * Réponses : Cache-Control: no-store. On ne journalise jamais l'URL signée,
 * le JWT ni le play_token.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number): Response {
  // no-store : l'URL signée est un jeton d'accès, elle ne doit jamais être
  // mise en cache par un proxy ou le navigateur.
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

interface RequestBody {
  exercise_id?: unknown;
  session_code?: unknown;
  devoir_id?: unknown;
  play_token?: unknown;
  preview?: unknown;
}

type AuthContext =
  | { mode: "session"; exerciseId: string; sessionCode: string }
  | { mode: "devoir"; exerciseId: string; devoirId: string }
  | { mode: "play"; exerciseId: string; playToken: string }
  | { mode: "preview"; exerciseId: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Extrait exactement un contexte d'autorisation du corps. */
function extractContext(body: RequestBody): AuthContext | { error: string } {
  if (!isNonEmptyString(body.exercise_id)) {
    return { error: "EXERCISE_ID_REQUIRED" };
  }
  const exerciseId = body.exercise_id;
  const hasSession = isNonEmptyString(body.session_code);
  const hasDevoir = isNonEmptyString(body.devoir_id);
  const hasPlay = isNonEmptyString(body.play_token);
  const hasPreview = body.preview === true;
  const ctxCount = [hasSession, hasDevoir, hasPlay, hasPreview].filter(Boolean).length;
  if (ctxCount === 0 || ctxCount > 1) {
    return { error: "AUTH_CONTEXT_AMBIGUOUS" };
  }
  if (hasSession) return { mode: "session", exerciseId, sessionCode: body.session_code as string };
  if (hasDevoir) return { mode: "devoir", exerciseId, devoirId: body.devoir_id as string };
  if (hasPlay) return { mode: "play", exerciseId, playToken: body.play_token as string };
  return { mode: "preview", exerciseId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  const ctxOrError = extractContext(body);
  if ("error" in ctxOrError) {
    return jsonResponse({ error: ctxOrError.error }, 400);
  }
  const ctx = ctxOrError;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // --- Authentification manuelle ---------------------------------------
  // Modes authentifiés (session/devoir/preview) : JWT obligatoire.
  // Mode play : public (pas de JWT), mais play_token validé ci-dessous.
  let learnerId: string | null = null;
  let isAdmin = false;
  if (ctx.mode !== "play") {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "AUTHENTIFICATION_REQUIRED" }, 401);
    }
    const token = authHeader.slice(7).trim();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: "SESSION_INVALID" }, 401);
    }
    learnerId = userData.user.id;
    const { data: isAdminFlag } = await admin.rpc("has_role", { uid: learnerId, target_role: "admin" });
    isAdmin = Boolean(isAdminFlag);
  }

  // --- Autorisation par contexte ---------------------------------------
  try {
    if (ctx.mode === "session") {
      // 1. Enrollment : training_sessions.code -> sessions.training_session_id
      //    -> groups -> group_members(eleve_id = learnerId).
      const { data: enrollment, error: enrollmentError } = await admin
        .from("training_sessions")
        .select("id, sessions:sessions(id, group_members:group_members(eleve_id))")
        .eq("code", ctx.sessionCode)
        .maybeSingle();
      if (enrollmentError) throw enrollmentError;
      const matching = (enrollment as any)?.sessions?.find((s: any) =>
        (s.group_members ?? []).some((gm: any) => gm.eleve_id === learnerId),
      );
      if (!matching) {
        return jsonResponse({ error: "NOT_ENROLLED" }, 403);
      }
      // 2. Appartenance exercice↔séance. Un élève membre du groupe ne peut pas
      //    résoudre n'importe quel exercise_id.
      const { data: link, error: linkError } = await admin
        .from("session_document_links")
        .select("id")
        .eq("session_code", ctx.sessionCode)
        .eq("linked_id", ctx.exerciseId)
        .eq("linked_type", "exercise")
        .in("audience", ["apprenant", "both"])
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) {
        return jsonResponse({ error: "EXERCISE_NOT_IN_SESSION" }, 403);
      }
    } else if (ctx.mode === "devoir") {
      const { data: devoir, error: devoirError } = await admin
        .from("devoirs")
        .select("id")
        .eq("id", ctx.devoirId)
        .eq("eleve_id", learnerId as string)
        .eq("exercice_id", ctx.exerciseId)
        .maybeSingle();
      if (devoirError) throw devoirError;
      if (!devoir) {
        return jsonResponse({ error: "DEVOIR_FORBIDDEN" }, 403);
      }
    } else if (ctx.mode === "play") {
      // Pas de JWT : on valide play_token + is_live_ready + identité exercice.
      const { data: ex, error: exError } = await admin
        .from("exercices")
        .select("id")
        .eq("id", ctx.exerciseId)
        .eq("play_token", ctx.playToken)
        .eq("is_live_ready", true)
        .maybeSingle();
      if (exError) throw exError;
      if (!ex) {
        return jsonResponse({ error: "PLAY_TOKEN_INVALID" }, 403);
      }
    } else {
      // preview : formateur propriétaire de l'exercice ou admin.
      const { data: ex, error: exError } = await admin
        .from("exercices")
        .select("formateur_id")
        .eq("id", ctx.exerciseId)
        .maybeSingle<{ formateur_id: string }>();
      if (exError) throw exError;
      if (!ex) {
        return jsonResponse({ error: "EXERCISE_NOT_FOUND" }, 404);
      }
      if (!isAdmin && ex.formateur_id !== (learnerId as string)) {
        return jsonResponse({ error: "PREVIEW_FORBIDDEN" }, 403);
      }
    }

    // --- Résolution -----------------------------------------------------
    const resolution = await resolveExerciseAudio(admin, ctx.exerciseId);
    switch (resolution.status) {
      case "resolved":
        return jsonResponse({ ok: true, audio_url: resolution.url, expires_at: resolution.expiresAt }, 200);
      case "no_original_audio":
        return jsonResponse({ ok: false, status: "no_original_audio" }, 404);
      case "stale":
        return jsonResponse({ ok: false, status: "stale" }, 410);
      case "unavailable":
        return jsonResponse({ ok: false, status: "unavailable", code: resolution.code }, 503);
    }
  } catch (error) {
    // Ne pas logger de données sensibles (URL/JWT/play_token).
    console.error("[resolve-exercise-audio] error", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: "RESOLVE_AUDIO_FAILED" }, 500);
  }
});
