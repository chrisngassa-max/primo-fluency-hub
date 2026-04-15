import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { item, contexte, instruction } = await req.json();

    if (!item || !contexte) {
      return new Response(JSON.stringify({ error: "item et contexte requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un expert FLE TCF IRN. Tu reformules un item d'exercice en gardant la même intention pédagogique mais en respectant les règles A0/A1 :
- Consigne ≤ 12 mots
- Impératif
- Vocabulaire A1
- Pas de subordonnée
- Pas de subjonctif
- Options de réponse ≤ 6 mots chacune
- Explication ≤ 20 mots

Si le formateur donne une instruction, suis-la strictement.
Tu DOIS utiliser le tool "reformulate_item" pour retourner le résultat.`;

    const userPrompt = `Item à reformuler : ${JSON.stringify(item)}

Contexte de l'exercice :
- Titre : ${contexte.titre_exercice}
- Consigne : ${contexte.consigne}
- Texte support : ${contexte.texte_support || "aucun"}
- Compétence : ${contexte.competence}
- Niveau : ${contexte.niveau}

${instruction ? `Instruction du formateur : "${instruction}"` : "Aucune instruction particulière — reformule pour améliorer la clarté et l'accessibilité."}`;

    const data = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "reformulate_item",
            description: "Return the reformulated exercise item",
            parameters: {
              type: "object",
              properties: {
                item: {
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
              required: ["item"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "reformulate_item" } },
    });

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reformulate-exercise-item error:", e);
    const status = (e as any).status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
