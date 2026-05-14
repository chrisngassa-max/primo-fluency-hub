import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { testId, targetSite } = await req.json();
    if (!testId) throw new Error("Missing testId");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the test metadata
    const { data: test, error: testError } = await supabase
      .from("placement_tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (testError || !test) throw new Error("Test not found or error fetching test: " + testError?.message);

    if (test.status !== "published") {
      throw new Error("Cannot export a test that is not published.");
    }

    // Fetch test items
    const { data: items, error: itemsError } = await supabase
      .from("placement_test_items")
      .select("*")
      .eq("test_id", testId)
      .order("order_index", { ascending: true });

    if (itemsError) throw itemsError;

    // Build the public payload (NO correct_answer!)
    const publicItems = items.map((item) => {
      const publicItem: any = {
        id: item.id,
        skill: item.skill,
        level_cecrl: item.level_cecrl,
        difficulty: item.difficulty,
        context: item.context,
        support_type: item.support_type,
        support: item.support,
        question: item.question,
        tags: item.tags,
        score: item.score,
        order_index: item.order_index,
        audio_script: item.audio_script, // In MVP, we display the text, but ideally this is generated into audio
      };
      
      // Only include options if it's a QCM (has options)
      if (item.options) {
        publicItem.item_type = "qcm";
        publicItem.options = item.options;
      } else {
        publicItem.item_type = item.skill === "EE" ? "production_ecrite" : "production_orale";
      }

      return publicItem;
    });

    const publicPayload = {
      schema_version: "placement_test_v1",
      test: {
        id: test.id,
        title: test.title,
        target_exam: test.target_exam,
        target_public: test.target_public,
        estimated_duration_minutes: 45,
        language: "fr",
        disclaimer: "Ce test est un test pédagogique de positionnement non officiel. Il ne remplace pas le TCF."
      },
      configuration: {
        levels_covered: test.niveaux_couverts,
        skills: test.competences,
        progression: "facile_vers_difficile",
        contexts: test.contexte ? [test.contexte] : []
      },
      items: publicItems,
      scoring_rules: {
        // Provide the difficulty weights in the public schema just in case the client wants to show max score
        difficulty_weights: { "A0_A1": 1, "A1_A2": 2, "A2_B1": 3, "B1_B2": 4 },
        level_thresholds: [
          { level: "A0_pre_A1", min_percent: 0, max_percent: 25 },
          { level: "A1_fragile", min_percent: 26, max_percent: 45 },
          { level: "A1_acquis", min_percent: 46, max_percent: 60 },
          { level: "A2_fragile", min_percent: 61, max_percent: 72 },
          { level: "A2_acquis", min_percent: 73, max_percent: 82 },
          { level: "B1_fragile", min_percent: 83, max_percent: 90 },
          { level: "B1_acquis", min_percent: 91, max_percent: 100 }
        ]
      }
    };

    // Build the private answer key
    const privateAnswerKey = {
      test_id: test.id,
      items: items.map(item => ({
        id: item.id,
        correct_answer: item.correct_answer,
        explanation: item.explanation,
        score: item.score
      }))
    };

    // Store the export in placement_test_exports
    const { data: exportRecord, error: exportError } = await supabase
      .from("placement_test_exports")
      .insert({
        test_id: test.id,
        schema_version: "placement_test_v1",
        export_format: "json", // default to json for MVP
        target_site: targetSite || "manual_download",
        public_payload: publicPayload,
        private_answer_key: privateAnswerKey,
        export_status: "exported",
        exported_at: new Date().toISOString()
      })
      .select()
      .single();

    if (exportError) throw exportError;

    return new Response(JSON.stringify({ 
      success: true, 
      exportId: exportRecord.id, 
      publicPayload 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in export-placement-test:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
