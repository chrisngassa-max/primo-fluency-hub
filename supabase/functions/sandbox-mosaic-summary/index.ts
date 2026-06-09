import {
  corsHeaders,
  getSandboxClients,
  jsonResponse,
  resolveSandboxPreviewStudent,
} from "../_shared/sandbox-edge.ts";
import type { NiveauSandbox } from "../_shared/sandbox.types.ts";

const LEVELS: NiveauSandbox[] = ["A1", "A2", "B1", "B2"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const profiles = [];
    for (const niveau of LEVELS) {
      const { session, student, learner } = await resolveSandboxPreviewStudent(admin, user.id, niveau);
      const [{ count: pending }, { count: completed }, { data: latest }] = await Promise.all([
        admin.from("devoirs").select("id", { count: "exact", head: true })
          .eq("eleve_id", student.user_id).eq("sandbox_session_id", session.id)
          .in("statut", ["en_attente", "expire"]),
        admin.from("devoirs").select("id", { count: "exact", head: true })
          .eq("eleve_id", student.user_id).eq("sandbox_session_id", session.id)
          .in("statut", ["fait", "arrete"]),
        admin.from("resultats").select("score, created_at")
          .eq("eleve_id", student.user_id).eq("sandbox_session_id", session.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      profiles.push({
        niveau,
        display_name: student.display_name,
        competences: {
          CO: learner.niveau_co,
          CE: learner.niveau_ce,
          EE: learner.niveau_ee,
          EO: learner.niveau_eo,
        },
        score_risque: learner.score_risque,
        devoirs_en_cours: pending ?? 0,
        devoirs_termines: completed ?? 0,
        derniere_activite: latest?.created_at ?? null,
        dernier_score: latest?.score ?? null,
      });
    }
    return jsonResponse({ profils: profiles });
  } catch (error) {
    console.error("sandbox-mosaic-summary failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur mosaique" }, (error as any)?.status ?? 500);
  }
});
