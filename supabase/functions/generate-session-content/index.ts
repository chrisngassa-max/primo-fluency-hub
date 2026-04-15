import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { titre, objectifs, competences_cibles, niveau_cible, duree_minutes, exercices_suggeres, gabaritNumero, micro_competences } = await req.json();
    // AI key check moved to shared ai-client

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
3. La documentation_fournie : tout le matériel pédagogique nécessaire au formateur et aux élèves pour réaliser l'atelier ludique

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

DOCUMENTATION_FOURNIE (OBLIGATOIRE pour chaque atelier ludique) :
- guide_formateur : instructions pas-à-pas claires pour animer l'activité en classe
- fiches_eleves : un tableau de fiches physiques. Chaque fiche = un rôle ou une mission (ex: "Fiche A : Le Vendeur", "Fiche B : Le Client")
  - titre_fiche : titre de la fiche
  - contenu_fiche : description du rôle, mission spécifique, vocabulaire imposé, budget/prix/données concrètes
  - lexique_cles : liste de 5-10 mots/phrases de niveau A1 à utiliser pendant le jeu
- Le formateur doit avoir 100% du matériel textuel nécessaire. AUCUNE recherche externe permise.
- Si c'est un jeu de rôle au marché, génère les prix, la liste des produits, le budget de l'acheteur.
- Si c'est une simulation médicale, génère les symptômes, le vocabulaire du corps, les phrases types.
${objectifs ? `- Objectifs de la séance : ${objectifs}` : ""}
${exercices_suggeres?.length ? `- Types d'exercices suggérés : ${exercices_suggeres.join(", ")}` : ""}
${(() => {
  if (!micro_competences || !Array.isArray(micro_competences) || micro_competences.length === 0) return "";
  const lines = micro_competences.map((mc: any, i: number) => `${i + 1}. ${mc.texte} — statut : ${mc.statut === "a_renforcer" ? "à_renforcer" : "normal"} (${mc.competence_globale})`).join("\n");
  return `
MICRO-COMPÉTENCES CIBLÉES (ordre de priorité du formateur) :
${lines}

Instructions de pondération :
- Compétences marquées 'à_renforcer' : générer 40% de questions supplémentaires sur ces points, ou augmenter la difficulté d'un palier.
- Compétences en position 1 et 2 : priorité maximale dans la génération.
- Compétences en position 3 et suivantes : volume standard.`;
})()}
${gabaritBlock}

═══════════════════════════════════════════════════
RÈGLES ABSOLUES SUR LA LANGUE — PUBLIC A0/A1 ALLOPHONE
Ces règles s'appliquent à TOUS les textes générés sans exception.
═══════════════════════════════════════════════════

CONSIGNES (instructions données à l'élève) :
✅ Maximum 12 mots par consigne
✅ Structure imposée : Verbe à l'impératif + complément court
✅ Valide : "Écoutez et choisissez.", "Lisez et répondez.", "Regardez l'image."
✅ Valide : "Choisissez la bonne réponse.", "Cochez vrai ou faux."
❌ Interdit : subordonnées relatives ou causales
❌ Interdit : double négation ("ne... pas... sans...")
❌ Interdit : plus de 2 actions dans une même consigne
❌ Interdit : "En vous appuyant sur...", "Après avoir lu...", "En tenant compte de..."

QUESTIONS ET ITEMS :
✅ Phrases courtes : Sujet + Verbe + Complément
✅ Vocabulaire du quotidien : les mots utilisés dans la vie réelle A0
✅ Maximum 20 mots par question
❌ Interdit : vocabulaire abstrait (intégration, démarche administrative complexe...)
❌ Interdit : phrases imbriquées

OPTIONS DE RÉPONSE QCM :
✅ Maximum 6 mots par option
✅ Cohérentes entre elles (même type grammatical)
✅ Les 3 options doivent être plausibles (pas d'option absurde évidente)

EXPLICATIONS (feedback après erreur) :
✅ Maximum 20 mots
✅ Structure : "La bonne réponse est [X] parce que [raison courte]."
✅ Exemple : "La bonne réponse est 'lundi' parce que le texte dit 'cours le lundi'."
❌ Interdit : explications grammaticales techniques pour A0

AVANT de finaliser ta réponse, vérifie chaque consigne générée :
- Compte les mots → si > 12, reformule
- Vérifie la structure impérative → sinon, reformule
- Vérifie qu'il n'y a qu'une seule action demandée → sinon, coupe en 2

Utilise le tool fourni pour retourner le résultat.`;

    const userPrompt = `Génère le contenu complet de la séance "${titre}" (${duree} min, niveau ${niveau}, compétences : ${competences_cibles.join(", ")}).`;

    await callAI({
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
                            documentation_fournie: {
                              type: "object",
                              description: "Matériel pédagogique complet pour le formateur et les élèves",
                              properties: {
                                guide_formateur: { type: "string", description: "Instructions pas-à-pas pour animer l'activité" },
                                fiches_eleves: {
                                  type: "array",
                                  description: "Fiches physiques à distribuer aux élèves",
                                  items: {
                                    type: "object",
                                    properties: {
                                      titre_fiche: { type: "string", description: "Ex: Fiche A — Le Vendeur" },
                                      contenu_fiche: { type: "string", description: "Rôle, mission, vocabulaire imposé, données concrètes" },
                                      lexique_cles: { type: "array", items: { type: "string" }, description: "5-10 mots/phrases A1 à utiliser" },
                                    },
                                    required: ["titre_fiche", "contenu_fiche", "lexique_cles"],
                                  },
                                },
                              },
                              required: ["guide_formateur", "fiches_eleves"],
                            },
                          },
                          required: ["scenario", "jeu", "materiel", "objectif_oral", "documentation_fournie"],
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

    // Remap atelier_ludique → animation_guide for DB column compatibility
    const exercices = (parsed.exercices || []).map((ex: any) => {
      if (ex.atelier_ludique) {
        ex.animation_guide = ex.atelier_ludique;
        delete ex.atelier_ludique;
      }
      return ex;
    });

    return new Response(JSON.stringify({ exercices }), {
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
