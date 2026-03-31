import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      mode, // "theme" | "import"
      // Theme mode fields
      theme,
      competence,
      niveau,
      format,
      // Import mode fields
      sourceText,
      sourceUrl,
      treatment, // "extract" | "reconfigure"
      targetFormat, // only when treatment === "reconfigure"
    } = body;

    if (!mode) throw new Error("Le champ 'mode' est requis");

    // Build user prompt based on mode
    let userPrompt = "";

    if (mode === "theme") {
      if (!theme || !competence || !niveau || !format)
        throw new Error("Champs manquants pour le mode thème");
      userPrompt = `Crée un exercice complet sur le thème "${theme}".
Compétence TCF : ${competence}
Niveau CECRL : ${niveau}
Format demandé : ${format}

Invente un support textuel réaliste (dialogue, document administratif, annonce, etc.) ancré dans un contexte IRN (Préfecture, CAF, Emploi, Logement, Médical, Transport, Citoyenneté, Commerce).
Puis génère entre 5 et 10 questions/items correspondant exactement au format demandé et à la difficulté du niveau ${niveau}.
Chaque item doit avoir une question, des options (si applicable), la bonne réponse et une explication pédagogique.`;
    } else if (mode === "import") {
      const source = sourceText || sourceUrl || "";
      if (!source) throw new Error("Aucune source fournie pour l'import");

      if (treatment === "extract") {
        userPrompt = `Voici un document source :
---
${source}
---

Extrais l'exercice tel quel de ce document. Restructure-le au format standard avec titre, consigne et items (question, options, bonne_reponse, explication).`;
      } else {
        if (!targetFormat) throw new Error("Format cible requis pour la reconfiguration");
        userPrompt = `Voici un document source :
---
${source}
---

Reconfigure entièrement ce contenu pour créer un exercice au format "${targetFormat}" pour le TCF IRN.
Conserve le thème et le vocabulaire du document original mais restructure tout le contenu pour qu'il corresponde parfaitement au format demandé.
Génère entre 5 et 10 items avec question, options (si applicable), bonne_reponse et explication.`;
      }
    } else {
      throw new Error("Mode inconnu : " + mode);
    }

    const systemPrompt = `Tu es un expert pédagogique du TCF IRN (Test de Connaissance du Français — Intégration et Résidence en France).
Ton rôle est de concevoir ou reformater des exercices viables pour la réussite du TCF.

SYSTÈME MULTIMÉDIA ACTIF :
L'application dispose d'un lecteur vocal (Text-to-Speech) et d'un enregistreur vocal (Speech-to-Text) côté élève.

Tes exercices doivent être :
- Ancrés dans des situations réelles de la vie quotidienne en France (démarches administratives, emploi, santé, logement, transport, etc.)
- Adaptés au niveau CECRL demandé (A1 = très simple, C1 = complexe)
- Pédagogiquement rigoureux avec des distracteurs plausibles
- Originaux (jamais copiés d'épreuves officielles)

RÈGLES PAR COMPÉTENCE :
- **CO (Compréhension Orale)** : OBLIGATOIRE — inclure un champ "script_audio" dans contenu avec le texte lu par la synthèse vocale (dialogue, annonce...). Ce script ne sera PAS affiché à l'élève. Le champ "question" sert de consigne ("Écoutez l'audio et répondez...").
- **EO (Expression Orale)** : Utiliser format "production_orale" et "type_reponse": "oral" dans contenu. Proposer jeux de rôle, questions ouvertes. Inclure "criteres_evaluation" (prononciation, vocabulaire, grammaire, cohérence).
- **CE (Compréhension Écrite)** : OBLIGATOIRE — inclure un champ "texte" dans contenu avec le document support.
- **EE (Expression Écrite)** : Format "production_ecrite" avec consigne de rédaction libre.

Formats possibles :
- qcm, vrai_faux, texte_lacunaire, appariement, transformation, production_ecrite, production_orale

Pour chaque item, fournis TOUJOURS : question, options (tableau de chaînes, vide si production libre), bonne_reponse, explication.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
                name: "generate_exercise",
                description:
                  "Retourne un exercice TCF IRN structuré avec titre, consigne, format, difficulté et contenu.",
                parameters: {
                  type: "object",
                  properties: {
                    titre: {
                      type: "string",
                      description: "Titre court et descriptif de l'exercice",
                    },
                    consigne: {
                      type: "string",
                      description:
                        "Consigne complète pour l'apprenant, incluant le support textuel si applicable",
                    },
                    competence: {
                      type: "string",
                      enum: ["CO", "CE", "EE", "EO", "Structures"],
                      description: "Compétence TCF visée",
                    },
                      format: {
                      type: "string",
                      enum: [
                        "qcm",
                        "vrai_faux",
                        "texte_lacunaire",
                        "appariement",
                        "transformation",
                        "production_ecrite",
                        "production_orale",
                      ],
                      description: "Format de l'exercice",
                    },
                    difficulte: {
                      type: "integer",
                      minimum: 1,
                      maximum: 5,
                      description: "Difficulté de 1 (très facile) à 5 (très difficile)",
                    },
                    niveau_vise: {
                      type: "string",
                      enum: ["A0", "A1", "A2", "B1", "B2", "C1"],
                      description: "Niveau CECRL visé",
                    },
                    contenu: {
                      type: "object",
                      properties: {
                         script_audio: {
                          type: "string",
                          description:
                            "Script audio pour CO : texte lu par la synthèse vocale (OBLIGATOIRE pour CO, NE PAS afficher à l'élève)",
                        },
                        type_reponse: {
                          type: "string",
                          enum: ["ecrit", "oral"],
                          description: "Type de réponse attendu (oral pour EO)",
                        },
                        criteres_evaluation: {
                          type: "object",
                          description:
                            "Critères d'évaluation pour productions orales/écrites",
                        },
                        texte: {
                          type: "string",
                          description:
                            "Support textuel (dialogue, document, texte) sur lequel portent les questions",
                        },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              question: { type: "string" },
                              options: {
                                type: "array",
                                items: { type: "string" },
                              },
                              bonne_reponse: { type: "string" },
                              explication: { type: "string" },
                            },
                            required: [
                              "question",
                              "options",
                              "bonne_reponse",
                              "explication",
                            ],
                          },
                        },
                      },
                      required: ["items"],
                    },
                  },
                  required: [
                    "titre",
                    "consigne",
                    "competence",
                    "format",
                    "difficulte",
                    "niveau_vise",
                    "contenu",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "generate_exercise" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des crédits dans les paramètres." }),
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

    const exercise = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ exercise }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-exercise-generator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
