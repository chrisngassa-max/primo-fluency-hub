import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { theme, level } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY non configurée dans Supabase')

    const prompt = `Tu es un professeur expert certifié FLE. Crée un exercice communicatif pour des adultes niveau ${level || 'B1'} sur : "${theme}".
    L'exercice doit être qualitatif et ancré dans la réalité.
    Renvoie UNIQUEMENT un objet JSON avec : 
    - "titre": Titre de l'exercice
    - "consigne": Ce que l'étudiant doit faire
    - "contenu": Le corps de l'exercice
    - "mot_cle_image": Un mot clé simple EN ANGLAIS (ex: "coffee") décrivant l'exercice pour requêter une image gratuite sur les banques photo.`;

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
    const exercise = JSON.parse(data.candidates[0].content.parts[0].text);

    return new Response(JSON.stringify(exercise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
