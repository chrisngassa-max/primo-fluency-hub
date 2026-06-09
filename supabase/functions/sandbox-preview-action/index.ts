import {
  corsHeaders,
  getSandboxClients,
  jsonResponse,
  resolveSandboxPreviewStudent,
} from "../_shared/sandbox-edge.ts";
import type { NiveauSandbox } from "../_shared/sandbox.types.ts";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("fr");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const body = await req.json().catch(() => ({})) as {
      niveau?: NiveauSandbox;
      action?: "submit_devoir";
      payload?: { devoir_id?: string; answers?: Record<string, unknown> };
    };
    if (!body.niveau || body.action !== "submit_devoir" || !body.payload?.devoir_id) {
      return jsonResponse({ error: "Action invalide" }, 400);
    }

    const { session, student } = await resolveSandboxPreviewStudent(admin, user.id, body.niveau);
    const { data: devoir, error } = await admin
      .from("devoirs")
      .select("id, statut, exercice_id, nb_reussites_consecutives, exercice:exercices(id, format, contenu)")
      .eq("id", body.payload.devoir_id)
      .eq("eleve_id", student.user_id)
      .eq("sandbox_session_id", session.id)
      .maybeSingle();
    if (error) throw error;
    if (!devoir) return jsonResponse({ error: "Devoir sandbox introuvable" }, 404);
    if (devoir.statut !== "en_attente" && devoir.statut !== "expire") {
      return jsonResponse({ error: "Devoir deja termine" }, 409);
    }

    const exercice = devoir.exercice as any;
    if (!["qcm", "vrai_faux"].includes(exercice?.format)) {
      return jsonResponse({ error: "Seuls les QCM et vrai/faux sont disponibles en apercu" }, 422);
    }
    const items = Array.isArray(exercice?.contenu?.items) ? exercice.contenu.items : [];
    if (!items.length) return jsonResponse({ error: "Exercice vide" }, 422);

    const answers = body.payload.answers ?? {};
    const correction = items.map((item: any, index: number) => {
      const reponse = answers[String(index)] ?? answers[item.id] ?? "";
      const correct = normalize(reponse) === normalize(item.bonne_reponse);
      return {
        item_index: index,
        reponse_eleve: reponse,
        bonne_reponse: item.bonne_reponse,
        correct,
      };
    });
    const score = Math.round(
      (correction.filter((item: any) => item.correct).length / correction.length) * 100,
    );
    const nextConsecutive = score >= 80 ? (devoir.nb_reussites_consecutives ?? 0) + 1 : 0;
    const nextStatus = nextConsecutive >= 2 ? "arrete" : "fait";

    const { error: resultError } = await admin.from("resultats").insert({
      eleve_id: student.user_id,
      exercice_id: exercice.id,
      devoir_id: devoir.id,
      score,
      reponses_eleve: answers,
      correction_detaillee: correction,
      tentative: 1,
      sandbox_session_id: session.id,
    });
    if (resultError) throw resultError;

    const { error: updateError } = await admin
      .from("devoirs")
      .update({
        statut: nextStatus,
        nb_reussites_consecutives: nextConsecutive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", devoir.id)
      .eq("sandbox_session_id", session.id);
    if (updateError) throw updateError;

    return jsonResponse({ score, correction_detaillee: correction, devoir_statut: nextStatus });
  } catch (error) {
    console.error("sandbox-preview-action failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur apercu" }, (error as any)?.status ?? 500);
  }
});
