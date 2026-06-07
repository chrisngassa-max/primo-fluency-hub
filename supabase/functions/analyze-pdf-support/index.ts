import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  ensurePseudonymSecretOrLog,
  getUserIdFromAuth,
  logAICall,
} from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("analyze-pdf-support", corsHeaders, null);
    if (secretBlock) return secretBlock;

    const { pdfBase64, fileName, targetLevel } = await req.json();
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return json(400, { error: "Le fichier PDF est requis." });
    }
    if (pdfBase64.length > 16_000_000) {
      return json(413, { error: "Le PDF est trop volumineux. Limite : 10 Mo." });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json(500, { error: "GEMINI_API_KEY non configuree." });

    await logAICall({
      function_name: "analyze-pdf-support",
      triggered_by_user_id: triggeredBy,
      status: "ok",
      data_categories: [],
      pseudonymization_level: "none",
    });

    const prompt = `Analyse ce support pedagogique PDF en francais.
Le but est de generer ensuite des exercices FLE fideles au document pour le niveau ${targetLevel || "A1"}.

Retourne uniquement un objet JSON avec :
- title : titre court du support
- theme : theme principal
- summary : synthese factuelle de 5000 caracteres maximum, utilisable comme source
- vocabulary : 10 a 30 mots ou expressions reellement presents dans le document
- grammar_points : points de grammaire ou structures observes
- learning_objectives : objectifs pedagogiques possibles
- detected_level : niveau CECRL estime

N'invente aucun contenu absent du PDF. Le nom du fichier est "${fileName || "support.pdf"}".`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini PDF analysis error:", response.status, await response.text());
      return json(response.status, { error: "Impossible d'analyser ce PDF." });
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();
    if (!text) return json(422, { error: "Aucun contenu exploitable detecte dans le PDF." });

    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    return json(200, { analysis: JSON.parse(cleaned) });
  } catch (error) {
    console.error("analyze-pdf-support error:", error);
    return json(500, { error: error instanceof Error ? error.message : "Erreur inconnue" });
  }
});
