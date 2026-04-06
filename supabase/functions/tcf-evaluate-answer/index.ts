/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { studentAnswer, exerciseContent, rule } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    const prompt = `Professeur FLE. Exercice : "${exerciseContent}". Règle : "${rule || 'Grammaire générale'}".
    Réponse de l'étudiant : "${studentAnswer}".
    Évalue la réponse, corrige-la avec bienveillance.
    Renvoie UNIQUEMENT un JSON contenant :
    - "is_correct": boolean
    - "correction_text": Message d'explication pédagogique.
    - "score": entier sur 10.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await response.json();
    const evaluation = JSON.parse(data.candidates[0].content.parts[0].text);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
