import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const _triggeredBy = await getUserIdFromAuth(req);
    const _secretBlock = await ensurePseudonymSecretOrLog("parse-training-plan", corsHeaders, null);
    if (_secretBlock) return _secretBlock;
    await logAICall({ function_name: "parse-training-plan", triggered_by_user_id: _triggeredBy, status: "ok", data_categories: [], pseudonymization_level: "none" });
    const { planText, groupId, formateurId } = await req.json();
    // AI key check moved to shared ai-client

    if (!planText || !groupId || !formateurId) {
      return new Response(
        JSON.stringify({ error: "planText, groupId et formateurId sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Tu es un assistant pédagogique spécialisé FLE/TCF IRN. 
On te donne un plan de formation brut (texte libre, tableau markdown, ou mixte). 
Tu dois le transformer en un tableau JSON de séances structurées.

Chaque séance doit contenir :
- titre (string) : titre clair de la séance
- objectifs (string) : objectifs pédagogiques détaillés
- competences_cibles (string[]) : parmi ["CO","CE","EE","EO","Structures"]
- duree_minutes (number) : durée estimée en minutes (60, 90, 120...)
- niveau_cible (string) : niveau CECRL visé (A0, A1, A2, B1, B2, C1)
- date_suggestion (string|null) : date suggérée si mentionnée (format YYYY-MM-DD), sinon null
- exercices_suggeres (string[]) : liste de types d'exercices recommandés

IMPORTANT : Retourne UNIQUEMENT le JSON via l'outil fourni, pas de texte.`;

    const userPrompt = `Voici le plan de formation à analyser et structurer en séances :\n\n${planText}`;

    const data = await callAI({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_sessions",
                description: "Crée les séances structurées à partir du plan de formation",
                parameters: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          titre: { type: "string" },
                          objectifs: { type: "string" },
                          competences_cibles: {
                            type: "array",
                            items: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                          },
                          duree_minutes: { type: "number" },
                          niveau_cible: { type: "string" },
                          date_suggestion: { type: "string", nullable: true },
                          exercices_suggeres: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: ["titre", "objectifs", "competences_cibles", "duree_minutes", "niveau_cible"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["sessions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_sessions" } },
        });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) throw new Error("L'IA n'a pas pu analyser le plan");

    const parsed = JSON.parse(toolCall.function.arguments);
    const sessions = parsed.sessions || [];

    return new Response(JSON.stringify({ sessions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-training-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
