import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/ai-client.ts";
import { ensurePseudonymSecretOrLog, getUserIdFromAuth, logAICall } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANGUAGES: Record<string, string> = {
  ar: "arabe moderne standard",
  prs: "dari d'Afghanistan",
  ti: "tigrinya",
  bm: "bambara",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getUserIdFromAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretBlock = await ensurePseudonymSecretOrLog("translate-instruction", corsHeaders, null);
    if (secretBlock) return secretBlock;

    const body = await req.json();
    const text = String(body.text ?? "").trim();
    const language = String(body.language ?? "").trim();
    if (!text || !LANGUAGES[language] || text.length > 2000) {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAICall({
      function_name: "translate-instruction",
      triggered_by_user_id: userId,
      status: "ok",
      data_categories: ["exercise"],
      pseudonymization_level: "none",
    });

    const data = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Traduis une consigne FLE en ${LANGUAGES[language]}. Conserve le sens pédagogique, utilise des phrases simples et retourne uniquement la traduction, sans commentaire.`,
        },
        { role: "user", content: text },
      ],
    });

    const translation = String(data.choices?.[0]?.message?.content ?? "").trim();
    if (!translation) throw new Error("empty_translation");

    return new Response(JSON.stringify({ translation, language }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("translate-instruction error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "unknown_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
