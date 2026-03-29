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

  // Expire overdue devoirs
  const { data: expired, error } = await supabase
    .from("devoirs")
    .update({ statut: "expire", updated_at: new Date().toISOString() })
    .eq("statut", "en_attente")
    .lt("date_echeance", new Date().toISOString())
    .select("id, eleve_id");

  if (error) {
    console.error("Error expiring devoirs:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Generate alerts for expired devoirs
  if (expired && expired.length > 0) {
    // Get formateur for each devoir
    const { data: devoirs } = await supabase
      .from("devoirs")
      .select("id, eleve_id, formateur_id")
      .in("id", expired.map((d: any) => d.id));

    if (devoirs) {
      const alerts = devoirs.map((d: any) => ({
        eleve_id: d.eleve_id,
        formateur_id: d.formateur_id,
        type: "devoir_expire" as const,
        message: `Devoir expiré automatiquement (${d.id})`,
      }));

      await supabase.from("alertes").insert(alerts);
    }
  }

  console.log(`Expired ${expired?.length || 0} devoirs`);

  return new Response(
    JSON.stringify({ success: true, expired: expired?.length || 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
