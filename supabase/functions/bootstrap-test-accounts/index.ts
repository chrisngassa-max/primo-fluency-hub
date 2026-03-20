import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = req.headers.get("x-bootstrap-secret");
    if (secret !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.slice(-8)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const accounts = [
      { email: "formateur.e2e@tcfpro.fr", password: "TestFormateur123!", nom: "Dupont", prenom: "Marie", role: "formateur" },
      { email: "eleve.e2e@tcfpro.fr", password: "TestEleve123!", nom: "Martin", prenom: "Lucas", role: "eleve" },
      { email: "eleve2.e2e@tcfpro.fr", password: "TestEleve2-123!", nom: "Bernard", prenom: "Sofia", role: "eleve" },
    ];

    const results: any[] = [];

    for (const acc of accounts) {
      // Check if user exists
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === acc.email);
      
      if (found) {
        results.push({ email: acc.email, status: "already_exists", id: found.id });
        continue;
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { nom: acc.nom, prenom: acc.prenom, role: acc.role },
      });

      if (error) {
        results.push({ email: acc.email, status: "error", error: error.message });
      } else {
        results.push({ email: acc.email, status: "created", id: data.user.id });
      }
    }

    // Setup group + membership if both exist
    const formateurId = results.find(r => r.email === "formateur.e2e@tcfpro.fr")?.id;
    const eleveId = results.find(r => r.email === "eleve.e2e@tcfpro.fr")?.id;
    const eleve2Id = results.find(r => r.email === "eleve2.e2e@tcfpro.fr")?.id;

    if (formateurId && eleveId) {
      // Check if group exists
      const { data: groups } = await admin.from("groups").select("id").eq("formateur_id", formateurId).eq("nom", "Groupe E2E").limit(1);
      
      let groupId: string;
      if (groups && groups.length > 0) {
        groupId = groups[0].id;
      } else {
        const { data: newGroup } = await admin.from("groups").insert({ formateur_id: formateurId, nom: "Groupe E2E", niveau: "A1" }).select("id").single();
        groupId = newGroup!.id;
      }

      // Check membership for eleve 1
      const { data: membership } = await admin.from("group_members").select("id").eq("group_id", groupId).eq("eleve_id", eleveId).limit(1);
      if (!membership || membership.length === 0) {
        await admin.from("group_members").insert({ group_id: groupId, eleve_id: eleveId });
      }

      // Check membership for eleve 2
      if (eleve2Id) {
        const { data: membership2 } = await admin.from("group_members").select("id").eq("group_id", groupId).eq("eleve_id", eleve2Id).limit(1);
        if (!membership2 || membership2.length === 0) {
          await admin.from("group_members").insert({ group_id: groupId, eleve_id: eleve2Id });
        }
      }

      // Create a session with exercises
      const { data: sessions } = await admin.from("sessions").select("id").eq("group_id", groupId).limit(1);
      let sessionId: string;
      if (sessions && sessions.length > 0) {
        sessionId = sessions[0].id;
      } else {
        const { data: newSession } = await admin.from("sessions").insert({
          group_id: groupId, titre: "Séance E2E", date_seance: new Date().toISOString(),
          niveau_cible: "A1", statut: "terminee", objectifs: "Test end-to-end"
        }).select("id").single();
        sessionId = newSession!.id;
      }

      // Ensure a point_a_maitriser exists
      let pointId: string;
      const { data: points } = await admin.from("points_a_maitriser").select("id").limit(1);
      if (points && points.length > 0) {
        pointId = points[0].id;
      } else {
        // Need epreuve + sous_section first
        const { data: ep } = await admin.from("epreuves").insert({ nom: "CO", competence: "CO", ordre: 1 }).select("id").single();
        const { data: ss } = await admin.from("sous_sections").insert({ epreuve_id: ep!.id, nom: "Comprendre", ordre: 1 }).select("id").single();
        const { data: pt } = await admin.from("points_a_maitriser").insert({ sous_section_id: ss!.id, nom: "Comprendre un message", niveau_min: "A1", niveau_max: "B1" }).select("id").single();
        pointId = pt!.id;
      }

      // Create exercises + link to session
      const { data: existingExercises } = await admin.from("session_exercices").select("id").eq("session_id", sessionId).limit(1);
      if (!existingExercises || existingExercises.length === 0) {
        for (const comp of ["CE", "Structures"] as const) {
          const items = comp === "CE"
            ? [{ question: "Que signifie ce panneau ?", options: ["Entrée", "Sortie", "Parking"], bonne_reponse: "Entrée", explication: "Le panneau indique l'entrée du bâtiment." }]
            : [{ question: "Je ___ français.", options: ["suis", "parle", "mange"], bonne_reponse: "suis", explication: "On dit « Je suis français » avec le verbe être." }];
          const { data: ex } = await admin.from("exercices").insert({
            formateur_id: formateurId, titre: `Exercice ${comp} E2E`, consigne: comp === "CE" ? "Lis et réponds" : "Complète la phrase",
            competence: comp, niveau_vise: "A1", point_a_maitriser_id: pointId, difficulte: 2,
            contenu: { items }
          }).select("id").single();
          await admin.from("session_exercices").insert({ session_id: sessionId, exercice_id: ex!.id, statut: "traite_en_classe", ordre: 1 });
        }
      }

      results.push({ setup: "group+session+exercises ready", groupId, sessionId });
    }

    return new Response(JSON.stringify({ results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
