import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: hasRole } = await admin.rpc("has_role", {
      _user_id: caller.id,
      _role: "formateur",
    });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Reserve aux formateurs" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const eleve_id = String(body.eleve_id || "").trim();
    const new_email = body.new_email ? String(body.new_email).trim().toLowerCase() : "";
    const new_password = body.new_password ? String(body.new_password).trim() : "";

    if (!eleve_id) {
      return new Response(JSON.stringify({ error: "eleve_id requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!new_email && !new_password) {
      return new Response(JSON.stringify({ error: "Aucune modification demandee" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
      return new Response(JSON.stringify({ error: "Email invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new_password && new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Mot de passe : 6 caracteres minimum" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await admin
      .from("group_members")
      .select("group_id, groups!inner(formateur_id)")
      .eq("eleve_id", eleve_id)
      .eq("groups.formateur_id", caller.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Eleve introuvable dans vos groupes" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUpdate: Record<string, unknown> = {};
    if (new_email) {
      authUpdate.email = new_email;
      authUpdate.email_confirm = true;
    }
    if (new_password) authUpdate.password = new_password;

    const { error: authErr } = await admin.auth.admin.updateUserById(eleve_id, authUpdate);
    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileUpdate: Record<string, unknown> = { status: "approved" };
    if (new_email) profileUpdate.email = new_email;
    if (new_password) profileUpdate.mot_de_passe_initial = null;

    const { error: profileErr } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", eleve_id);
    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      email: new_email || null,
      password: new_password || null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("update-student-credentials error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
