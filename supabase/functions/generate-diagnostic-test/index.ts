import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { TCF_SYSTEM_PROMPT, MODEL, AI_GATEWAY } from "../_shared/system-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
    } = body;

    if (!sessionId || !groupId || !competences || !niveau) {
      throw new Error("Champs requis : sessionId, groupId, competences, niveau");
    }

    // Build prompt for diagnostic test generation
    let userPrompt = `Action : générer un TEST DIAGNOSTIQUE rapide pré-séance au format TCF IRN.

Objectif : évaluer en 3-5 questions QCM (4 choix, 1 bonne réponse) le niveau actuel des élèves sur les compétences suivantes : ${competences.join(", ")}
Niveau cible : ${niveau}

CONTRAINTE TCF IRN ABSOLUE : Chaque question doit respecter le format officiel du TCF.
- CO : QCM 4 choix basé sur un script audio (fournir le script avec balises [pause])
- CE : QCM 4 choix basé sur un texte/document
- EE : Tâche de production écrite calibrée
- EO : Tâche de production orale calibrée
- Structures : QCM 4 choix sur la grammaire/vocabulaire

Répartir les questions équitablement entre les compétences demandées.
Difficulté : calibrer au niveau ${niveau} avec une question légèrement au-dessus pour détecter les élèves avancés.`;

    if (weakPoints && weakPoints.length > 0) {
      userPrompt += `\n\nPOINTS FAIBLES DÉTECTÉS (à tester en priorité) :`;
      weakPoints.forEach((wp: any) => {
        userPrompt += `\n- ${wp.competence} : "${wp.exercice}" (score ${wp.score}%)`;
      });
    }

    if (previousSessionScores) {
      userPrompt += `\n\nSCORES SÉANCE PRÉCÉDENTE PAR COMPÉTENCE :`;
      Object.entries(previousSessionScores).forEach(([comp, data]: [string, any]) => {
        userPrompt += `\n- ${comp} : ${data.avg}% (${data.count} résultats)`;
      });
    }

    const systemPrompt = TCF_SYSTEM_PROMPT + `

// Mode diagnostic pré-séance — Génère un test QCM rapide pour évaluer le niveau avant la séance.
// La sortie DOIT être un JSON structuré via l'outil generate_diagnostic.`;

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_diagnostic",
              description: "Retourne un test diagnostique pré-séance au format TCF IRN.",
              parameters: {
                type: "object",
                properties: {
                  titre: { type: "string", description: "Titre du test diagnostique" },
                  questions: {
                    type: "array",
                    description: "Questions du test diagnostique (3-5 questions)",
                    items: {
                      type: "object",
                      properties: {
                        competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                        consigne: { type: "string", description: "Consigne de la question" },
                        support: { type: "string", description: "Texte support, script audio ou description visuelle" },
                        choix: {
                          type: "array",
                          items: { type: "string" },
                          description: "4 choix de réponse (QCM uniquement)",
                        },
                        bonne_reponse: { type: "string", description: "La bonne réponse" },
                        explication: { type: "string", description: "Explication de la bonne réponse" },
                        niveau: { type: "string", description: "Niveau CECRL de la question" },
                      },
                      required: ["competence", "consigne", "choix", "bonne_reponse", "explication", "niveau"],
                    },
                  },
                },
                required: ["titre", "questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "generate_diagnostic" },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("Erreur du service IA");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("L'IA n'a pas retourné de résultat structuré");
    }

    const diagnostic = JSON.parse(toolCall.function.arguments);

    // Validate: at least 3 questions with 4 choices each
    if (!diagnostic.questions || diagnostic.questions.length < 3) {
      throw new Error("Le diagnostic doit contenir au moins 3 questions");
    }

    for (const q of diagnostic.questions) {
      if (q.choix && q.choix.length !== 4) {
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
        statut: "envoye",
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
