import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reviewExercise } from "../_shared/review-exercise.ts";
import { buildPedagogicalDirectives } from "../_shared/pedagogical-directives.ts";
import { ensurePseudonymSecretOrLog, getUserIdFromAuth, logAICall } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const triggeredBy = await getUserIdFromAuth(req);
    const secretBlock = await ensurePseudonymSecretOrLog("review-exercise", corsHeaders, null);
    if (secretBlock) return secretBlock;

    await logAICall({
      function_name: "review-exercise",
      triggered_by_user_id: triggeredBy,
      status: "ok",
      data_categories: ["exercise"],
      pseudonymization_level: "none",
    });

    const body = await req.json();
    const exerciseId = body.exercise_id ?? body.exercice_id ?? null;
    const inlineExercise = body.exercise ?? body.exercice ?? null;
    const useAI = body.use_ai !== false;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let exercise = inlineExercise;
    if (exerciseId) {
      const { data, error } = await supabase
        .from("exercices")
        .select("*")
        .eq("id", exerciseId)
        .single();

      if (error || !data) {
        return new Response(JSON.stringify({ error: "exercise_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      exercise = data;
    }

    if (!exercise) {
      return new Response(JSON.stringify({ error: "missing_exercise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const directives = body.pedagogicalDirectives
      ?? body.directives_pedagogiques
      ?? buildPedagogicalDirectives({
        targetCompetence: exercise.competence ?? body.competence ?? null,
      });

    const review = await reviewExercise({
      exercise,
      pedagogicalDirectives: directives,
      niveau: body.niveau ?? exercise.niveau_vise ?? null,
      competence: body.competence ?? exercise.competence ?? null,
      contexte: body.contexte ?? "review-exercise",
      useAI,
    });

    return new Response(JSON.stringify({ review, exercise_id: exerciseId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("review-exercise error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
