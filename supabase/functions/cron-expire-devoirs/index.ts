import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

    if (devoirs?.length) {
      const affectedLearners = new Map<string, { eleve_id: string; formateur_id: string; count: number }>();
      for (const devoir of devoirs) {
        const key = `${devoir.formateur_id}:${devoir.eleve_id}`;
        const current = affectedLearners.get(key);
        affectedLearners.set(key, {
          eleve_id: devoir.eleve_id,
          formateur_id: devoir.formateur_id,
          count: (current?.count ?? 0) + 1,
        });
      }

      const { data: activeAlerts } = await supabase
        .from("alertes")
        .select("eleve_id, formateur_id")
        .eq("type", "devoir_expire")
        .eq("is_resolved", false);
      const activeKeys = new Set(
        (activeAlerts ?? []).map((alert: any) => `${alert.formateur_id}:${alert.eleve_id}`),
      );
      const alerts = [...affectedLearners.entries()]
        .filter(([key]) => !activeKeys.has(key))
        .map(([, learner]) => ({
          eleve_id: learner.eleve_id,
          formateur_id: learner.formateur_id,
          type: "devoir_expire" as const,
          message: learner.count === 1
            ? "Un devoir vient d'expirer."
            : `${learner.count} devoirs viennent d'expirer.`,
        }));

      if (alerts.length) await supabase.from("alertes").insert(alerts);
    }
  }

  console.log(`Expired ${expired?.length || 0} devoirs`);

  return new Response(
    JSON.stringify({ success: true, expired: expired?.length || 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
