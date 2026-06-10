import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        .select("id")
        .eq("formateur_id", user.id)
        .eq("statut", "active")
        .gt("expires_at", new Date().toISOString())
        .in("id", sandboxIds)
      : { data: [], error: null };
    if (sandboxError) throw sandboxError;
    const allowedSandboxIds = new Set((activeSandboxes ?? []).map((sandbox: any) => sandbox.id));
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
      return {
        id: eleveId,
        nom: authUser.user_metadata?.nom ?? "",
        prenom: authUser.user_metadata?.prenom ?? "",
        email: authUser.email ?? "",
        mot_de_passe_initial: null,
      };
    }));
    const fallbackById = new Map(authFallbacks.filter(Boolean).map((profile: any) => [profile.id, profile]));
    const normalized = visibleMembers.map((member: any) => {
      const profile = profileById.get(member.eleve_id) as any | undefined;
      const fallback = fallbackById.get(member.eleve_id) as any | undefined;
      const mergedProfile = profile || fallback
        ? {
          id: member.eleve_id,
          nom: profile?.nom || fallback?.nom || "",
          prenom: profile?.prenom || fallback?.prenom || "",
          email: profile?.email || fallback?.email || "",
          mot_de_passe_initial: profile?.mot_de_passe_initial ?? fallback?.mot_de_passe_initial ?? null,
        }
        : null;
      return {
        ...member,
        eleve: mergedProfile,
        eleve_missing_profile: !profileById.has(member.eleve_id),
      };
    });

    return json({ members: normalized });
  } catch (error) {
    console.error("formateur-group-members error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});