import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    const body = await req.json();
    const {
      type,           // "lecon" | "vocabulaire" | "rappel_methodo" | "rappel_visuel"
      competence,     // "CO" | "CE" | "EE" | "EO"
      niveau,         // "A0" | "A1" | "A2" | "B1"
      exerciseContext, // { titre, consigne, contenu, competence, format } — the exercise triggering generation
      sessionContext,  // { titre, objectifs, niveau_cible } — optional session info
      mode,           // "manual" | "auto" | "bilan"
    } = body;

    if (!type || !competence || !niveau) {
      throw new Error("Champs requis : type, competence, niveau");
    }

    const typeLabels: Record<string, string> = {
      lecon: "Leçon structurée",
      vocabulaire: "Fiche de vocabulaire",
      rappel_methodo: "Rappel méthodologique",
      rappel_visuel: "Rappel visuel illustré",
    };

    const typeInstructions: Record<string, string> = {
      lecon: `Génère une LEÇON structurée et pédagogique :
- Titre clair de la notion
- Introduction simple (1-2 phrases, niveau ${niveau})
- Explication en 3-5 points numérotés avec exemples concrets du quotidien en France
- Encadré "À retenir" avec les règles essentielles
- 2-3 exemples d'application dans un contexte IRN (préfecture, CAF, médecin, etc.)
- Phrases courtes, vocabulaire adapté au niveau ${niveau}`,

      vocabulaire: `Génère une FICHE DE VOCABULAIRE :
- Titre thématique
- 10 à 15 mots/expressions clés classés par catégorie
- Pour chaque mot : le mot en français, une définition simple (niveau ${niveau}), un exemple dans une phrase du quotidien
- Section "Expressions utiles" avec 3-5 phrases complètes réutilisables
- Encadré "Astuce" pour mémoriser`,

      rappel_methodo: `Génère un RAPPEL MÉTHODOLOGIQUE :
- Titre : "Comment réussir [type d'exercice]"
- Étapes numérotées (4-6 étapes) pour aborder ce type d'exercice au TCF IRN
- Pour chaque étape : action + conseil pratique
- Encadré "Pièges à éviter" avec 2-3 erreurs fréquentes
- Encadré "Technique" avec une stratégie concrète`,

      rappel_visuel: `Génère un RAPPEL VISUEL :
- Titre clair
- Description d'un schéma/tableau/infographie pédagogique
- Contenu structuré visuellement (tableau, liste avec icônes, arbre de décision)
- Utilise des symboles simples (✓, ✗, →, ⚠️, 💡)
- Adapté pour impression en noir et blanc
- Assez grand et lisible pour un public adulte en formation`,
    };

    let userPrompt = `Action : générer une ressource pédagogique TCF IRN

Type demandé : ${typeLabels[type] || type}
Compétence TCF : ${competence}
Niveau CECRL : ${niveau}

${typeInstructions[type] || "Génère une ressource pédagogique adaptée."}`;

    if (exerciseContext) {
      userPrompt += `

CONTEXTE DE L'EXERCICE SOURCE :
- Titre : ${exerciseContext.titre || "Non spécifié"}
- Consigne : ${exerciseContext.consigne || "Non spécifiée"}
- Compétence : ${exerciseContext.competence || competence}
- Format : ${exerciseContext.format || "qcm"}
La ressource doit être directement liée à cet exercice et couvrir les notions nécessaires pour le réussir.`;
    }

    if (sessionContext) {
      userPrompt += `

CONTEXTE DE LA SÉANCE :
- Titre : ${sessionContext.titre || "Non spécifié"}
- Objectifs : ${sessionContext.objectifs || "Non spécifiés"}
- Niveau cible : ${sessionContext.niveau_cible || niveau}`;
    }

    if (mode === "bilan") {
      userPrompt += `

MODE BILAN : Cette ressource est un bilan intermédiaire après une série d'exercices sur le même point.
Résume les notions clés travaillées, les erreurs fréquentes observées, et propose un rappel synthétique.`;
    }

    const systemPrompt = TCF_SYSTEM_PROMPT + `

// Mode ressource pédagogique — NE PAS générer d'exercice, mais une RESSOURCE d'apprentissage.
// La sortie doit être un JSON structuré avec le contenu de la ressource.`;

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
              name: "generate_resource",
              description: "Retourne une ressource pédagogique TCF IRN structurée.",
              parameters: {
                type: "object",
                properties: {
                  titre: { type: "string", description: "Titre de la ressource" },
                  sections: {
                    type: "array",
                    description: "Sections de la ressource, chacune avec un titre et un contenu",
                    items: {
                      type: "object",
                      properties: {
                        titre: { type: "string" },
                        contenu: { type: "string", description: "Contenu textuel de la section (markdown léger autorisé)" },
                        type: { type: "string", enum: ["texte", "liste", "tableau", "encadre", "exemple", "astuce", "attention"], description: "Type de mise en forme" },
                        items: {
                          type: "array",
                          description: "Éléments de liste ou de tableau",
                          items: {
                            type: "object",
                            properties: {
                              terme: { type: "string" },
                              definition: { type: "string" },
                              exemple: { type: "string" },
                            },
                          },
                        },
                      },
                      required: ["titre", "contenu", "type"],
                    },
                  },
                  resume: { type: "string", description: "Résumé en 1-2 phrases de la ressource" },
                },
                required: ["titre", "sections", "resume"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "generate_resource" },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const resource = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ resource }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-resource error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
