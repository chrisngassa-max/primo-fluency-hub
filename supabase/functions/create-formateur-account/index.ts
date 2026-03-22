import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const email = "formateur@captcf.fr";
  const password = "CapTcf2025!";

  // Check if user already exists
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ message: "Le compte existe déjà", email }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nom: "Formateur", prenom: "CAP TCF", role: "formateur" },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true, email, password, userId: data.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
