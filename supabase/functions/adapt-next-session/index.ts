import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const {
      sessionTitle,
      bilanScores,
      blockedStudents,
      exercicesTraites,
      exercicesNonTraites,
      nextSessionTitle,
      nextSessionObjectifs,
      nextSessionNiveauCible,
    } = await req.json();
    // AI key check moved to shared ai-client

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN.
On te fournit le bilan d'une séance qui vient de se terminer, et les infos de la séance suivante.

Tu dois :
1. Analyser les faiblesses détectées (scores par compétence, élèves en difficulté)
2. Proposer des ajustements pour la séance suivante qui MAINTIENNENT le tronc commun prévu
3. Suggérer des exercices de remédiation ciblés à ajouter EN DÉBUT de séance N+1
4. Identifier la compétence principale à renforcer

Contexte TCF IRN : 5 compétences (CO, CE, EE, EO, Structures), niveaux A0-C1, public adulte primo-arrivant.`;

    const userPrompt = `BILAN DE LA SÉANCE "${sessionTitle}" :
- Scores moyens du groupe : ${JSON.stringify(bilanScores)}
- Élèves en difficulté signalés : ${blockedStudents?.length > 0 ? blockedStudents.map((s: any) => `${s.nom} (${s.competence})`).join(", ") : "Aucun"}
- Exercices traités : ${exercicesTraites?.length || 0}
- Exercices non traités/reportés : ${exercicesNonTraites?.length || 0}

SÉANCE SUIVANTE PRÉVUE :
- Titre : ${nextSessionTitle || "Non défini"}
- Objectifs : ${nextSessionObjectifs || "Non définis"}
- Niveau cible : ${nextSessionNiveauCible || "Non défini"}

Propose des ajustements concrets.`;

    await callAI({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "adapt_session",
                description: "Propose les adaptations pour la séance suivante",
                parameters: {
                  type: "object",
                  properties: {
                    competence_focus: {
                      type: "string",
                      description: "Compétence principale à renforcer (CO, CE, EE, EO, Structures)",
                    },
                    analyse_bilan: {
                      type: "string",
                      description: "Analyse concise du bilan (2-3 phrases)",
                    },
                    exercices_remediation: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          titre: { type: "string" },
                          competence: { type: "string" },
                          format: { type: "string" },
                          description: { type: "string" },
                          duree_minutes: { type: "number" },
                        },
                        required: ["titre", "competence", "format", "description", "duree_minutes"],
                        additionalProperties: false,
                      },
                    },
                    objectifs_ajustes: {
                      type: "string",
                      description: "Objectifs révisés pour la séance N+1",
                    },
                    message_formateur: {
                      type: "string",
                      description: "Message court pour la notification au formateur",
                    },
                  },
                  required: [
                    "competence_focus",
                    "analyse_bilan",
                    "exercices_remediation",
                    "objectifs_ajustes",
                    "message_formateur",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "adapt_session" } },
        });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) throw new Error("L'IA n'a pas pu analyser le bilan");

    const adaptation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ adaptation }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("adapt-next-session error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
