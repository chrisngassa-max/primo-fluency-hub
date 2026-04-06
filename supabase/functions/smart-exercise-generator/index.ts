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
      mode, // "theme" | "import"
      theme,
      competence,
      niveau,
      format,
      sourceText,
      sourceUrl,
      treatment, // "extract" | "reconfigure"
      targetFormat,
      type_demarche,
      niveau_depart,
      niveau_arrivee,
    } = body;

    const demarche = type_demarche || "titre_sejour";
    const epreuvesAutorisees = demarche === "naturalisation"
      ? "CO, CE, EE, EO (les 4 épreuves)"
      : "CO et CE uniquement (titre de séjour)";

    if (!mode) throw new Error("Le champ 'mode' est requis");

    let userPrompt = "";

    if (mode === "theme") {
      if (!theme || !competence || !niveau || !format)
        throw new Error("Champs manquants pour le mode thème");
      userPrompt = `Action : generer_exercice
Thème : "${theme}"
Compétence TCF : ${competence}
Niveau départ : ${niveau_depart || niveau}
Niveau arrivée : ${niveau_arrivee || "A1"}
Démarche IRN : ${demarche} → Épreuves autorisées : ${epreuvesAutorisees}
Format demandé : ${format}

Invente un support textuel réaliste (dialogue, document administratif, annonce, etc.) ancré dans un contexte IRN (Préfecture, CAF, Emploi, Logement, Médical, Transport, Citoyenneté, Commerce).
Puis génère entre 5 et 10 questions/items correspondant exactement au format demandé et à la difficulté du niveau ${niveau}.
Chaque item doit avoir une question, des options (si applicable), la bonne réponse et une explication pédagogique.
Choisis le code le plus adapté dans la cartographie TCF IRN (CO1-CO4, CE1-CE4, EO1-EO4, EE1-EE3).`;
    } else if (mode === "import") {
      const source = sourceText || sourceUrl || "";
      if (!source) throw new Error("Aucune source fournie pour l'import");

      if (treatment === "extract") {
        userPrompt = `Voici un document source :
---
${source}
---

Extrais l'exercice tel quel de ce document. Restructure-le au format standard avec titre, consigne et items (question, options, bonne_reponse, explication). Attribue le code TCF IRN approprié.`;
      } else {
        if (!targetFormat) throw new Error("Format cible requis pour la reconfiguration");
        userPrompt = `Voici un document source :
---
${source}
---

Reconfigure entièrement ce contenu pour créer un exercice au format "${targetFormat}" pour le TCF IRN.
Conserve le thème et le vocabulaire du document original mais restructure tout le contenu pour qu'il corresponde parfaitement au format demandé.
Génère entre 5 et 10 items avec question, options (si applicable), bonne_reponse et explication.
Attribue le code TCF IRN le plus pertinent.`;
      }
    } else {
      throw new Error("Mode inconnu : " + mode);
    }

    const systemPrompt = TCF_SYSTEM_PROMPT + `

// Contexte spécifique smart-exercise-generator : mode import/reconfiguration activé.

SYSTÈME MULTIMÉDIA ACTIF :
L'application dispose d'un lecteur vocal (Text-to-Speech) et d'un enregistreur vocal (Speech-to-Text) côté élève.

═══════════════════════════════════════════════════
CARTOGRAPHIE DES EXERCICES TCF IRN — NIVEAU A1
Chaque exercice DOIT porter un code et des métadonnées issus de cette cartographie.
═══════════════════════════════════════════════════

### CO (Compréhension Orale) — TTS obligatoire
| Code | Sous-compétence         | Type                                                        | time_limit |
|------|-------------------------|--------------------------------------------------------------|------------|
| CO1  | Identifier la situation | Micro-scène : dialogue court (boulangerie, guichet CAF…)     | 45         |
| CO2  | Sujet global            | Message répondeur : annulation cours, décalage RDV           | 50         |
| CO3  | Consignes / Règles      | Instruction directe : "Veuillez patienter…"                  | 45         |
| CO4  | Info chiffrée           | Annonce micro : horaires, prix, numéros                      | 50         |

### CE (Compréhension Écrite) — texte support + image OBLIGATOIRES
| Code | Sous-compétence       | Type                                                        | time_limit |
|------|-----------------------|--------------------------------------------------------------|------------|
| CE1  | Signalétique          | Panneau urbain / picto                                       | 80         |
| CE2  | Messages familiers    | SMS / Post-it / Email                                        | 80         |
| CE3  | Recherche d'info      | Emploi du temps / Menu                                       | 80         |
| CE4  | Texte administratif   | Notice simple / Courrier                                     | 100        |

⚠️ CHAMP "image_description" OBLIGATOIRE POUR TOUT EXERCICE CE ET EO ⚠️
Tu DOIS fournir un champ "image_description" dans contenu décrivant précisément le document visuel.
Exemples CE : "Une carte de résident française avec photo, nom et nationalité", "Un panneau de signalisation urbain en France"
Exemples EO : "Un cabinet médical en France avec un médecin et un patient", "Un marché en plein air en France"
L'image sera récupérée automatiquement via une banque d'images.

### EO (Expression Orale) — format production_orale + type_reponse "oral"
| Code | Sous-compétence       | Type                                                        | time_limit |
|------|-----------------------|--------------------------------------------------------------|------------|
| EO1  | Se présenter          | Monologue guidé (Nom, Pays, Ville, Métier)                   | 120        |
| EO2  | Interaction basique   | Interview (5 questions → réponses courtes)                   | 180        |
| EO3  | Situation survie      | Jeu de rôle Médecin (mots-clés: mal, douleur, rdv)          | 120        |
| EO4  | Demande d'info        | Simulation Marché (structure interrogative)                  | 120        |

### EE (Expression Écrite)
| Code | Sous-compétence       | Type                                                        | time_limit |
|------|-----------------------|--------------------------------------------------------------|------------|
| EE1  | Remplir / Saisir      | Formulaire d'inscription                                     | 300        |
| EE2  | Informer par écrit    | SMS d'excuse (30-50 mots + politesse)                        | 600        |
| EE3  | Décrire / Raconter    | Réponse à annonce (1 question + 1 info)                      | 600        |

RÈGLES PAR COMPÉTENCE :
- **CO** : OBLIGATOIRE — "script_audio" dans contenu (texte lu par TTS, NON affiché). "question" = consigne.
- **EO** : format "production_orale", "type_reponse": "oral". Jeux de rôle, questions ouvertes. "criteres_evaluation" + "mots_cles_attendus".
- **CE** : OBLIGATOIRE — "texte" dans contenu (document support).
- **EE** : format "production_ecrite", consigne de rédaction libre.

Tes exercices doivent être :
- Ancrés dans des situations réelles (démarches administratives, emploi, santé, logement, transport)
- Adaptés au niveau CECRL demandé
- Pédagogiquement rigoureux avec des distracteurs plausibles
- Originaux (jamais copiés d'épreuves officielles)

Formats possibles : qcm, vrai_faux, texte_lacunaire, appariement, transformation, production_ecrite, production_orale

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
          model: MODEL,
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
                  "Retourne un exercice TCF IRN structuré avec métadonnées de code.",
                parameters: {
                  type: "object",
                  properties: {
                    titre: { type: "string" },
                    consigne: { type: "string" },
                    competence: {
                      type: "string",
                      enum: ["CO", "CE", "EE", "EO", "Structures"],
                    },
                    format: {
                      type: "string",
                      enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation", "production_ecrite", "production_orale"],
                    },
                    difficulte: { type: "integer", minimum: 1, maximum: 5 },
                    niveau_vise: { type: "string", enum: ["A0", "A1", "A2", "B1", "B2", "C1"] },
                    metadata: {
                      type: "object",
                      properties: {
                        code: { type: "string" },
                        skill: { type: "string" },
                        sub_skill: { type: "string" },
                        time_limit_seconds: { type: "number" },
                      },
                      required: ["code", "skill", "sub_skill", "time_limit_seconds"],
                    },
                    contenu: {
                      type: "object",
                      properties: {
                        script_audio: { type: "string" },
                        type_reponse: { type: "string", enum: ["ecrit", "oral"] },
                        criteres_evaluation: { type: "object" },
                        mots_cles_attendus: { type: "array", items: { type: "string" } },
                        texte: { type: "string" },
                        image_description: { type: "string", description: "Description de l'image à rechercher (OBLIGATOIRE pour CE et EO). Ex: 'Une carte de résident française officielle avec photo d'identité'" },
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
                          },
                        },
                      },
                      required: ["items"],
                    },
                  },
                  required: ["titre", "consigne", "competence", "format", "difficulte", "niveau_vise", "metadata", "contenu"],
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

    // Post-processing: fetch photos from Pexels for exercises that have image_description
    const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
    const desc = exercise.contenu?.image_description;
    if (desc && typeof desc === "string" && desc.trim().length > 0 && PEXELS_API_KEY) {
      try {
        const query = encodeURIComponent(desc.slice(0, 100));
        const pexelsResponse = await fetch(
          `https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape&size=medium`,
          { headers: { Authorization: PEXELS_API_KEY } }
        );
        if (pexelsResponse.ok) {
          const pexelsData = await pexelsResponse.json();
          const photos = pexelsData.photos;
          if (photos && photos.length > 0) {
            const photo = photos[Math.floor(Math.random() * photos.length)];
            exercise.contenu.image_url = photo.src.medium;
            exercise.contenu.image_credit = {
              photographer: photo.photographer,
              photographer_url: photo.photographer_url,
              pexels_url: photo.url,
            };
            console.log("Pexels photo found for smart-generator:", photo.src.medium);
          } else {
            console.warn("No Pexels results for:", desc.slice(0, 50));
          }
        }
      } catch (imgErr) {
        console.error("Pexels search error:", imgErr);
      }
    }

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
