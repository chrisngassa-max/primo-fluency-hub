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
    const { titre, objectifs, competences_cibles, niveau_cible, duree_minutes, exercices_suggeres, gabaritNumero } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!titre || !competences_cibles || competences_cibles.length === 0) {
      return new Response(
        JSON.stringify({ error: "titre et competences_cibles sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const niveau = niveau_cible || "A1";
    const duree = duree_minutes || 180;
    const nbExercices = Math.max(8, Math.round(duree / 18));

    // Load gabarit if provided
    let gabarit: any = null;
    if (gabaritNumero != null) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);
      const { data } = await sb
        .from("gabarits_pedagogiques")
        .select("*")
        .eq("numero", gabaritNumero)
        .maybeSingle();
      gabarit = data;
    }

    let gabaritBlock = "";
    if (gabarit) {
      const lexique = Array.isArray(gabarit.lexique_cibles) ? gabarit.lexique_cibles.join(", ") : (gabarit.lexique_cibles || "");
      gabaritBlock = `

GABARIT SÉANCE TCF IRN v2.0 :
SÉANCE : ${gabarit.titre}
BLOC : ${gabarit.bloc || "Non spécifié"}
PALIER : ${gabarit.palier_cecrl || "Non spécifié"}
OBJECTIF : ${gabarit.objectif_principal || "Non spécifié"}
LEXIQUE OBLIGATOIRE : ${lexique}
CONSIGNES TECHNIQUES : ${gabarit.consignes_generation || "Aucune"}
CRITÈRES DE RÉUSSITE : ${gabarit.criteres_reussite || "Non spécifiés"}

RÈGLES DU GABARIT :
1. N'utilise QUE le lexique listé ci-dessus
2. Respecte les formats indiqués dans les consignes techniques
3. Contextes administratifs / vie quotidienne primo-arrivant uniquement
4. Niveau : ${gabarit.palier_cecrl || niveau} — adapter la complexité
5. Pas de situations hors contexte IRN`;
    }

    const systemPrompt = `Tu es un expert FLE spécialisé TCF IRN. Tu dois générer le contenu complet d'une séance de ${duree} minutes pour un cours collectif d'adultes primo-arrivants.

Pour CHAQUE exercice, tu dois fournir :
1. L'exercice numérique (visible par l'élève) : titre, consigne, format, items avec options et réponses
2. L'atelier ludique associé (visible uniquement par le formateur) : mise en situation, jeu, matériel, objectif oral

RÈGLES :
- Génère exactement ${nbExercices} paires [exercice + atelier ludique]
- Niveau : ${niveau}
- Compétences à couvrir : ${competences_cibles.join(", ")}
- Contextes IRN : préfecture, CAF, emploi, logement, transport, santé, citoyenneté
- Varier les formats : qcm, vrai_faux, texte_lacunaire, appariement, transformation
- Chaque exercice doit être ORIGINAL
- IMPORTANT : pour les exercices de CE (compréhension écrite), tu DOIS OBLIGATOIREMENT inclure un champ "texte" dans contenu avec le paragraphe/document à lire AVANT les questions. Sans ce texte, l'exercice est inutilisable.
- Pour les exercices de CO, inclus aussi un champ "texte" avec le script audio/dialogue à écouter.
- Les ateliers ludiques doivent être réalistes et réalisables en classe (jeu de rôle, mime, Jacques a dit, cartes, etc.)
${objectifs ? `- Objectifs de la séance : ${objectifs}` : ""}
${exercices_suggeres?.length ? `- Types d'exercices suggérés : ${exercices_suggeres.join(", ")}` : ""}
${gabaritBlock}

Utilise le tool fourni pour retourner le résultat.`;

    const userPrompt = `Génère le contenu complet de la séance "${titre}" (${duree} min, niveau ${niveau}, compétences : ${competences_cibles.join(", ")}).`;

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
              name: "create_session_content",
              description: "Crée le contenu complet de la séance avec exercices et ateliers ludiques",
              parameters: {
                type: "object",
                properties: {
                  exercices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titre: { type: "string" },
                        consigne: { type: "string" },
                        format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"] },
                        competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                        difficulte: { type: "number" },
                        contenu: {
                          type: "object",
                          properties: {
                            texte: { type: "string", description: "Texte support / paragraphe à lire avant les questions (obligatoire pour CE, facultatif sinon)" },
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
                        atelier_ludique: {
                          type: "object",
                          properties: {
                            scenario: { type: "string", description: "Mise en situation concrète pour le formateur" },
                            jeu: { type: "string", description: "Règle de jeu ludique détaillée" },
                            materiel: { type: "string", description: "Matériel à préparer" },
                            objectif_oral: { type: "string", description: "Structure de phrase cible à l'oral" },
                            duree_minutes: { type: "number", description: "Durée estimée de l'atelier" },
                            variante: { type: "string", description: "Variante possible pour adapter" },
                          },
                          required: ["scenario", "jeu", "materiel", "objectif_oral"],
                        },
                      },
                      required: ["titre", "consigne", "format", "competence", "difficulte", "contenu", "atelier_ludique"],
                    },
                  },
                },
                required: ["exercices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_session_content" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer le contenu de la séance");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ exercices: parsed.exercices || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-session-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
