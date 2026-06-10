import {
  corsHeaders,
  getSandboxClients,
  jsonResponse,
} from "../_shared/sandbox-edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const { data: session, error } = await admin
      .from("sandbox_sessions")
      .select("*")
      .eq("formateur_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!session) {
      return jsonResponse({
        session: null,
        counts: {
          groups: 0,
          group_members: 0,
          profils_eleves: 0,
          resultats: 0,
          devoirs: 0,
          sessions: 0,
        },
      });
    }

    if (session.statut === "active" && new Date(session.expires_at) <= new Date()) {
      session.statut = "expired";
      await admin.from("sandbox_sessions").update({ statut: "expired" }).eq("id", session.id);
    }

    const [groupResult, groups, groupMembers, profilsEleves, resultats, devoirs, sessions] = await Promise.all([
      session.group_id
        ? admin.from("groups").select("id, nom").eq("id", session.group_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("groups").select("id", { count: "exact", head: true }).eq("sandbox_session_id", session.id),
      admin.from("group_members").select("id", { count: "exact", head: true }).eq("sandbox_session_id", session.id),
      admin.from("profils_eleves").select("id", { count: "exact", head: true }).eq("sandbox_session_id", session.id),
      admin.from("resultats").select("id", { count: "exact", head: true }).eq("sandbox_session_id", session.id),
      admin.from("devoirs").select("id", { count: "exact", head: true }).eq("sandbox_session_id", session.id),
      admin.from("sessions").select("id", { count: "exact", head: true }).eq("sandbox_session_id", session.id),
    ]);

    return jsonResponse({
      session: { ...session, group: groupResult.data ?? null },
      counts: {
        groups: groups.count ?? 0,
        group_members: groupMembers.count ?? 0,
        profils_eleves: profilsEleves.count ?? 0,
        resultats: resultats.count ?? 0,
        devoirs: devoirs.count ?? 0,
        sessions: sessions.count ?? 0,
      },
    });
  } catch (error) {
    console.error("sandbox-status failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur sandbox" }, (error as any)?.status ?? 500);
  }
});
