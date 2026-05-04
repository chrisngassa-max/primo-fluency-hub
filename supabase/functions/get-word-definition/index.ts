import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";
import { ensurePseudonymSecretOrLog, getUserIdFromAuth, logAICall } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeWord(word: string) {
  return word
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}'-]/gu, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("get-word-definition", corsHeaders, null);
    if (secretBlock) return secretBlock;

    const body = await req.json();
    const word = String(body.word ?? "").trim();
    const contextSentence = String(body.context_sentence ?? body.contextSentence ?? "").trim();
    const studentId = String(body.student_id ?? triggeredBy ?? "").trim();
    const translationLanguage = String(body.translation_language ?? body.translationLanguage ?? "fr").trim() || "fr";

    if (!word || !studentId) {
      return new Response(JSON.stringify({ error: "missing_word_or_student" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (triggeredBy && studentId !== triggeredBy) {
      return new Response(JSON.stringify({ error: "student_mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedWord = normalizeWord(word);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await logAICall({
      function_name: "get-word-definition",
      triggered_by_user_id: triggeredBy,
      status: "ok",
      data_categories: ["exercise", "profile"],
      pseudonymization_level: "none",
    });

    if (contextSentence) {
      const { data: cachedExact } = await supabase
        .from("student_vocabulary")
        .select("word, translation, simple_definition, translation_language, context_sentence")
        .eq("student_id", studentId)
        .eq("normalized_word", normalizedWord)
        .eq("translation_language", translationLanguage)
        .eq("context_sentence", contextSentence)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedExact?.simple_definition) {
        return new Response(JSON.stringify({ ...cachedExact, cache_hit: true, cache_level: "exact" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: cachedWord } = await supabase
      .from("student_vocabulary")
      .select("word, translation, simple_definition, translation_language, context_sentence")
      .eq("student_id", studentId)
      .eq("normalized_word", normalizedWord)
      .eq("translation_language", translationLanguage)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedWord?.simple_definition && !contextSentence) {
      return new Response(JSON.stringify({ ...cachedWord, cache_hit: true, cache_level: "word" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant lexical FLE A0/A1 pour adultes migrants.
Retourne uniquement du JSON strict.
La definition simple doit faire 5 a 10 mots, vocabulaire A1, structure "C'est un...", "C'est quand..." ou "C'est pour...".
Utilise le contexte de phrase pour choisir le bon sens du mot.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            word,
            context_sentence: contextSentence || null,
            translation_language: translationLanguage,
            output: {
              translation: "traduction courte dans la langue demandee; si fr, donner un synonyme tres simple",
              simple_definition: "definition francaise facile A0/A1",
            },
          }),
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "define_word",
          description: "Retourne traduction et definition simple d'un mot FLE A0/A1",
          parameters: {
            type: "object",
            properties: {
              translation: { type: "string" },
              simple_definition: { type: "string" },
            },
            required: ["translation", "simple_definition"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "define_word" } },
    });

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const details = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      word,
      translation: String(details.translation ?? ""),
      simple_definition: String(details.simple_definition ?? ""),
      translation_language: translationLanguage,
      context_sentence: contextSentence || null,
      cache_hit: false,
      cache_level: "none",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-word-definition error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
