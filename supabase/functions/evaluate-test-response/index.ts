import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { criteres_evaluation, reponse_apprenant, metadata } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY)
      throw new Error("LOVABLE_API_KEY is not configured");

    // Determine if this is an oral response (EO) for high-tolerance mode
    const code = metadata?.code || "";
    const isOral = code.startsWith("EO") || metadata?.type_reponse === "oral";

    const toleranceBlock = isOral
      ? `

TOLÉRANCE PHONÉTIQUE ÉLEVÉE (CRITIQUE pour les réponses orales transcrites par STT) :
La réponse a été TRANSCRITE automatiquement depuis un enregistrement vocal d'un apprenant de niveau A0-A1. Le moteur Speech-to-Text fait des erreurs fréquentes, surtout avec un accent étranger.

Tu DOIS :
1. Accepter les homophones et approximations phonétiques (ex: "doctère" → "docteur", "mal e dent" → "mal de dent", "bonjoure" → "bonjour", "je mapelle" → "je m'appelle").
2. Ignorer la ponctuation, la casse et les espaces superflus.
3. Reconnaître l'INTENTION de l'apprenant même si la forme est imparfaite.
4. Valider les mots-clés phonétiquement proches (distance de Levenshtein ≤ 3 pour les mots courts).
5. Ne PAS pénaliser les erreurs clairement dues au STT (mots coupés, répétitions, hésitations "euh").
6. Évaluer la COMMUNICATION réussie, pas la perfection linguistique.`
      : "";

    const keywordsBlock = metadata?.mots_cles_attendus?.length
      ? `\nMots-clés attendus (valider même avec approximation phonétique) : ${metadata.mots_cles_attendus.join(", ")}`
      : "";

    const systemPrompt = `Tu es un évaluateur de français langue étrangère niveau A0-A1, spécialisé TCF IRN.
Évalue cette production selon les critères suivants : ${JSON.stringify(criteres_evaluation)}.${keywordsBlock}${toleranceBlock}

Donne un score de 0 à 3 et une justification courte en français (max 2 phrases). Sois ENCOURAGEANT — valorise les réussites même partielles.
Réponds uniquement en JSON : {"score": number, "justification": string}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: reponse_apprenant },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw new Error(`AI error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return new Response(
      JSON.stringify({
        score: Math.min(3, Math.max(0, Math.round(parsed.score ?? 0))),
        justification: parsed.justification ?? "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("evaluate-test-response error:", e);
    return new Response(
      JSON.stringify({
        score: 0,
        justification: "Erreur lors de l'évaluation.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
