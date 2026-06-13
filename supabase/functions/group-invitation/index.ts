import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
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
    const { action, code } = await req.json().catch(() => ({})) as {
      action?: "validate" | "join";
      code?: string;
    };
    const normalizedCode = String(code ?? "").replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6) return json({ error: "Code invalide ou expiré." }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: invitation, error: invitationError } = await admin
      .from("group_invitations")
      .select("id, group_id, expires_at, used_count, group:groups(id, nom, niveau, is_active)")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (invitationError) throw invitationError;

    const group = invitation?.group as {
      id: string;
      nom: string;
      niveau: string;
      is_active: boolean;
    } | null;
    if (
      !invitation ||
      !group?.is_active ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      return json({ error: "Code invalide ou expiré." }, 404);
    }

    if (action === "validate") {
      return json({ valid: true, group: { nom: group.nom, niveau: group.niveau } });
    }
    if (action !== "join") return json({ error: "Action invalide." }, 400);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Connexion requise." }, 401);
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Connexion requise." }, 401);

    const { data: role } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "eleve")
      .maybeSingle();
    if (!role) return json({ error: "Accès réservé aux élèves." }, 403);

    const { data: existingMembership, error: membershipLookupError } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", invitation.group_id)
      .eq("eleve_id", user.id)
      .maybeSingle();
    if (membershipLookupError) throw membershipLookupError;
    if (existingMembership) {
      return json({
        joined: true,
        already_member: true,
        group: { id: group.id, nom: group.nom, niveau: group.niveau },
      });
    }

    const { error: memberError } = await admin
      .from("group_members")
      .insert({ group_id: invitation.group_id, eleve_id: user.id });
    if (memberError) throw memberError;

    await admin
      .from("group_invitations")
      .update({ used_count: Number(invitation.used_count ?? 0) + 1 })
      .eq("id", invitation.id);

    return json({
      joined: true,
      group: { id: group.id, nom: group.nom, niveau: group.niveau },
    });
  } catch (error) {
    console.error("group-invitation failed", error);
    return json({ error: "Le rattachement au groupe est momentanément impossible." }, 500);
  }
});
