import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { eleveNom, bilanTestScore, devoirResults, sessionTitle } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un expert en pédagogie FLE/TCF IRN.
Tu analyses les résultats post-devoirs d'un élève et produis un bilan concis pour le formateur.
Le bilan doit indiquer :
- Les compétences consolidées (OK)
- Les points à retravailler (avec score)
- Une suggestion concrète pour la séance suivante (durée + activité)`;

    const userPrompt = `ÉLÈVE : ${eleveNom}
SÉANCE : ${sessionTitle}

SCORE TEST DE BILAN : ${JSON.stringify(bilanTestScore)}

RÉSULTATS DES DEVOIRS :
${(devoirResults || []).map((d: any) => `- ${d.titre} (${d.competence}) : ${d.score}%`).join("\n") || "Aucun devoir soumis"}

Génère le bilan post-devoirs.`;

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
        tools: [{
          type: "function",
          function: {
            name: "generate_bilan",
            description: "Génère le bilan post-devoirs",
            parameters: {
              type: "object",
              properties: {
                competences_consolidees: {
                  type: "array",
                  items: { type: "string" },
                },
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
                suggestion_seance: { type: "string" },
                resume: { type: "string" },
              },
              required: ["competences_consolidees", "points_a_retravailler", "suggestion_seance", "resume"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_bilan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
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
