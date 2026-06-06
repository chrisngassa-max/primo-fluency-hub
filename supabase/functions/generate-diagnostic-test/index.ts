import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildProceduralDiagnostic(competences: string[], niveau: string) {
  const normalized = (competences?.length ? competences : ["CE"]).filter(Boolean);
  const contexts = ["préfecture", "logement", "emploi", "transport", "CAF", "médecin", "mairie", "banque"];
  const questions = normalized.flatMap((competence, compIndex) =>
    Array.from({ length: Math.max(3, Math.ceil(8 / normalized.length)) }, (_, i) => {
      const ctx = contexts[(compIndex + i) % contexts.length];
      const base = {
        competence,
        sous_competence: `Repérage d'information en contexte ${ctx}`,
        niveau,
        difficulte: i % 3 === 0 ? 2 : i % 3 === 1 ? 3 : 4,
        explication: `La réponse attendue vérifie la compréhension d'une information utile dans une situation de ${ctx}.`,
      };

      if (competence === "CO") {
        return {
          ...base,
          consigne: "Écoute le message et choisis la bonne réponse.",
          support: `Bonjour. Pour votre rendez-vous à la ${ctx}, apportez une pièce d'identité [pause 1s] et un justificatif récent [pause 1s]. Le rendez-vous est confirmé pour jeudi matin. [débit lent]`,
          choix: ["Jeudi matin", "Lundi soir", "Samedi après-midi", "Dimanche matin"],
          bonne_reponse: "Jeudi matin",
        };
      }

      if (competence === "CE") {
        return {
          ...base,
          consigne: "Lis le document et choisis la bonne réponse.",
          support: `Avis ${ctx} : votre dossier est disponible à l'accueil du lundi au vendredi, de 9 h à 12 h. Merci d'apporter votre numéro de dossier.`,
          choix: ["De 9 h à 12 h", "De 14 h à 18 h", "Le samedi matin", "Uniquement le dimanche"],
          bonne_reponse: "De 9 h à 12 h",
        };
      }

      if (competence === "Structures") {
        return {
          ...base,
          consigne: "Choisis la phrase correcte.",
          support: "",
          choix: ["Je dois apporter mon justificatif.", "Je dois apportez mon justificatif.", "Je doit apporter mon justificatif.", "Je dois apporte mon justificatif."],
          bonne_reponse: "Je dois apporter mon justificatif.",
        };
      }

      if (competence === "EE") {
        return {
          ...base,
          consigne: `Écris un message court pour demander une information liée à ${ctx}.`,
          support: `Tu dois contacter un service de ${ctx} pour demander un rendez-vous ou une information simple.`,
          choix: [],
          bonne_reponse: "Production écrite attendue : message clair avec salutation, demande précise et formule de politesse.",
        };
      }

      return {
        ...base,
        consigne: `Prépare une réponse orale courte pour expliquer ta situation liée à ${ctx}.`,
        support: `Situation : tu es à un guichet de ${ctx}. Explique ce dont tu as besoin en phrases simples.`,
        choix: [],
        bonne_reponse: "Production orale attendue : réponse compréhensible, informations personnelles utiles et demande claire.",
      };
    })
  ).slice(0, 15);

  while (questions.length < 8) questions.push({ ...questions[questions.length % Math.max(questions.length, 1)] });

  return {
    titre: `Diagnostic pré-séance ${niveau}`,
    duree_estimee_minutes: 6,
    questions: questions.slice(0, 15),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      sessionId,
      groupId,
      competences, // string[] e.g. ["CO", "CE"]
      niveau,      // e.g. "A1"
      weakPoints,  // optional: [{ competence, exercice, score }]
      previousSessionScores, // optional: Record<string, { avg, count }>
      statut: requestedStatut, // optional: "pret" | "envoye" (default "envoye")
    } = body;

    if (!sessionId || !groupId || !competences || !niveau) {
      throw new Error("Champs requis : sessionId, groupId, competences, niveau");
    }

    const diagnostic = buildProceduralDiagnostic(competences, niveau);

    // Validate: at least 3 questions with 4 choices each
    if (!diagnostic.questions || diagnostic.questions.length < 8) {
      throw new Error("Le diagnostic doit contenir au moins 8 questions pour une évaluation exhaustive");
    }

    for (const q of diagnostic.questions) {
      // QCM questions (CO, CE, Structures) must have 4 choices; EE/EO may not have choices
      if (q.choix && q.choix.length > 0 && q.choix.length !== 4) {
        throw new Error(`QCM invalide : ${q.competence} doit avoir 4 choix`);
      }
    }

    // Save as bilan_test linked to the session
    const competencesCouvertes = [...new Set(diagnostic.questions.map((q: any) => q.competence))];

    // Get formateur id from session
    const { data: sessionData } = await supabase
      .from("sessions")
      .select("group_id")
      .eq("id", sessionId)
      .single();

    const { data: groupData } = await supabase
      .from("groups")
      .select("formateur_id")
      .eq("id", sessionData?.group_id || groupId)
      .single();

    const formateurId = groupData?.formateur_id;
    if (!formateurId) throw new Error("Formateur introuvable");

    const { data: bilanTest, error: insertErr } = await supabase
      .from("bilan_tests")
      .insert({
        session_id: sessionId,
        formateur_id: formateurId,
        contenu: diagnostic.questions,
        competences_couvertes: competencesCouvertes,
        nb_questions: diagnostic.questions.length,
        statut: requestedStatut === "pret" ? "pret" : "envoye",
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        bilanTestId: bilanTest.id,
        titre: diagnostic.titre,
        nbQuestions: diagnostic.questions.length,
        competences: competencesCouvertes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-diagnostic-test error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
