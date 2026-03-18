import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scores, eleveNom } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un expert en FLE spécialisé dans la préparation au TCF IRN.
Tu analyses les scores d'évaluation d'un élève primo-arrivant et fournis des recommandations pédagogiques.
Sois concis, pratique et bienveillant. Écris en français. Structure ta réponse avec des titres en markdown.`;

    const userPrompt = `Voici les scores d'évaluation de l'élève${eleveNom ? ` ${eleveNom}` : ""} :
- Compréhension Orale (CO) : ${scores.CO}/100
- Compréhension Écrite (CE) : ${scores.CE}/100
- Expression Orale (EO) : ${scores.EO}/100
- Expression Écrite (EE) : ${scores.EE}/100

Score moyen : ${Math.round((scores.CO + scores.CE + scores.EO + scores.EE) / 4)}/100

Donne :
1. Un niveau CECRL estimé (A0, A1, A2, B1)
2. Les points forts et points faibles
3. Les priorités pédagogiques (3 max)
4. Des exercices recommandés pour les compétences les plus faibles`;

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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    return new Response(JSON.stringify({ analysis: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-test-entree error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
