import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, text, audioBase64 } = await req.json()
    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY')
    if (!apiKey) throw new Error('GOOGLE_CLOUD_API_KEY non configurée')

    if (action === 'tts') {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B' },
            audioConfig: { audioEncoding: 'MP3' },
          }),
        }
      );
      const data = await response.json();
      return new Response(JSON.stringify({ audioBase64: data.audioContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'stt') {
      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: 'fr-FR' },
            audio: { content: audioBase64 },
          }),
        }
      );
      const data = await response.json();
      const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || "";
      return new Response(JSON.stringify({ transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error('Action invalide');
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
