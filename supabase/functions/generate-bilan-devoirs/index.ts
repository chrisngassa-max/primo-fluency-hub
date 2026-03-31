import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scoresParCompetence, niveauCible, sessionTitle } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Identify weaknesses
    const competencesATravailler = Object.entries(scoresParCompetence || {})
      .filter(([_, score]) => (score as number) < 80)
      .map(([comp, score]) => ({
        competence: comp,
        score: score as number,
        type: (score as number) < 60 ? "renforcement" : "consolidation",
      }));

    if (competencesATravailler.length === 0) {
      return new Response(JSON.stringify({ devoirs: [], message: "Tous les scores sont >= 80%. Aucun devoir nécessaire." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un expert en pédagogie FLE/TCF IRN.
Tu génères des devoirs ciblés sur les lacunes identifiées lors d'un test de bilan.

SYSTÈME MULTIMÉDIA ACTIF :
L'application dispose d'un lecteur vocal (Text-to-Speech) et d'un enregistreur vocal (Speech-to-Text) côté élève.

Règles :
- Pour chaque compétence < 60% : exercices de renforcement (même niveau ou inférieur)
- Pour 60-80% : exercices de consolidation (variantes)
- 3 à 5 exercices par devoir maximum
- Formats : qcm, vrai_faux, texte_lacunaire, appariement, production_orale, production_ecrite
- Contexte IRN obligatoire
- Chaque exercice doit avoir des items avec question, options, bonne_reponse et explication

RÈGLES PAR COMPÉTENCE :
- **CO** : Inclure un champ "script_audio" dans les items — texte lu par la voix de synthèse, non affiché à l'élève. La question sert de consigne ("Écoutez et répondez").
- **EO** : Utiliser format "production_orale", type_reponse "oral". Proposer des jeux de rôle ou questions ouvertes pour l'enregistrement vocal. Inclure "criteres_evaluation".
- **CE** : Inclure un champ "texte" support obligatoire.
- **EE** : Utiliser format "production_ecrite" avec consigne de rédaction libre.`;

    const userPrompt = `RÉSULTATS DU TEST DE BILAN (séance "${sessionTitle}") :
${competencesATravailler.map(c => `- ${c.competence} : ${c.score}% → ${c.type}`).join("\n")}

NIVEAU CIBLE : ${niveauCible || "A1"}

Génère les devoirs ciblés pour chaque compétence en difficulté.`;

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
            name: "generate_devoirs",
            description: "Génère les devoirs ciblés sur les lacunes",
            parameters: {
              type: "object",
              properties: {
                devoirs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      competence: { type: "string" },
                      type_devoir: { type: "string", enum: ["renforcement", "consolidation", "confirmation"] },
                      titre: { type: "string" },
                      consigne: { type: "string" },
                      format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement"] },
                      niveau_vise: { type: "string" },
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
                          required: ["question", "options", "bonne_reponse", "explication"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["competence", "type_devoir", "titre", "consigne", "format", "niveau_vise", "items"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["devoirs"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_devoirs" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), {
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
    if (!toolCall) throw new Error("L'IA n'a pas pu générer les devoirs");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bilan-devoirs error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
