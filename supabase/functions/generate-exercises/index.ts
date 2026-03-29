import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pointName, competence, niveauVise, count = 10, difficultyLevel, gabaritNumero } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // If gabaritNumero provided, load gabarit from DB
    let gabarit: any = null;
    if (gabaritNumero != null) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from("gabarits_pedagogiques")
        .select("*")
        .eq("numero", gabaritNumero)
        .maybeSingle();
      if (error) console.error("Error loading gabarit:", error);
      gabarit = data;
    }

    // Determine difficulty range description
    const diffLevel = difficultyLevel ?? 5;
    let difficultyDescription = "";
    if (diffLevel <= 2) {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — LITTÉRATIE/ALPHA : reconnaissance de lettres, sons de base, chiffres simples, vocabulaire ultra-basique (bonjour, merci, oui/non). Questions très courtes avec support visuel.`;
    } else if (diffLevel <= 7) {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — PROGRESSION VERS A1 : phrases courtes, vocabulaire quotidien, situations simples de la vie courante. Complexité progressive des structures grammaticales.`;
    } else {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — STANDARD TCF IRN A1 : exercices au standard exact des épreuves du TCF IRN niveau A1. Textes authentiques simplifiés, consignes proches de l'examen.`;
    }

    let gabaritPrompt = "";
    if (gabarit) {
      const lexique = Array.isArray(gabarit.lexique_cibles) ? gabarit.lexique_cibles.join(", ") : (gabarit.lexique_cibles || "");
      gabaritPrompt = `

Tu génères des exercices pour la séance suivante du plan TCF IRN v2.0 :

SÉANCE : ${gabarit.titre}
BLOC : ${gabarit.bloc || "Non spécifié"}
PALIER : ${gabarit.palier_cecrl || "Non spécifié"}
OBJECTIF : ${gabarit.objectif_principal || "Non spécifié"}
LEXIQUE OBLIGATOIRE : ${lexique}
CONSIGNES TECHNIQUES : ${gabarit.consignes_generation || "Aucune consigne spécifique"}
CRITÈRES DE RÉUSSITE : ${gabarit.criteres_reussite || "Non spécifiés"}

RÈGLES STRICTES :
1. N'utilise QUE le lexique listé ci-dessus pour les exercices de cette séance
2. Respecte les formats d'exercices indiqués dans les consignes techniques
3. Tous les contextes doivent être administratifs / vie quotidienne primo-arrivant
4. Niveau de langue : ${gabarit.palier_cecrl || niveauVise} — adapter la complexité en conséquence
5. Ne pas inventer de situations hors du contexte IRN (préfecture, OFII, médecin, école...)`;
    }

    const systemPrompt = `Tu es un expert en FLE (Français Langue Étrangère) spécialisé dans la préparation au TCF IRN (Intégration et Résidence en France).
Tu dois générer exactement ${count} exercices pour le point à maîtriser suivant.

CALIBRAGE DE DIFFICULTÉ (CRITIQUE) :
${difficultyDescription}
Chaque exercice ET chaque item doit être calibré au niveau de difficulté ${diffLevel}/10.
Le champ "difficulte" de chaque exercice DOIT être exactement ${diffLevel}.

RÈGLES STRICTES :
- Chaque exercice doit être ORIGINAL (jamais copié d'épreuves officielles TV5Monde)
- Contexte : situations réelles de la vie en France (préfecture, CAF, emploi, logement, transport, santé, citoyenneté)
- Public : adultes primo-arrivants, niveau ${niveauVise}
- Formats possibles : qcm, vrai_faux, texte_lacunaire, appariement, transformation
- Langue simple et claire
- IMPORTANT : pour les exercices de CE (compréhension écrite), tu DOIS OBLIGATOIREMENT inclure un champ "texte" dans contenu avec le paragraphe/document support à lire AVANT les questions. Sans ce texte, l'exercice est inutilisable pour l'élève.
- Pour les exercices de CO, inclus aussi un champ "texte" avec le script audio/dialogue.

IMPORTANT — Pour CHAQUE exercice, tu dois aussi proposer un "animation_guide" :
- scenario : une mise en situation simple et concrète liée à l'exercice
- jeu : une règle de jeu ludique adaptée au niveau (jeu de rôle, mime, jeu de cartes, Jacques a dit, etc.)
- materiel : ce qu'il faut préparer (jetons, images, cartes, etc.)
- objectif_oral : la structure de phrase que les élèves doivent réussir à prononcer

Tu DOIS utiliser le tool "generate_exercises" pour retourner le résultat.${gabaritPrompt}`;

    const userPrompt = `Génère ${count} exercices pour :
- Point à maîtriser : "${pointName}"
- Compétence : ${competence}
- Niveau visé : ${niveauVise}
- Difficulté calibrée : ${diffLevel}/10${gabarit ? `\n- Gabarit séance : ${gabarit.titre} (n°${gabarit.numero})` : ""}`;

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
              description: "Return generated exercises with animation guides",
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
                        difficulte: { type: "number", minimum: 0, maximum: 10, description: "Niveau de difficulté sur l'échelle 0-10" },
                        contenu: {
                          type: "object",
                          properties: {
                            texte: { type: "string", description: "Texte support / paragraphe à lire avant les questions (OBLIGATOIRE pour CE, recommandé pour CO)" },
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
                        animation_guide: {
                          type: "object",
                          description: "Guide d'animation ludique pour le formateur",
                          properties: {
                            scenario: { type: "string", description: "Mise en situation concrète" },
                            jeu: { type: "string", description: "Règle de jeu ludique" },
                            materiel: { type: "string", description: "Matériel à préparer" },
                            objectif_oral: { type: "string", description: "Structure de phrase cible" },
                          },
                          required: ["scenario", "jeu", "materiel", "objectif_oral"],
                        },
                      },
                      required: ["titre", "consigne", "format", "difficulte", "contenu", "animation_guide"],
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
