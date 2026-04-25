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
    const { scoresParCompetence, niveauCible, sessionTitle } = await req.json();
    // AI key check moved to shared ai-client

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

═══════════════════════════════════════════════════
CARTOGRAPHIE DES EXERCICES TCF IRN — NIVEAU A1
Chaque exercice DOIT porter un code et des métadonnées issus de cette cartographie.
═══════════════════════════════════════════════════

### CO — TTS obligatoire
CO1 (Identifier situation, 45s), CO2 (Sujet global, 50s), CO3 (Consignes/Règles, 45s), CO4 (Info chiffrée, 50s)
→ "script_audio" OBLIGATOIRE dans contenu. "question" = consigne d'écoute.

### CE — texte support obligatoire
CE1 (Signalétique, 80s), CE2 (Messages familiers, 80s), CE3 (Recherche d'info, 80s), CE4 (Texte admin, 100s)
→ "texte" OBLIGATOIRE dans contenu.

### EO — production_orale + type_reponse "oral"
EO1 (Se présenter, 120s), EO2 (Interaction, 180s), EO3 (Survie, 120s), EO4 (Demande d'info, 120s)
→ format "production_orale", "criteres_evaluation" + "mots_cles_attendus".

### EE — production_ecrite
EE1 (Remplir/Saisir, 300s), EE2 (Informer par écrit, 600s), EE3 (Décrire/Raconter, 600s)

Règles :
- Pour chaque compétence < 60% : exercices de renforcement (même niveau ou inférieur)
- Pour 60-80% : exercices de consolidation (variantes)
- 3 à 5 exercices par devoir maximum
- Contexte IRN obligatoire
- Chaque exercice doit avoir un metadata avec code, skill, sub_skill, time_limit_seconds`;

    const userPrompt = `RÉSULTATS DU TEST DE BILAN (séance "${sessionTitle}") :
${competencesATravailler.map(c => `- ${c.competence} : ${c.score}% → ${c.type}`).join("\n")}

NIVEAU CIBLE : ${niveauCible || "A1"}

Génère les devoirs ciblés pour chaque compétence en difficulté. Attribue un code TCF IRN à chaque exercice.`;

    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_devoirs",
            description: "Génère les devoirs ciblés sur les lacunes avec codes TCF IRN",
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
                      format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "production_orale", "production_ecrite"] },
                      niveau_vise: { type: "string" },
                      type_reponse: { type: "string", enum: ["ecrit", "oral"] },
                      script_audio: { type: "string" },
                      criteres_evaluation: { type: "object" },
                      mots_cles_attendus: { type: "array", items: { type: "string" } },
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
                    required: ["competence", "type_devoir", "titre", "consigne", "format", "niveau_vise", "metadata", "items"],
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
      });
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
