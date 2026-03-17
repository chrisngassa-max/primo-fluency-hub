import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pointName, competence, niveauVise, count = 10 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un expert en FLE (Français Langue Étrangère) spécialisé dans la préparation au TCF IRN (Intégration et Résidence en France).
Tu dois générer exactement ${count} exercices pour le point à maîtriser suivant.

RÈGLES STRICTES :
- Chaque exercice doit être ORIGINAL (jamais copié d'épreuves officielles TV5Monde)
- Contexte : situations réelles de la vie en France (préfecture, CAF, emploi, logement, transport, santé, citoyenneté)
- Public : adultes primo-arrivants, niveau ${niveauVise}
- Formats possibles : qcm, vrai_faux, texte_lacunaire, appariement, transformation
- Langue simple et claire

Tu DOIS utiliser le tool "generate_exercises" pour retourner le résultat.`;

    const userPrompt = `Génère ${count} exercices pour :
- Point à maîtriser : "${pointName}"
- Compétence : ${competence}
- Niveau visé : ${niveauVise}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_exercises",
              description: "Return generated exercises",
              parameters: {
                type: "object",
                properties: {
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titre: { type: "string", description: "Titre court de l'exercice" },
                        consigne: { type: "string", description: "Consigne pour l'élève" },
                        format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"] },
                        difficulte: { type: "number", minimum: 1, maximum: 5 },
                        contenu: {
                          type: "object",
                          properties: {
                            items: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  question: { type: "string" },
                                  options: { type: "array", items: { type: "string" } },
                                  bonne_reponse: { type: "string" },
                                  explication: { type: "string" },
                                },
                                required: ["question", "bonne_reponse"],
                              },
                            },
                          },
                          required: ["items"],
                        },
                      },
                      required: ["titre", "consigne", "format", "difficulte", "contenu"],
                    },
                  },
                },
                required: ["exercises"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_exercises" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const exercises = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(exercises), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exercises error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
