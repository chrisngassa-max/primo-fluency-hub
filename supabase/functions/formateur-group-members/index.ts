import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const cleanText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const SANDBOX_NAMES_BY_LEVEL: Record<string, { prenom: string; nom: string }> = {
  A1: { prenom: "Mina", nom: "Diallo" },
  A2: { prenom: "Youssef", nom: "Benali" },
  B1: { prenom: "Olena", nom: "Kravchenko" },
  B2: { prenom: "Lucas", nom: "Martins" },
};

function namesFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const prenom = cleanText(metadata?.prenom) || cleanText(metadata?.first_name) || cleanText(metadata?.given_name);
  const nom = cleanText(metadata?.nom) || cleanText(metadata?.last_name) || cleanText(metadata?.family_name);
  const displayName = cleanText(metadata?.display_name) || cleanText(metadata?.full_name) || cleanText(metadata?.name);
  const parts = displayName.split(/\s+/).filter(Boolean);
  return {
    prenom: prenom || (parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? ""),
    nom: nom || (parts.length > 1 ? parts[parts.length - 1] : ""),
  };
}

function namesFromDisplayName(displayName: unknown) {
  const parts = cleanText(displayName).split(/\s+/).filter(Boolean);
  return {
    prenom: parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "",
    nom: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

function namesFromSandboxStudent(student: any) {
  const fromDisplayName = namesFromDisplayName(student?.display_name);
  const fromLevel = SANDBOX_NAMES_BY_LEVEL[cleanText(student?.niveau)] ?? { prenom: "", nom: "" };
  return {
    prenom: fromDisplayName.prenom || fromLevel.prenom,
    nom: fromDisplayName.nom || fromLevel.nom,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Non autorisé" }, 401);

    const { data: role } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "formateur")
      .maybeSingle();
    if (!role) return json({ error: "Réservé aux formateurs" }, 403);

    const { data: groups, error: groupsError } = await admin
      .from("groups")
      .select("id, sandbox_session_id")
      .eq("formateur_id", user.id);
    if (groupsError) throw groupsError;

    const sandboxIds = [...new Set((groups ?? [])
      .map((group: any) => group.sandbox_session_id)
      .filter(Boolean))];
    const { data: activeSandboxes, error: sandboxError } = sandboxIds.length
      ? await admin
        .from("sandbox_sessions")
        .select("id, eleve_emails")
        .eq("formateur_id", user.id)
        .eq("statut", "active")
        .gt("expires_at", new Date().toISOString())
        .in("id", sandboxIds)
      : { data: [], error: null };
    if (sandboxError) throw sandboxError;
    const allowedSandboxIds = new Set((activeSandboxes ?? []).map((sandbox: any) => sandbox.id));
    const sandboxStudentById = new Map<string, any>();
    for (const sandbox of activeSandboxes ?? []) {
      for (const student of sandbox.eleve_emails ?? []) {
        if (student?.user_id) sandboxStudentById.set(student.user_id, student);
      }
    }
    const groupIds = (groups ?? [])
      .filter((group: any) => !group.sandbox_session_id || allowedSandboxIds.has(group.sandbox_session_id))
      .map((group: any) => group.id);
    if (groupIds.length === 0) return json({ members: [] });

    const { data: members, error: membersError } = await admin
      .from("group_members")
      .select("id, group_id, eleve_id, joined_at, sandbox_session_id")
      .in("group_id", groupIds);
    if (membersError) throw membersError;

    const visibleMembers = (members ?? []).filter(
      (member: any) => !member.sandbox_session_id || allowedSandboxIds.has(member.sandbox_session_id),
    );
    const eleveIds = [...new Set(visibleMembers.map((member: any) => member.eleve_id).filter(Boolean))];
    const { data: profiles, error: profilesError } = eleveIds.length
      ? await admin
        .from("profiles")
        .select("id, nom, prenom, email, mot_de_passe_initial")
        .in("id", eleveIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    const authFallbacks = await Promise.all(eleveIds.map(async (eleveId) => {
      const { data } = await admin.auth.admin.getUserById(eleveId);
      const authUser = data?.user;
      if (!authUser) return null;
      const metadataNames = namesFromMetadata(authUser.user_metadata);
      return {
        id: eleveId,
        nom: metadataNames.nom,
        prenom: metadataNames.prenom,
        email: authUser.email ?? "",
        mot_de_passe_initial: null,
      };
    }));
    const fallbackById = new Map(authFallbacks.filter(Boolean).map((profile: any) => [profile.id, profile]));
    const profileRepairs: Promise<unknown>[] = [];
    const normalized = visibleMembers.map((member: any) => {
      const profile = profileById.get(member.eleve_id) as any | undefined;
      const fallback = fallbackById.get(member.eleve_id) as any | undefined;
      const sandboxStudent = sandboxStudentById.get(member.eleve_id);
      const sandboxNames = namesFromSandboxStudent(sandboxStudent);
      const mergedProfile = profile || fallback
        ? {
          id: member.eleve_id,
          nom: cleanText(profile?.nom) || cleanText(fallback?.nom) || sandboxNames.nom,
          prenom: cleanText(profile?.prenom) || cleanText(fallback?.prenom) || sandboxNames.prenom,
          email: cleanText(profile?.email) || cleanText(fallback?.email) || cleanText(sandboxStudent?.email),
          mot_de_passe_initial: profile?.mot_de_passe_initial ?? fallback?.mot_de_passe_initial ?? null,
        }
        : sandboxStudent
        ? {
          id: member.eleve_id,
          nom: sandboxNames.nom,
          prenom: sandboxNames.prenom,
          email: cleanText(sandboxStudent.email),
          mot_de_passe_initial: null,
        }
        : null;
      if (profile && sandboxStudent && mergedProfile && (!cleanText(profile.nom) || !cleanText(profile.prenom) || !cleanText(profile.email))) {
        profileRepairs.push(admin.from("profiles").update({
          nom: mergedProfile.nom,
          prenom: mergedProfile.prenom,
          email: mergedProfile.email,
          status: "approved",
        }).eq("id", member.eleve_id));
      }
      return {
        ...member,
        eleve: mergedProfile,
        eleve_missing_profile: !profileById.has(member.eleve_id),
      };
    });
    if (profileRepairs.length) {
      const repairResults = await Promise.allSettled(profileRepairs);
      repairResults.forEach((result) => {
        if (result.status === "rejected") console.warn("sandbox profile repair failed", result.reason?.message ?? result.reason);
      });
    }

    return json({ members: normalized });
  } catch (error) {
    console.error("formateur-group-members error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});