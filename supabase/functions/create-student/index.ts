import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is a formateur
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller has formateur role
    const { data: hasRole } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "formateur",
    });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Réservé aux formateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prenom, nom, group_id } = await req.json();

    if (!prenom?.trim() || !nom?.trim() || !group_id?.trim()) {
      return new Response(JSON.stringify({ error: "Prénom, nom et groupe sont obligatoires" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPrenom = prenom.trim();
    const cleanNom = nom.trim();

    // Verify the group belongs to this formateur
    const { data: group } = await adminClient
      .from("groups")
      .select("id, formateur_id")
      .eq("id", group_id)
      .single();

    if (!group || group.formateur_id !== caller.id) {
      return new Response(JSON.stringify({ error: "Groupe introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate unique fake email and simple password
    const slug = `${cleanPrenom}.${cleanNom}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9.]/g, "");
    const uniqueId = crypto.randomUUID().slice(0, 6);
    const fakeEmail = `${slug}.${uniqueId}@tcf.local`;
    const password = "123456";

    // Create auth user with auto-confirm
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
      user_metadata: { prenom: cleanPrenom, nom: cleanNom, role: "eleve" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Add to group
    const { error: memberError } = await adminClient
      .from("group_members")
      .insert({ group_id, eleve_id: userId });

    if (memberError) {
      console.error("Member insert error:", memberError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        student: {
          id: userId,
          prenom: cleanPrenom,
          nom: cleanNom,
          email: fakeEmail,
          password,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
