import { checkConsent, consentBlockedResponse, getUserIdFromAuth, logAICall } from "../_shared/check-consent.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = Date.now();
  try {
    const { action, text, audioBase64 } = await req.json()
    const userId = await getUserIdFromAuth(req);

    // TTS for the consent modal itself is generic and allowed without consent.
    // Other actions require consent (biometric for STT, AI for non-generic TTS).
    const isConsentTTS = action === 'tts' && typeof text === 'string' && text.includes("Cette formation utilise une IA");

    if (!isConsentTTS) {
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const requireBio = action === 'stt';
      const consent = await checkConsent({ userId, requireBiometric: requireBio });
      if (!consent.ok) {
        await logAICall({
          subject_user_id: userId,
          triggered_by_user_id: userId,
          function_name: 'tcf-process-audio',
          provider: 'google',
          data_categories: action === 'stt' ? ['audio', 'voice'] : ['text'],
          status: 'blocked_no_consent',
          consent_version: consent.consentVersion,
        });
        return consentBlockedResponse(consent.reason ?? 'consent_required', corsHeaders);
      }
    }

    if (action === 'tts') {
      const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY')
      if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY non configurée')

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: 'fr-FR', name: 'fr-FR-Standard-F' },
            audioConfig: { audioEncoding: 'MP3' },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`TTS API error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (!isConsentTTS && userId) {
        await logAICall({
          subject_user_id: userId, triggered_by_user_id: userId,
          function_name: 'tcf-process-audio', provider: 'google', model: 'fr-FR-Standard-F',
          data_categories: ['text'], status: 'ok', duration_ms: Date.now() - startedAt,
        });
      }
      return new Response(JSON.stringify({ audioBase64: data.audioContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'stt') {
      const apiKey = Deno.env.get('GOOGLE_STT_API_KEY')
      if (!apiKey) throw new Error('GOOGLE_STT_API_KEY non configurée')

      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 44100,
              languageCode: 'fr-FR',
            },
            audio: { content: audioBase64 },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error("STT API error:", errText);
        return new Response(
          JSON.stringify({ transcript: "(Aucune parole détectée)" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || "(Aucune parole détectée)";
      if (userId) {
        await logAICall({
          subject_user_id: userId, triggered_by_user_id: userId,
          function_name: 'tcf-process-audio', provider: 'google', model: 'speech-v1',
          data_categories: ['audio', 'voice', 'transcript'],
          status: 'ok', duration_ms: Date.now() - startedAt,
        });
      }
      return new Response(JSON.stringify({ transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error('Action invalide. Utilisez "tts" ou "stt".');
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
