import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { TCF_SYSTEM_PROMPT } from "../_shared/system-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const typeLabels: Record<string, string> = {
  lecon: "Leçon structurée",
  vocabulaire: "Fiche de vocabulaire",
  rappel_methodo: "Rappel méthodologique",
  rappel_visuel: "Rappel visuel illustré",
};

const buildTypeInstructions = (type: string, niveau: string): string => {
  const map: Record<string, string> = {
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
  return map[type] || "Génère une ressource pédagogique adaptée.";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = await req.json();
    const { type, competence, niveau, exerciseContext, exercisesContext, sessionContext, mode } = body;

    if (!type || !competence || !niveau) {
      throw new Error("Champs requis : type, competence, niveau");
    }

    let userPrompt = `Action : générer une ressource pédagogique TCF IRN

Type demandé : ${typeLabels[type] || type}
Compétence TCF : ${competence}
Niveau CECRL : ${niveau}

${buildTypeInstructions(type, niveau)}`;

    if (exerciseContext) {
      userPrompt += `

CONTEXTE DE L'EXERCICE SOURCE :
- Titre : ${exerciseContext.titre || "Non spécifié"}
- Consigne : ${exerciseContext.consigne || "Non spécifiée"}
- Compétence : ${exerciseContext.competence || competence}
- Format : ${exerciseContext.format || "qcm"}
La ressource doit être directement liée à cet exercice et couvrir les notions nécessaires pour le réussir.`;
    }

    if (exercisesContext && Array.isArray(exercisesContext) && exercisesContext.length > 0) {
      userPrompt += `

CONTEXTE DES ${exercisesContext.length} EXERCICES SOURCES :
${exercisesContext.map((ex: any, i: number) => `${i + 1}. "${ex.titre}" (${ex.competence}, ${ex.format}) — ${ex.consigne || ""}`).join("\n")}

La ressource doit couvrir les notions nécessaires pour réussir l'ensemble de ces exercices. Identifie les points communs et les compétences transversales.`;
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
// La sortie doit être un JSON structuré avec le contenu de la ressource.

═══════════════════════════════════════════════════
RÈGLES ABSOLUES SUR LA LANGUE — PUBLIC A0/A1 ALLOPHONE
Ces règles s'appliquent à TOUS les textes générés sans exception.
═══════════════════════════════════════════════════

CONSIGNES (instructions données à l'élève) :
✅ Maximum 12 mots par consigne
✅ Structure imposée : Verbe à l'impératif + complément court
✅ Valide : "Écoutez et choisissez.", "Lisez et répondez.", "Regardez l'image."
❌ Interdit : subordonnées relatives ou causales
❌ Interdit : double négation ("ne... pas... sans...")
❌ Interdit : plus de 2 actions dans une même consigne

QUESTIONS ET ITEMS :
✅ Phrases courtes : Sujet + Verbe + Complément
✅ Vocabulaire du quotidien uniquement
✅ Maximum 20 mots par phrase
❌ Interdit : vocabulaire abstrait (intégration, démarche administrative complexe...)
❌ Interdit : phrases imbriquées

EXPLICATIONS :
✅ Maximum 20 mots
✅ Structure : "La bonne réponse est [X] parce que [raison courte]."
❌ Interdit : explications grammaticales techniques pour A0

AVANT de finaliser ta réponse, vérifie chaque texte :
- Compte les mots → si trop long, reformule
- Vérifie la clarté → un adulte A0 doit comprendre`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "generate_resource",
            description: "Retourne une ressource pédagogique TCF IRN structurée.",
            input_schema: {
              type: "object",
              properties: {
                titre: { type: "string", description: "Titre de la ressource" },
                sections: {
                  type: "array",
                  description: "Sections de la ressource",
                  items: {
                    type: "object",
                    properties: {
                      titre: { type: "string" },
                      contenu: { type: "string", description: "Contenu textuel de la section (markdown léger autorisé)" },
                      type: { type: "string", enum: ["texte", "liste", "tableau", "encadre", "exemple", "astuce", "attention"] },
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
            },
          },
        ],
        tool_choice: { type: "tool", name: "generate_resource" },
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
      console.error("Anthropic API error:", response.status, errText);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");

    if (!toolUse?.input) {
      throw new Error("L'IA n'a pas retourné de résultat structuré");
    }

    const resource = toolUse.input;

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
