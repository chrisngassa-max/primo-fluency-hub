import {
  corsHeaders,
  getSandboxClients,
  jsonResponse,
} from "../_shared/sandbox-edge.ts";
import type { SandboxResetScope } from "../_shared/sandbox.types.ts";

async function deleteCount(admin: any, table: string, sessionId: string) {
  const { count, error } = await admin
    .from(table)
    .delete({ count: "exact" })
    .eq("sandbox_session_id", sessionId);
  if (error) throw error;
  return count ?? 0;
}

async function countRows(admin: any, table: string, sessionId: string) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("sandbox_session_id", sessionId);
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  try {
    const { admin, user } = await getSandboxClients(req);
    const body = await req.json().catch(() => ({})) as {
      scope?: SandboxResetScope;
      sandbox_session_id?: string;
    };
    if (!body.scope || !["attempts_only", "sessions", "everything"].includes(body.scope)) {
      return jsonResponse({ error: "Scope invalide" }, 400);
    }

    const { data: session, error } = await admin
      .from("sandbox_sessions")
      .select("*")
      .eq("formateur_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!session) {
      if (body.sandbox_session_id) {
        const { data: requestedSession, error: requestedError } = await admin
          .from("sandbox_sessions")
          .select("id")
          .eq("id", body.sandbox_session_id)
          .maybeSingle();
        if (requestedError) throw requestedError;
        if (requestedSession) return jsonResponse({ error: "Sandbox non autorise", request_id: requestId }, 403);
      }
      if (body.scope === "everything") {
        console.info("sandbox-reset already completed", {
          requestId,
          formateurId: user.id,
          requestedSessionId: body.sandbox_session_id ?? null,
        });
        return jsonResponse({
          tables_nettoyees: {},
          sandbox_session_id: body.sandbox_session_id ?? null,
          session_deleted: true,
          remaining_session: false,
          request_id: requestId,
          message: "already_cleaned",
        });
      }
      return jsonResponse({ error: "Sandbox introuvable", request_id: requestId }, 404);
    }
    if (body.sandbox_session_id && body.sandbox_session_id !== session.id) {
      return jsonResponse({ error: "Sandbox non autorise", request_id: requestId }, 403);
    }

    console.info("sandbox-reset started", {
      requestId,
      formateurId: user.id,
      requestedSessionId: body.sandbox_session_id ?? null,
      matchedSessionId: session.id,
      scope: body.scope,
    });

    if (body.scope === "everything") {
      const tables = ["resultats", "devoirs", "sessions", "group_members", "profils_eleves", "groups"];
      const counts = await Promise.all(tables.map((table) => countRows(admin, table, session.id)));
      const cleaned = Object.fromEntries(tables.map((table, index) => [table, counts[index]]));
      const authUserIds = session.eleve_user_ids ?? [];

      const { data: deletedSessions, error: deleteError } = await admin
        .from("sandbox_sessions")
        .delete()
        .eq("id", session.id)
        .eq("formateur_id", user.id)
        .select("id");
      if (deleteError) throw deleteError;

      if (deletedSessions?.length !== 1) {
        throw Object.assign(new Error("La session sandbox n'a pas ete supprimee"), { status: 409 });
      }

      let authCleanupFailures = 0;
      for (const userId of authUserIds) {
        const { error: authError } = await admin.auth.admin.deleteUser(userId);
        if (authError && !authError.message?.toLowerCase().includes("not found")) {
          authCleanupFailures += 1;
          console.warn("sandbox-reset auth cleanup failed", {
            requestId,
            sandboxSessionId: session.id,
            userId,
            message: authError.message,
          });
        }
      }

      const { data: remainingSession, error: verificationError } = await admin
        .from("sandbox_sessions")
        .select("id")
        .eq("formateur_id", user.id)
        .maybeSingle();
      if (verificationError) throw verificationError;
      if (remainingSession) {
        throw Object.assign(new Error("Une session sandbox subsiste apres la suppression"), { status: 409 });
      }

      console.info("sandbox-reset completed", {
        requestId,
        formateurId: user.id,
        deletedSessionId: session.id,
        cleaned,
        authCleanupFailures,
      });

      return jsonResponse({
        tables_nettoyees: cleaned,
        sandbox_session_id: session.id,
        session_deleted: true,
        remaining_session: false,
        request_id: requestId,
        auth_cleanup_failures: authCleanupFailures,
      });
    }

    const cleaned: Record<string, number> = {};
    cleaned.resultats = await deleteCount(admin, "resultats", session.id);
    cleaned.devoirs = await deleteCount(admin, "devoirs", session.id);

    if (body.scope === "sessions") {
      cleaned.sessions = await deleteCount(admin, "sessions", session.id);
    }

    return jsonResponse({
      tables_nettoyees: cleaned,
      sandbox_session_id: session.id,
      session_deleted: false,
      remaining_session: true,
      request_id: requestId,
    });
  } catch (error) {
    console.error("sandbox-reset failed", {
      requestId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({
      error: error instanceof Error ? error.message : "Erreur sandbox",
      request_id: requestId,
    }, (error as any)?.status ?? 500);
  }
});
