import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is a formateur
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check caller is formateur
    const { data: isFormateur } = await adminClient.rpc("has_role", { _user_id: caller.id, _role: "formateur" });
    if (!isFormateur) {
      return new Response(JSON.stringify({ error: "Accès réservé aux formateurs" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { student_id, group_id, new_group_name, new_group_niveau } = await req.json();

    if (!student_id) {
      return new Response(JSON.stringify({ error: "student_id requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let targetGroupId = group_id;

    // Create new group if requested
    if (!targetGroupId && new_group_name) {
      const { data: newGroup, error: groupError } = await adminClient
        .from("groups")
        .insert({ nom: new_group_name, niveau: new_group_niveau || "A1", formateur_id: caller.id })
        .select("id")
        .single();
      if (groupError) {
        return new Response(JSON.stringify({ error: `Erreur création groupe: ${groupError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      targetGroupId = newGroup.id;
    }

    if (!targetGroupId) {
      return new Response(JSON.stringify({ error: "group_id ou new_group_name requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Approve student - update status
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ status: "approved" })
      .eq("id", student_id);
    if (updateError) {
      return new Response(JSON.stringify({ error: `Erreur approbation: ${updateError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Add student to group
    const { error: memberError } = await adminClient
      .from("group_members")
      .insert({ group_id: targetGroupId, eleve_id: student_id })
      .select()
      .single();
    if (memberError && !memberError.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: `Erreur ajout groupe: ${memberError.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, group_id: targetGroupId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
