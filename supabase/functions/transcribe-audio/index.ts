import { checkConsent, consentBlockedResponse, getUserIdFromAuth, logAICall } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  try {
    const apiKey = Deno.env.get("GOOGLE_STT_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_STT_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = await getUserIdFromAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audio transcription always requires biometric consent
    const consent = await checkConsent({ userId, requireBiometric: true });
    if (!consent.ok) {
      await logAICall({
        subject_user_id: userId, triggered_by_user_id: userId,
        function_name: 'transcribe-audio', provider: 'google',
        data_categories: ['audio', 'voice'], status: 'blocked_no_consent',
        consent_version: consent.consentVersion,
      });
      return consentBlockedResponse(consent.reason ?? 'consent_required', corsHeaders);
    }

    const { audioBase64 } = await req.json();

    if (!audioBase64 || typeof audioBase64 !== "string" || audioBase64.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Le champ 'audioBase64' est requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sttUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    const sttResponse = await fetch(sttUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding: "LINEAR16",
          sampleRateHertz: 16000,
          languageCode: "fr-FR",
        },
        audio: {
          content: audioBase64,
        },
      }),
    });

    if (!sttResponse.ok) {
      const errBody = await sttResponse.text();
      console.error("Google STT error:", sttResponse.status, errBody);
      return new Response(
        JSON.stringify({ error: "Erreur Google STT", details: errBody, transcript: "" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sttData = await sttResponse.json();
    const transcript =
      sttData?.results?.[0]?.alternatives?.[0]?.transcript || "";

    await logAICall({
      subject_user_id: userId, triggered_by_user_id: userId,
      function_name: 'transcribe-audio', provider: 'google', model: 'speech-v1',
      data_categories: ['audio', 'voice', 'transcript'],
      status: 'ok', duration_ms: Date.now() - startedAt,
      consent_version: consent.consentVersion,
    });

    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("transcribe-audio error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, transcript: "" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
