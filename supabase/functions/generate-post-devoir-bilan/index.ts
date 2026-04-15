import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { eleveNom, bilanTestScore, devoirResults, sessionTitle } = await req.json();
    // AI key check moved to shared ai-client

    const systemPrompt = `Tu es un expert en pédagogie FLE/TCF IRN.
Tu analyses les résultats post-devoirs d'un élève et produis DEUX bilans distincts :

BILAN A (pour l'élève) :
- Ton encourageant, simple, pas de jargon. Tutoiement.
- Maximum 3 points par section.
- Sections : "reussites" (ce que l'élève a bien fait) et "a_travailler" (ce qu'il doit revoir).
- Score global en /20.

BILAN B (pour le formateur) :
- Ton professionnel, détaillé, technique.
- Scores par compétence avec /10.
- Erreurs observées citant les exercices spécifiques.
- Points à développer en séance (actionnables).
- Conseils de remédiation IA concrets (durée + activité).`;

    const userPrompt = `ÉLÈVE : ${eleveNom}
SÉANCE : ${sessionTitle}

SCORE TEST DE BILAN : ${JSON.stringify(bilanTestScore)}

RÉSULTATS DES DEVOIRS :
${(devoirResults || []).map((d: any) => `- ${d.titre} (${d.competence}) : ${d.score}% — Erreurs: ${d.erreurs || "aucune"}`).join("\n") || "Aucun devoir soumis"}

Génère les deux bilans.`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_bilans",
            description: "Génère le bilan élève (A) et le bilan formateur (B)",
            parameters: {
              type: "object",
              properties: {
                bilan_eleve: {
                  type: "object",
                  properties: {
                    reussites: { type: "array", items: { type: "string" } },
                    a_travailler: { type: "array", items: { type: "string" } },
                    score_global: { type: "string" },
                    message_encouragement: { type: "string" },
                  },
                  required: ["reussites", "a_travailler", "score_global", "message_encouragement"],
                  additionalProperties: false,
                },
                bilan_formateur: {
                  type: "object",
                  properties: {
                    competences_consolidees: { type: "array", items: { type: "string" } },
                    points_a_retravailler: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          competence: { type: "string" },
                          score: { type: "number" },
                          detail: { type: "string" },
                        },
                        required: ["competence", "score", "detail"],
                        additionalProperties: false,
                      },
                    },
                    erreurs_observees: { type: "array", items: { type: "string" } },
                    points_a_developper: { type: "array", items: { type: "string" } },
                    conseils_remediation: { type: "array", items: { type: "string" } },
                    suggestion_seance: { type: "string" },
                    resume: { type: "string" },
                  },
                  required: ["competences_consolidees", "points_a_retravailler", "erreurs_observees", "points_a_developper", "conseils_remediation", "suggestion_seance", "resume"],
                  additionalProperties: false,
                },
              },
              required: ["bilan_eleve", "bilan_formateur"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_bilans" } },
      });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer le bilan");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-post-devoir-bilan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
