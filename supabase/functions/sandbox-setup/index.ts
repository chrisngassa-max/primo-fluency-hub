import {
  corsHeaders,
  createReadablePassword,
  deleteAuthUsers,
  deleteSandboxRows,
  getErrorDetails,
  getSandboxClients,
  jsonResponse,
} from "../_shared/sandbox-edge.ts";
import type {
  EleveSandbox,
  NiveauSandbox,
  SandboxSetupRequest,
} from "../_shared/sandbox.types.ts";
import {
  buildSandboxHistory,
  buildSandboxSessions,
  buildUpcomingDiagnostic,
  SANDBOX_LEARNER_FIXTURES,
} from "../_shared/sandbox-fixtures.ts";

const LEVELS: NiveauSandbox[] = ["A1", "A2", "B1", "B2"];

function isMissingSandboxSchema(error: any) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return ["42p01", "42703", "pgrst204", "pgrst205"].includes(
    String(error?.code ?? "").toLowerCase(),
  ) || message.includes("sandbox_sessions") ||
    (message.includes("sandbox_session_id") && message.includes("column"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let cleanupAdmin: any = null;
  let cleanupSandboxId: string | null = null;
  let cleanupUserIds: string[] = [];
  let provisioningStep = "authenticate";

  try {
    const { admin, user } = await getSandboxClients(req);
    cleanupAdmin = admin;
    provisioningStep = "load_existing_sandbox";
    const body = await req.json().catch(() => ({})) as SandboxSetupRequest;
    const { data: current, error: currentError } = await admin
      .from("sandbox_sessions")
      .select("*")
      .eq("formateur_id", user.id)
      .maybeSingle();
    if (currentError) {
      if (isMissingSandboxSchema(currentError)) {
        return jsonResponse({
          error: "La base de donnees Sandbox n'est pas initialisee. Appliquez les migrations Supabase avant de recommencer.",
          code: "SANDBOX_NOT_PROVISIONED",
        }, 503);
      }
      throw currentError;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (current && !body.force_recreate && ["active", "expired"].includes(current.statut)) {
      const reactivated = current.statut === "expired" || new Date(current.expires_at) <= new Date();
      const { data: updated, error } = await admin
        .from("sandbox_sessions")
        .update({
          statut: "active",
          expires_at: expiresAt,
          last_activity: new Date().toISOString(),
        })
        .eq("id", current.id)
        .select("*")
        .single();
      if (error) throw error;
      return jsonResponse({
        sandbox_session_id: updated.id,
        group_id: updated.group_id,
        groupe_id: updated.group_id,
        eleves: updated.eleve_emails,
        expires_at: updated.expires_at,
        message: reactivated ? "reactivated" : "existing",
      });
    }

    const isResume = current?.statut === "provisioning" && !body.force_recreate;
    if (current) {
      provisioningStep = "cleanup_existing_sandbox";
      cleanupSandboxId = current.id;
      cleanupUserIds = current.eleve_user_ids ?? [];
      await deleteSandboxRows(admin, current.id);
      await deleteAuthUsers(admin, cleanupUserIds);
      const { error } = await admin.from("sandbox_sessions").delete().eq("id", current.id);
      if (error) throw error;
      cleanupSandboxId = null;
      cleanupUserIds = [];
    }

    provisioningStep = "load_compatible_exercises";
    const { data: exercises, error: exercisesError } = await admin
      .from("exercices")
      .select("id, niveau_vise, difficulte, competence, format")
      .in("format", ["qcm", "vrai_faux"])
      .order("created_at", { ascending: false })
      .limit(80);
    if (exercisesError) throw exercisesError;
    if (!exercises?.length) {
      throw Object.assign(new Error("Aucun exercice QCM ou vrai/faux disponible pour initialiser la sandbox"), {
        status: 422,
      });
    }

    provisioningStep = "create_sandbox_session";
    const { data: sandbox, error: sandboxError } = await admin
      .from("sandbox_sessions")
      .insert({
        formateur_id: user.id,
        statut: "provisioning",
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (sandboxError) throw sandboxError;
    cleanupSandboxId = sandbox.id;

    const shortId = sandbox.id.replaceAll("-", "").slice(0, 8);
    const created: EleveSandbox[] = [];
    for (const niveau of LEVELS) {
      provisioningStep = `create_auth_user_${niveau}`;
      const fixture = SANDBOX_LEARNER_FIXTURES[niveau];
      const password = createReadablePassword();
      const email = `sandbox-${niveau.toLowerCase()}-${shortId}@sandbox.captcf.local`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "eleve",
          niveau,
          sandbox_session_id: sandbox.id,
          prenom: fixture.prenom,
          nom: fixture.nom,
        },
      });
      if (error || !data.user) throw error ?? new Error("Compte sandbox non cree");

      created.push({
        niveau,
        email,
        user_id: data.user.id,
        display_name: `${fixture.prenom} ${fixture.nom}`,
        mot_de_passe_initial: password,
      });
      cleanupUserIds = created.map((eleve) => eleve.user_id);
      const persistedCheckpoint = created.map(({ mot_de_passe_initial: _password, ...eleve }) => eleve);
      const { error: checkpointError } = await admin
        .from("sandbox_sessions")
        .update({
          eleve_user_ids: cleanupUserIds,
          eleve_emails: persistedCheckpoint,
          last_activity: new Date().toISOString(),
        })
        .eq("id", sandbox.id);
      if (checkpointError) throw checkpointError;
    }

    provisioningStep = "create_group";
    const trainerName = user.user_metadata?.prenom || "Formateur";
    const { data: group, error: groupError } = await admin
      .from("groups")
      .insert({
        formateur_id: user.id,
        nom: `Sandbox - ${trainerName}`,
        niveau: "A1",
        description: "Environnement de test isole",
        sandbox_session_id: sandbox.id,
      })
      .select("id")
      .single();
    if (groupError) throw groupError;
    const { error: groupCheckpointError } = await admin
      .from("sandbox_sessions")
      .update({ group_id: group.id, last_activity: new Date().toISOString() })
      .eq("id", sandbox.id);
    if (groupCheckpointError) throw groupCheckpointError;

    provisioningStep = "create_sessions";
    const { data: seededSessions, error: sessionsError } = await admin
      .from("sessions")
      .insert(buildSandboxSessions(group.id, sandbox.id))
      .select("id, statut");
    if (sessionsError) throw sessionsError;
    const previousSession = seededSessions?.find((session: any) => session.statut === "terminee");
    const currentSession = seededSessions?.find((session: any) => session.statut === "planifiee");
    if (!previousSession || !currentSession) throw new Error("Seances sandbox non creees");

    provisioningStep = "attach_retrospective_exercises";
    const retrospectiveExerciseIds = exercises.slice(0, 5).map((exercise: any) => exercise.id);
    const { error: sessionExerciseError } = await admin.from("session_exercices").insert(
      retrospectiveExerciseIds.map((exerciseId: string, index: number) => ({
        session_id: previousSession.id,
        exercice_id: exerciseId,
        statut: "traite_en_classe",
        ordre: index + 1,
        bloc: "core",
      })),
    );
    if (sessionExerciseError) throw sessionExerciseError;

    provisioningStep = "create_session_blocks";
    const { error: blockError } = await admin.from("session_blocks").insert([
      { session_id: currentSession.id, block_type: "retrospective", status: "ready" },
      { session_id: currentSession.id, block_type: "diagnostic", status: "ready" },
      { session_id: currentSession.id, block_type: "core", status: "ready" },
    ]);
    if (blockError) throw blockError;

    for (const eleve of created) {
      provisioningStep = `seed_learner_${eleve.niveau}`;
      const fixture = SANDBOX_LEARNER_FIXTURES[eleve.niveau];
      // Le trigger Auth cree profiles. Le mot de passe sandbox reste volontairement NULL.
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          prenom: fixture.prenom,
          nom: fixture.nom,
          mot_de_passe_initial: null,
          status: "approved",
        })
        .eq("id", eleve.user_id);
      if (profileError) throw profileError;

      const { error: roleError } = await admin
        .from("user_roles")
        .upsert({ user_id: eleve.user_id, role: "eleve" }, { onConflict: "user_id,role" });
      if (roleError) throw roleError;

      const { error: learnerError } = await admin.from("profils_eleves").upsert({
        eleve_id: eleve.user_id,
        ...fixture.profile,
        niveau_source: "manuel",
        niveau_locked: false,
        sandbox_session_id: sandbox.id,
      }, { onConflict: "eleve_id" });
      if (learnerError) throw learnerError;

      const { error: memberError } = await admin.from("group_members").insert({
        group_id: group.id,
        eleve_id: eleve.user_id,
        sandbox_session_id: sandbox.id,
      });
      if (memberError) throw memberError;

      const levelExercises = exercises.filter((exercise: any) => exercise.niveau_vise === eleve.niveau);
      const selectedExercises = (levelExercises.length ? levelExercises : exercises).slice(0, 5);
      const history = buildSandboxHistory(
        fixture,
        selectedExercises.map((exercise: any) => exercise.id),
      );
      const devoirRows: Record<string, unknown>[] = history.devoirs.map((devoir) => ({
        exercice_id: devoir.exercise_id,
        eleve_id: eleve.user_id,
        formateur_id: user.id,
        statut: devoir.statut,
        raison: devoir.raison,
        date_echeance: devoir.due_at,
        nb_reussites_consecutives: devoir.successes,
        session_id: previousSession.id,
        created_at: devoir.created_at,
        updated_at: devoir.created_at,
        sandbox_session_id: sandbox.id,
      }));

      // Devoir diagnostic frais rattache a la PROCHAINE seance : c'est le devoir que
      // l'eleve "recoit" pour preparer la diagnostique. Choisi au niveau de l'eleve,
      // en privilegiant la difficulte la plus elevee disponible (differenciation A1->B2).
      const diagnosticExercise = [...selectedExercises]
        .sort((a: any, b: any) => (b.difficulte ?? 0) - (a.difficulte ?? 0))[0];
      if (diagnosticExercise) {
        const upcoming = buildUpcomingDiagnostic(eleve.niveau, diagnosticExercise.id);
        devoirRows.push({
          exercice_id: upcoming.exercise_id,
          eleve_id: eleve.user_id,
          formateur_id: user.id,
          statut: upcoming.statut,
          raison: upcoming.raison,
          date_echeance: upcoming.due_at,
          nb_reussites_consecutives: 0,
          session_id: currentSession.id,
          source_label: "individualise",
          contexte: `Diagnostic preparatoire ${eleve.niveau} — prochaine seance`,
          created_at: upcoming.created_at,
          updated_at: upcoming.created_at,
          sandbox_session_id: sandbox.id,
        });
      }

      const { data: insertedDevoirs, error: devoirError } = await admin
        .from("devoirs")
        .insert(devoirRows)
        .select("id, statut");
      if (devoirError) throw devoirError;

      const completedDevoirs = (insertedDevoirs ?? []).filter(
        (devoir: any) => devoir.statut === "fait" || devoir.statut === "arrete",
      );
      const resultRows = history.resultats.map((resultat, index) => ({
        exercice_id: resultat.exercise_id,
        eleve_id: eleve.user_id,
        score: resultat.score,
        reponses_eleve: { fixture: true, tentative: index + 1 },
        correction_detaillee: {
          fixture: true,
          commentaire: resultat.score >= 80
            ? "Objectif atteint, poursuivre la consolidation."
            : "Points a reprendre lors de la prochaine seance.",
        },
        tentative: 1,
        devoir_id: resultat.devoir_index === null
          ? null
          : completedDevoirs[resultat.devoir_index]?.id ?? null,
        created_at: resultat.created_at,
        sandbox_session_id: sandbox.id,
      }));
      const { error: resultError } = await admin.from("resultats").insert(resultRows);
      if (resultError) throw resultError;

      // Les triggers de resultats peuvent recalculer le risque. La fixture reste la reference
      // visible afin que chaque profil sandbox conserve sa trajectoire pedagogique.
      const { error: finalProfileError } = await admin
        .from("profils_eleves")
        .update({ ...fixture.profile, updated_at: new Date().toISOString() })
        .eq("eleve_id", eleve.user_id)
        .eq("sandbox_session_id", sandbox.id);
      if (finalProfileError) throw finalProfileError;
    }

    // Appel/presence automatique : chaque eleve est rattache aux deux seances et marque
    // present. La feuille d'appel affiche ainsi les noms et les coches des le depart.
    provisioningStep = "mark_presences";
    const nowIso = new Date().toISOString();
    const presenceRows = created.flatMap((eleve) =>
      [previousSession.id, currentSession.id].map((sessionId) => ({
        session_id: sessionId,
        eleve_id: eleve.user_id,
        present: true,
        commentaire: null,
        updated_at: nowIso,
      }))
    );
    const { error: presenceError } = await admin
      .from("presences")
      .upsert(presenceRows, { onConflict: "session_id,eleve_id" });
    if (presenceError) throw presenceError;

    provisioningStep = "activate_sandbox";
    const persistedEleves = created.map(({ mot_de_passe_initial: _password, ...eleve }) => eleve);
    const { data: active, error: activeError } = await admin
      .from("sandbox_sessions")
      .update({
        statut: "active",
        group_id: group.id,
        eleve_user_ids: created.map((eleve) => eleve.user_id),
        eleve_emails: persistedEleves,
        expires_at: expiresAt,
        last_activity: new Date().toISOString(),
      })
      .eq("id", sandbox.id)
      .select("*")
      .single();
    if (activeError) throw activeError;

    return jsonResponse({
      sandbox_session_id: active.id,
      group_id: group.id,
      groupe_id: group.id,
      eleves: created,
      expires_at: active.expires_at,
      message: isResume ? "resumed" : "created",
    });
  } catch (error) {
    if (cleanupAdmin && cleanupSandboxId) {
      try {
        await deleteSandboxRows(cleanupAdmin, cleanupSandboxId);
      } catch (cleanupError) {
        console.error("sandbox-setup row cleanup failed", getErrorDetails(cleanupError));
      }
      try {
        await deleteAuthUsers(cleanupAdmin, cleanupUserIds);
      } catch (cleanupError) {
        console.error("sandbox-setup auth cleanup failed", getErrorDetails(cleanupError));
      }
      try {
        const { error: sessionCleanupError } = await cleanupAdmin
          .from("sandbox_sessions")
          .delete()
          .eq("id", cleanupSandboxId);
        if (sessionCleanupError) throw sessionCleanupError;
      } catch (cleanupError) {
        console.error("sandbox-setup session cleanup failed", getErrorDetails(cleanupError));
      }
    }
    const errorDetails = getErrorDetails(error);
    console.error("sandbox-setup failed", {
      step: provisioningStep,
      ...errorDetails,
    });
    if (isMissingSandboxSchema(error)) {
      return jsonResponse({
        error: "La base de donnees Sandbox n'est pas initialisee. Appliquez les migrations Supabase avant de recommencer.",
        code: "SANDBOX_NOT_PROVISIONED",
      }, 503);
    }
    return jsonResponse({
      error: errorDetails.message,
      code: "SANDBOX_SETUP_FAILED",
      postgres_code: errorDetails.code,
      details: errorDetails.details,
      hint: errorDetails.hint,
      step: provisioningStep,
    }, errorDetails.status);
  }
});
