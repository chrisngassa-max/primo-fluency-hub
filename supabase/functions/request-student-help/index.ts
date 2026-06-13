import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const labels: Record<string, string> = {
  activite: "un exercice ou un devoir",
  audio: "l’audio ou le micro",
  connexion: "la connexion",
  comprehension: "la compréhension de la consigne",
  autre: "un autre problème",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: "Non autorisé" }, 401);

    const body = await req.json();
    const category = labels[String(body.category)] ? String(body.category) : "autre";
    const message = String(body.message || "").trim().slice(0, 500);
    const page = String(body.page || "/eleve").trim().slice(0, 200);

    const { data: memberships, error: membershipError } = await admin
      .from("group_members")
      .select("groups!inner(formateur_id)")
      .eq("eleve_id", user.id);
    if (membershipError) throw membershipError;

    const trainerIds = [...new Set((memberships ?? [])
      .map((membership: any) => membership.groups?.formateur_id)
      .filter(Boolean))];
    if (trainerIds.length === 0) {
      return json({ error: "Aucun formateur n’est associé à ton compte." }, 404);
    }

    const studentName = [
      user.user_metadata?.prenom,
      user.user_metadata?.nom,
    ].filter(Boolean).join(" ").trim() || user.email || "Un élève";
    const detail = message ? ` Message : ${message}` : "";

    const { error: insertError } = await admin.from("notifications").insert(
      trainerIds.map((trainerId) => ({
        user_id: trainerId,
        titre: `Demande d’aide de ${studentName}`,
        message: `${studentName} signale un problème concernant ${labels[category]}.${detail}`,
        link: page.startsWith("/eleve") ? "/formateur/groupes?tab=eleves" : "/formateur",
      })),
    );
    if (insertError) throw insertError;

    return json({ success: true, recipients: trainerIds.length });
  } catch (error) {
    console.error("request-student-help error", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});
