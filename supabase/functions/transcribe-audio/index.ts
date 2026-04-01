const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_STT_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_STT_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          encoding: "WEBM_OPUS",
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
        { status: sttResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sttData = await sttResponse.json();
    const transcript =
      sttData?.results?.[0]?.alternatives?.[0]?.transcript || "";

    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("transcribe-audio error:", err);
    return new Response(
      JSON.stringify({ error: err.message, transcript: "" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
