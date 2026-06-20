import {
  corsHeaders,
  getSandboxClients,
  jsonResponse,
  resolveSandboxPreviewStudent,
} from "../_shared/sandbox-edge.ts";
import type { NiveauSandbox } from "../_shared/sandbox.types.ts";

type Resource = "dashboard" | "devoirs" | "exercice" | "sessions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const body = await req.json().catch(() => ({})) as {
      niveau?: NiveauSandbox;
      resource?: Resource;
      payload?: { devoir_id?: string };
    };
    if (!body.niveau || !body.resource) return jsonResponse({ error: "Requete incomplete" }, 400);

    let resolved;
    try {
      resolved = await resolveSandboxPreviewStudent(admin, user.id, body.niveau);
    } catch (resolveError) {
      console.warn(
        `sandbox preview ${body.niveau} degraded`,
        resolveError instanceof Error ? resolveError.message : "unknown",
      );
      if (body.resource === "dashboard") {
        return jsonResponse({
          niveau: body.niveau,
          display_name: `Eleve Test ${body.niveau}`,
          profil: {
            niveau_actuel: body.niveau,
            niveau_co: body.niveau,
            niveau_ce: body.niveau,
            niveau_ee: body.niveau,
            niveau_eo: body.niveau,
            taux_reussite_global: 0,
            score_risque: 0,
            priorites_pedagogiques: [],
          },
          devoirs: { en_cours: 0, termines: 0 },
          resultats_recents: [],
          degraded: true,
        });
      }
      if (body.resource === "devoirs") {
        return jsonResponse({ niveau: body.niveau, devoirs: [], degraded: true });
      }
      if (body.resource === "sessions") {
        return jsonResponse({ niveau: body.niveau, sessions: [], degraded: true });
      }
      throw resolveError;
    }
    const { session, student, learner } = resolved;

    if (body.resource === "dashboard") {
      const [{ count: pending }, { count: completed }, { data: recent }] = await Promise.all([
        admin.from("devoirs").select("id", { count: "exact", head: true })
          .eq("eleve_id", student.user_id).eq("sandbox_session_id", session.id)
          .in("statut", ["en_attente", "expire"]),
        admin.from("devoirs").select("id", { count: "exact", head: true })
          .eq("eleve_id", student.user_id).eq("sandbox_session_id", session.id)
          .in("statut", ["fait", "arrete"]),
        admin.from("resultats").select("id, score, created_at")
          .eq("eleve_id", student.user_id).eq("sandbox_session_id", session.id)
          .order("created_at", { ascending: false }).limit(5),
      ]);
      return jsonResponse({
        niveau: body.niveau,
        display_name: student.display_name,
        profil: learner,
        devoirs: { en_cours: pending ?? 0, termines: completed ?? 0 },
        resultats_recents: recent ?? [],
      });
    }

    if (body.resource === "devoirs") {
      const { data, error } = await admin
        .from("devoirs")
        .select("id, statut, raison, date_echeance, nb_reussites_consecutives, exercice:exercices(id, titre, consigne, competence, format, niveau_vise)")
        .eq("eleve_id", student.user_id)
        .eq("sandbox_session_id", session.id)
        .order("date_echeance", { ascending: true });
      if (error) throw error;
      return jsonResponse({ niveau: body.niveau, devoirs: data ?? [] });
    }

    if (body.resource === "sessions") {
      // Vue formateur : pour chaque eleve, la seance precedente (evaluation, terminee)
      // et la prochaine seance (diagnostic, planifiee) avec les types de questions.
      const [{ data: sessionRows }, { data: devoirs }] = await Promise.all([
        admin
          .from("sessions")
          .select("id, titre, statut, date_seance, niveau_cible, competences_cibles, objectifs")
          .eq("sandbox_session_id", session.id)
          .order("date_seance", { ascending: true }),
        admin
          .from("devoirs")
          .select(
            "id, statut, raison, date_echeance, session_id, source_label, exercice:exercices(id, titre, competence, format, niveau_vise, difficulte)",
          )
          .eq("eleve_id", student.user_id)
          .eq("sandbox_session_id", session.id)
          .order("date_echeance", { ascending: true }),
      ]);
      const grouped = (sessionRows ?? []).map((seance: any) => ({
        id: seance.id,
        titre: seance.titre,
        statut: seance.statut,
        date_seance: seance.date_seance,
        niveau_cible: seance.niveau_cible,
        competences_cibles: seance.competences_cibles,
        objectifs: seance.objectifs,
        role: seance.statut === "terminee" ? "evaluation" : "diagnostic",
        questions: (devoirs ?? []).filter((devoir: any) => devoir.session_id === seance.id),
      }));
      return jsonResponse({
        niveau: body.niveau,
        display_name: student.display_name,
        sessions: grouped,
      });
    }

    const devoirId = body.payload?.devoir_id;
    if (!devoirId) return jsonResponse({ error: "devoir_id requis" }, 400);
    const { data: devoir, error } = await admin
      .from("devoirs")
      .select("id, statut, date_echeance, exercice:exercices(id, titre, consigne, competence, format, niveau_vise, contenu)")
      .eq("id", devoirId)
      .eq("eleve_id", student.user_id)
      .eq("sandbox_session_id", session.id)
      .maybeSingle();
    if (error) throw error;
    if (!devoir) return jsonResponse({ error: "Devoir sandbox introuvable" }, 404);
    const exercice = devoir.exercice as any;
    if (!["qcm", "vrai_faux"].includes(exercice?.format)) {
      return jsonResponse({ error: "Cet apercu prend actuellement en charge les QCM et vrai/faux" }, 422);
    }
    const safeItems = ((exercice?.contenu?.items ?? []) as any[]).map(
      ({ bonne_reponse: _answer, correction: _correction, ...item }) => item,
    );
    return jsonResponse({
      niveau: body.niveau,
      devoir: {
        ...devoir,
        exercice: { ...exercice, contenu: { ...exercice.contenu, items: safeItems } },
      },
    });
  } catch (error) {
    console.error("sandbox-preview-data failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur apercu" }, (error as any)?.status ?? 500);
  }
});
