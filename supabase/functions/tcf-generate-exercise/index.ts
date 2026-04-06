/// <reference types="@supabase/functions-js/edge-runtime.d.ts" />

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
    - "contenu": Le corps de l'exercice (objet JSON avec "items" contenant les questions/options)
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const exercise = JSON.parse(data.candidates[0].content.parts[0].text);

    // Fetch illustration from Pexels using mot_cle_image
    const pexelsKey = Deno.env.get('PEXELS_API_KEY');
    if (pexelsKey && exercise.mot_cle_image) {
      try {
        const pexelsResp = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(exercise.mot_cle_image)}&per_page=1&orientation=landscape`,
          { headers: { Authorization: pexelsKey } }
        );
        if (pexelsResp.ok) {
          const pexelsData = await pexelsResp.json();
          if (pexelsData.photos?.length > 0) {
            exercise.image_url = pexelsData.photos[0].src.medium;
            exercise.image_credit = `Photo by ${pexelsData.photos[0].photographer} on Pexels`;
          }
        }
      } catch (imgErr) {
        console.error("Pexels image fetch error:", imgErr);
        // Non-blocking: exercise works fine without image
      }
    }

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
