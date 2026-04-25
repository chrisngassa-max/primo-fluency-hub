import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { validateAndFix } from "../_shared/exercise-validator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { exercices, sessionTitle, niveauCible } = await req.json();
    // AI key check moved to shared ai-client

    const exercicesSummary = (exercices || []).map((ex: any, i: number) =>
      `${i + 1}. "${ex.titre}" (${ex.competence}, ${ex.format}, niveau ${ex.niveau_vise}) — Consigne: ${ex.consigne}`
    ).join("\n");

    const systemPrompt = `Tu es un expert en ingénierie pédagogique FLE/TCF IRN.
Tu génères des tests de bilan de séance pour vérifier les acquis immédiats des apprenants.

Règles :
- Génère entre 5 et 15 questions basées sur les exercices traités en classe
- Chaque question doit tester la même compétence que l'exercice source
- Formats supportés : qcm (4 options), vrai_faux (2 options), texte_lacunaire
- Les questions doivent être DIFFÉRENTES des exercices originaux mais tester les mêmes compétences
- Niveau adapté au niveau cible de la séance
- Contexte IRN (préfecture, emploi, logement, etc.)
- Chaque question a exactement UNE bonne réponse

OBLIGATIONS PAR COMPÉTENCE :
- CO (Compréhension orale) : fournis OBLIGATOIREMENT "script_audio" = un texte court (30-60 mots) à lire à voix haute. La question porte sur ce script.
- CE (Compréhension écrite) : fournis OBLIGATOIREMENT "texte_support" = un texte support (40-100 mots) à lire. La question porte sur ce texte.
- EE / EO / Structures : pas de support audio/texte requis.
- bonne_reponse DOIT figurer EXACTEMENT dans options (QCM) ; "vrai" ou "faux" pour vrai_faux.`;

    const userPrompt = `SÉANCE : "${sessionTitle || "Séance"}"
NIVEAU CIBLE : ${niveauCible || "A1"}

EXERCICES TRAITÉS EN CLASSE :
${exercicesSummary}

Génère un test de bilan pour vérifier les acquis de cette séance.`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_bilan_test",
            description: "Génère les questions du test de bilan",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string", description: "Texte de la question" },
                      competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                      format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire"] },
                      script_audio: { type: "string", description: "OBLIGATOIRE pour CO : texte (30-60 mots) à lire à voix haute par TTS" },
                      texte_support: { type: "string", description: "OBLIGATOIRE pour CE : texte support (40-100 mots) à lire par l'apprenant" },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        description: "Options de réponse (2 pour vrai/faux, 4 pour QCM, vide pour lacunaire)"
                      },
                      bonne_reponse: { type: "string", description: "La bonne réponse exacte" },
                      explication: { type: "string", description: "Explication courte de la bonne réponse" },
                    },
                    required: ["question", "competence", "format", "options", "bonne_reponse", "explication"],
                    additionalProperties: false,
                  },
                },
                competences_couvertes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Liste des compétences couvertes par le test",
                },
              },
              required: ["questions", "competences_couvertes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_bilan_test" } },
      });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer le test");

    const result = JSON.parse(toolCall.function.arguments);

    // ── Validation question par question (chaque question = mini exercice à 1 item) ──
    const validatedQuestions: any[] = [];
    const excluded: { question: string; reason: string }[] = [];
    for (const q of result.questions || []) {
      const asExercise = {
        titre: q.question?.slice(0, 60) || "Question bilan",
        consigne: "Réponds à la question.",
        competence: q.competence,
        format: q.format,
        difficulte: 3,
        niveau_vise: niveauCible || "A1",
        contenu: {
          // Audio support pour CO, texte support pour CE — requis par le validator
          script_audio: q.competence === "CO" ? (q.script_audio || "") : undefined,
          texte: q.competence === "CE" ? (q.texte_support || q.texte || "") : undefined,
          items: [{ question: q.question, options: q.options, bonne_reponse: q.bonne_reponse, explication: q.explication }],
        },
      };
      const validated = await validateAndFix(asExercise, { niveau: niveauCible || "A1" });
      if (!validated) {
        excluded.push({ question: q.question || "?", reason: "validation_failed" });
        continue;
      }
      // Reconstruire format question original — IMPORTANT : préserver script_audio + texte_support
      const fixedContenu = validated.exercise.contenu || {};
      const fixedItem = fixedContenu.items?.[0] || {};
      validatedQuestions.push({
        ...q,
        question: fixedItem.question || q.question,
        options: fixedItem.options || q.options,
        bonne_reponse: fixedItem.bonne_reponse ?? q.bonne_reponse,
        explication: fixedItem.explication || q.explication,
        script_audio: fixedContenu.script_audio || q.script_audio || "",
        texte_support: fixedContenu.texte || q.texte_support || "",
      });
    }

    return new Response(
      JSON.stringify({ ...result, questions: validatedQuestions, excluded, totalExcluded: excluded.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-bilan-test error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
