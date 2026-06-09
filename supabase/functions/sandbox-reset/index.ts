import {
  corsHeaders,
  deleteAuthUsers,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const body = await req.json().catch(() => ({})) as {
      scope?: SandboxResetScope;
      sandbox_session_id?: string;
    };
    if (!body.scope || !["attempts_only", "sessions", "everything"].includes(body.scope)) {
      return jsonResponse({ error: "Scope invalide" }, 400);
    }

    let query = admin.from("sandbox_sessions").select("*").eq("formateur_id", user.id);
    if (body.sandbox_session_id) query = query.eq("id", body.sandbox_session_id);
    const { data: session, error } = await query.maybeSingle();
    if (error) throw error;
    if (!session) return jsonResponse({ error: "Sandbox non autorise" }, body.sandbox_session_id ? 403 : 404);

    const cleaned: Record<string, number> = {};
    cleaned.resultats = await deleteCount(admin, "resultats", session.id);
    cleaned.devoirs = await deleteCount(admin, "devoirs", session.id);

    if (body.scope === "sessions" || body.scope === "everything") {
      cleaned.sessions = await deleteCount(admin, "sessions", session.id);
    }

    if (body.scope === "everything") {
      cleaned.group_members = await deleteCount(admin, "group_members", session.id);
      cleaned.profils_eleves = await deleteCount(admin, "profils_eleves", session.id);
      cleaned.groups = await deleteCount(admin, "groups", session.id);
      await deleteAuthUsers(admin, session.eleve_user_ids);
      const { error: updateError } = await admin
        .from("sandbox_sessions")
        .update({
          statut: "reset",
          group_id: null,
          eleve_user_ids: [],
          eleve_emails: [],
          last_activity: new Date().toISOString(),
        })
        .eq("id", session.id)
        .eq("formateur_id", user.id);
      if (updateError) throw updateError;
    }

    return jsonResponse({ tables_nettoyees: cleaned, sandbox_session_id: session.id });
  } catch (error) {
    console.error("sandbox-reset failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur sandbox" }, (error as any)?.status ?? 500);
  }
});
