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

  // Get all formateurs and their parametres
  const { data: parametres } = await supabase
    .from("parametres")
    .select("formateur_id, alerte_absence_heures");

  if (!parametres || parametres.length === 0) {
    return new Response(
      JSON.stringify({ success: true, alerts_created: 0, message: "No parametres configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let totalAlerts = 0;

  for (const param of parametres) {
    const seuilHeures = param.alerte_absence_heures || 48;
    const threshold = new Date(Date.now() - seuilHeures * 60 * 60 * 1000).toISOString();

    // Get all students in formateur's groups
    const { data: members } = await supabase
      .from("group_members")
      .select("eleve_id, group:groups!inner(formateur_id)")
      .eq("group.formateur_id", param.formateur_id);

    if (!members || members.length === 0) continue;

    const eleveIds = [...new Set(members.map((m: any) => m.eleve_id))];

    // Check last_login for each student
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, last_login")
      .in("id", eleveIds);

    if (!profiles) continue;

    const inactiveStudents = profiles.filter((p: any) => {
      if (!p.last_login) return true; // Never logged in
      return p.last_login < threshold;
    });

    if (inactiveStudents.length === 0) continue;

    // Check for existing unresolved absence alerts to avoid duplicates
    const { data: existingAlerts } = await supabase
      .from("alertes")
      .select("eleve_id")
      .eq("formateur_id", param.formateur_id)
      .eq("type", "absence")
      .eq("is_resolved", false)
      .in("eleve_id", inactiveStudents.map((s: any) => s.id));

    const existingSet = new Set((existingAlerts || []).map((a: any) => a.eleve_id));

    const newAlerts = inactiveStudents
      .filter((s: any) => !existingSet.has(s.id))
      .map((s: any) => ({
        eleve_id: s.id,
        formateur_id: param.formateur_id,
        type: "absence" as const,
        message: `Élève inactif depuis plus de ${seuilHeures}h`,
      }));

    if (newAlerts.length > 0) {
      await supabase.from("alertes").insert(newAlerts);
      totalAlerts += newAlerts.length;
    }
  }

  console.log(`Created ${totalAlerts} absence alerts`);

  return new Response(
    JSON.stringify({ success: true, alerts_created: totalAlerts }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
