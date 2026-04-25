import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { validateAndFix } from "../_shared/exercise-validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { exercices, sessionTitle, niveauCible } = await req.json();
    // AI key check moved to shared ai-client

    const exercicesSummary = (exercices || []).map((ex: any, i: number) =>
      `${i + 1}. "${ex.titre}" (${ex.competence}, ${ex.format}, niveau ${ex.niveau_vise}) — Consigne: ${ex.consigne}`
    ).join("\n");

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN.
Tu génères des tests de bilan de séance pour vérifier les acquis immédiats des apprenants.

Règles :
- Génère entre 5 et 15 questions basées sur les exercices traités en classe
- Chaque question doit tester la même compétence que l'exercice source
- Formats supportés : qcm (4 options), vrai_faux (2 options), texte_lacunaire
- Les questions doivent être DIFFÉRENTES des exercices originaux mais tester les mêmes compétences
- Niveau adapté au niveau cible de la séance
- Contexte IRN (préfecture, emploi, logement, etc.)
- Chaque question a exactement UNE bonne réponse`;

    const userPrompt = `SÉANCE : "${sessionTitle || "Séance"}"
NIVEAU CIBLE : ${niveauCible || "A1"}

EXERCICES TRAITÉS EN CLASSE :
${exercicesSummary}

Génère un test de bilan pour vérifier les acquis de cette séance.`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_bilan_test",
            description: "Génère les questions du test de bilan",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string", description: "Texte de la question" },
                      competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                      format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire"] },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        description: "Options de réponse (2 pour vrai/faux, 4 pour QCM, vide pour lacunaire)"
                      },
                      bonne_reponse: { type: "string", description: "La bonne réponse exacte" },
                      explication: { type: "string", description: "Explication courte de la bonne réponse" },
                    },
                    required: ["question", "competence", "format", "options", "bonne_reponse", "explication"],
                    additionalProperties: false,
                  },
                },
                competences_couvertes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Liste des compétences couvertes par le test",
                },
              },
              required: ["questions", "competences_couvertes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_bilan_test" } },
      });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer le test");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bilan-test error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
