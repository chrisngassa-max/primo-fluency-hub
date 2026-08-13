import { resolveExerciseAudio } from "./pedagogical-source-audio.ts";
import { findEnrolledSessionForCode } from "./session-enrollment.ts";

/**
 * Handler HTTP testable de resolve-exercise-audio.
 * L'entrée Deno.serve reste un câblage mince (clients + JWT).
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export interface RequestBody {
  exercise_id?: unknown;
  session_code?: unknown;
  devoir_id?: unknown;
  play_token?: unknown;
  preview?: unknown;
}

export type AuthContext =
  | { mode: "session"; exerciseId: string; sessionCode: string }
  | { mode: "devoir"; exerciseId: string; devoirId: string }
  | { mode: "play"; exerciseId: string; playToken: string }
  | { mode: "preview"; exerciseId: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Extrait exactement un contexte d'autorisation du corps. */
export function extractContext(body: RequestBody): AuthContext | { error: string } {
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

export interface ResolveAudioHandlerDeps {
  admin: {
    from: (table: string) => unknown;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  getUser: (token: string) => Promise<{ id: string } | null>;
  resolveAudio?: typeof resolveExerciseAudio;
}

type QueryChain = {
  select: (...args: unknown[]) => QueryChain;
  eq: (...args: unknown[]) => QueryChain;
  in: (...args: unknown[]) => QueryChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

function asChain(admin: ResolveAudioHandlerDeps["admin"], table: string): QueryChain {
  return admin.from(table) as QueryChain;
}

export async function handleResolveExerciseAudio(
  req: Request,
  deps: ResolveAudioHandlerDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

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
  const resolveAudio = deps.resolveAudio ?? resolveExerciseAudio;

  let learnerId: string | null = null;
  let isAdmin = false;
  if (ctx.mode !== "play") {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "AUTHENTIFICATION_REQUIRED" }, 401);
    }
    const token = authHeader.slice(7).trim();
    const user = await deps.getUser(token);
    if (!user?.id) {
      return jsonResponse({ error: "SESSION_INVALID" }, 401);
    }
    learnerId = user.id;
    const { data: isAdminFlag } = await deps.admin.rpc("has_role", {
      uid: learnerId,
      target_role: "admin",
    });
    isAdmin = Boolean(isAdminFlag);
  }

  try {
    if (ctx.mode === "session") {
      const enrolled = await findEnrolledSessionForCode(
        deps.admin as never,
        ctx.sessionCode,
        learnerId as string,
      );
      if (!enrolled) {
        return jsonResponse({ error: "NOT_ENROLLED" }, 403);
      }
      const { data: link, error: linkError } = await asChain(deps.admin, "session_document_links")
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
      const { data: devoir, error: devoirError } = await asChain(deps.admin, "devoirs")
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
      const { data: ex, error: exError } = await asChain(deps.admin, "exercices")
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
      const { data: ex, error: exError } = await asChain(deps.admin, "exercices")
        .select("formateur_id")
        .eq("id", ctx.exerciseId)
        .maybeSingle();
      if (exError) throw exError;
      if (!ex) {
        return jsonResponse({ error: "EXERCISE_NOT_FOUND" }, 404);
      }
      const ownerId = (ex as { formateur_id?: string }).formateur_id;
      if (!isAdmin && ownerId !== learnerId) {
        return jsonResponse({ error: "PREVIEW_FORBIDDEN" }, 403);
      }
    }

    const resolution = await resolveAudio(deps.admin as never, ctx.exerciseId);
    switch (resolution.status) {
      case "resolved":
        return jsonResponse(
          { ok: true, audio_url: resolution.url, expires_at: resolution.expiresAt },
          200,
        );
      case "no_original_audio":
        return jsonResponse({ ok: false, status: "no_original_audio" }, 404);
      case "stale":
        return jsonResponse({ ok: false, status: "stale" }, 410);
      case "unavailable":
        return jsonResponse({ ok: false, status: "unavailable", code: resolution.code }, 503);
    }
  } catch (error) {
    console.error("[resolve-exercise-audio] error", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: "RESOLVE_AUDIO_FAILED" }, 500);
  }
}
