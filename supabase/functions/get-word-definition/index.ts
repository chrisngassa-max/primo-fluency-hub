import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AIError, callAI } from "../_shared/ai-client.ts";
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

const LANGUAGE_LABELS: Record<string, string> = {
  fr: "francais tres simple",
  en: "anglais",
  ar: "arabe",
  prs: "dari d'Afghanistan",
  ti: "tigrinya",
  bm: "bambara",
  ta: "tamoul",
  es: "espagnol",
  pt: "portugais",
  tr: "turc",
  uk: "ukrainien",
  ru: "russe",
};

function normalizeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_LABELS[normalized] ? normalized : normalized || "fr";
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
    const translationLanguage = normalizeLanguage(
      String(body.translation_language ?? body.translationLanguage ?? "fr"),
    );
    const translationLanguageLabel = LANGUAGE_LABELS[translationLanguage] ?? translationLanguage;

    if (!word || !studentId) {
      return new Response(JSON.stringify({ error: "missing_word_or_student", code: "missing_word_or_student" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (triggeredBy && studentId !== triggeredBy) {
      return new Response(JSON.stringify({ error: "student_mismatch", code: "student_mismatch" }), {
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
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Tu es un assistant lexical FLE A1/A2 pour adultes migrants.
Retourne uniquement du JSON strict.
La definition simple doit etre une vraie definition de dictionnaire, mais en francais facile (niveau A1/A2).
Donne le sens precis du mot (sa nature et ce qu'il veut dire), en environ 10 a 20 mots.
Tu peux commencer par "C'est...", "Ca veut dire..." ou nommer la classe du mot, mais reste clair et concret.
Evite les mots difficiles, le jargon et les definitions circulaires.
Quand c'est utile, ajoute un synonyme tres simple dans la definition.
Remplis le champ example avec une phrase d'exemple tres courte et simple qui utilise le mot.
Utilise toujours le contexte de phrase fourni pour choisir le bon sens du mot.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            word,
            context_sentence: contextSentence || null,
            translation_language: translationLanguage,
            translation_language_label: translationLanguageLabel,
            output: {
              translation: "traduction courte dans la langue demandee; si fr, donner un synonyme tres simple. Pour arabe et tamoul, utiliser l'ecriture native.",
              simple_definition: "definition francaise claire et utile, niveau A1/A2, ~10 a 20 mots, donne le sens precis du mot",
              example: "phrase d'exemple tres simple (A1/A2) qui utilise le mot dans ce sens",
            },
          }),
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "define_word",
          description: "Retourne traduction, definition simple et exemple d'un mot FLE A1/A2",
          parameters: {
            type: "object",
            properties: {
              translation: { type: "string" },
              simple_definition: { type: "string" },
              example: { type: "string" },
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

    const translation = String(details.translation ?? "");
    const simpleDefinition = String(details.simple_definition ?? "");
    const example = details.example ? String(details.example) : null;

    // Persiste le résultat comme entrée de CACHE (is_saved=false). Le carnet de
    // l'élève ne contient que les mots ajoutés volontairement (is_saved=true).
    // Un échec d'écriture ne doit jamais bloquer la réponse à l'élève.
    try {
      await supabase.from("student_vocabulary").insert({
        student_id: studentId,
        word,
        normalized_word: normalizedWord,
        context_sentence: contextSentence || null,
        translation,
        translation_language: translationLanguage,
        simple_definition: simpleDefinition,
        is_saved: false,
      });
    } catch (cacheError) {
      console.error("get-word-definition cache write failed:", cacheError);
    }

    return new Response(JSON.stringify({
      word,
      translation,
      simple_definition: simpleDefinition,
      example,
      translation_language: translationLanguage,
      context_sentence: contextSentence || null,
      cache_hit: false,
      cache_level: "none",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-word-definition error:", error);
    const isAIError = error instanceof AIError;
    const status = isAIError ? (error.status >= 400 ? error.status : 502) : 500;
    const code = isAIError ? "ai_unavailable" : "internal_error";
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
