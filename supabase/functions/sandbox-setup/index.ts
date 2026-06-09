import {
  corsHeaders,
  createReadablePassword,
  deleteAuthUsers,
  deleteSandboxRows,
  getSandboxClients,
  jsonResponse,
} from "../_shared/sandbox-edge.ts";
import type {
  EleveSandbox,
  NiveauSandbox,
  SandboxSetupRequest,
} from "../_shared/sandbox.types.ts";

const LEVELS: NiveauSandbox[] = ["A1", "A2", "B1", "B2"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin, user } = await getSandboxClients(req);
    const body = await req.json().catch(() => ({})) as SandboxSetupRequest;
    const { data: current, error: currentError } = await admin
      .from("sandbox_sessions")
      .select("*")
      .eq("formateur_id", user.id)
      .maybeSingle();
    if (currentError) throw currentError;

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
      await deleteAuthUsers(admin, current.eleve_user_ids);
      await deleteSandboxRows(admin, current.id);
      const { error } = await admin.from("sandbox_sessions").delete().eq("id", current.id);
      if (error) throw error;
    }

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

    const shortId = sandbox.id.replaceAll("-", "").slice(0, 8);
    const created: EleveSandbox[] = [];
    for (const niveau of LEVELS) {
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
          prenom: "Eleve Test",
          nom: niveau,
        },
      });
      if (error || !data.user) throw error ?? new Error("Compte sandbox non cree");

      created.push({
        niveau,
        email,
        user_id: data.user.id,
        display_name: `Eleve Test ${niveau}`,
        mot_de_passe_initial: password,
      });
      const { error: checkpointError } = await admin
        .from("sandbox_sessions")
        .update({ eleve_user_ids: created.map((eleve) => eleve.user_id) })
        .eq("id", sandbox.id);
      if (checkpointError) throw checkpointError;
    }

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

    for (const eleve of created) {
      // Le trigger Auth cree profiles. Le mot de passe sandbox reste volontairement NULL.
      const { error: profileError } = await admin
        .from("profiles")
        .update({ mot_de_passe_initial: null, status: "approved" })
        .eq("id", eleve.user_id);
      if (profileError) throw profileError;

      const { error: roleError } = await admin
        .from("user_roles")
        .upsert({ user_id: eleve.user_id, role: "eleve" }, { onConflict: "user_id,role" });
      if (roleError) throw roleError;

      const { error: learnerError } = await admin.from("profils_eleves").upsert({
        eleve_id: eleve.user_id,
        niveau_actuel: eleve.niveau,
        niveau_co: eleve.niveau,
        niveau_ce: eleve.niveau,
        niveau_ee: eleve.niveau,
        niveau_eo: eleve.niveau,
        sandbox_session_id: sandbox.id,
      }, { onConflict: "eleve_id" });
      if (learnerError) throw learnerError;

      const { error: memberError } = await admin.from("group_members").insert({
        group_id: group.id,
        eleve_id: eleve.user_id,
        sandbox_session_id: sandbox.id,
      });
      if (memberError) throw memberError;
    }

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
    console.error("sandbox-setup failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ error: error instanceof Error ? error.message : "Erreur sandbox" }, (error as any)?.status ?? 500);
  }
});
