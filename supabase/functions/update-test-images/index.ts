import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all test_questions with text-description supports that need images
  const { data: questions, error } = await supabase
    .from("test_questions")
    .select("id, competence, support, consigne")
    .not("support", "is", null)
    .order("competence")
    .order("palier")
    .order("numero_dans_palier");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];

  for (const q of questions || []) {
    // Skip if already a URL
    if (q.support.startsWith("http")) {
      results.push({ id: q.id, status: "skipped", reason: "already_url" });
      continue;
    }

    // Skip CE short signs - they render fine as styled text
    if (q.competence === "CE" && q.support.length <= 30 && !q.support.toLowerCase().includes("photo")) {
      results.push({ id: q.id, status: "skipped", reason: "ce_sign" });
      continue;
    }

    // Skip CE longer text docs - they're meant to be read
    if (q.competence === "CE" && q.support.length > 30) {
      results.push({ id: q.id, status: "skipped", reason: "ce_document" });
      continue;
    }

    // This is a text description of an image - search Pexels
    const searchQuery = q.support
      .replace(/^(Photo|Image|Une photo|Un dessin|Un|Une)\s+(d[eu']?\s*)?/i, "")
      .replace(/\.$/, "")
      .trim();

    try {
      const pexelsRes = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`,
        { headers: { Authorization: PEXELS_API_KEY! } }
      );

      if (!pexelsRes.ok) {
        results.push({ id: q.id, status: "error", reason: `pexels_${pexelsRes.status}` });
        continue;
      }

      const pexelsData = await pexelsRes.json();
      const photo = pexelsData.photos?.[0];

      if (!photo) {
        results.push({ id: q.id, status: "no_result", query: searchQuery });
        continue;
      }

      const imageUrl = photo.src.medium; // ~350x250

      // Update the support field
      const { error: updateError } = await supabase
        .from("test_questions")
        .update({ support: imageUrl })
        .eq("id", q.id);

      if (updateError) {
        results.push({ id: q.id, status: "update_error", reason: updateError.message });
      } else {
        results.push({ id: q.id, status: "updated", query: searchQuery, url: imageUrl });
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    } catch (err: any) {
      results.push({ id: q.id, status: "error", reason: err.message });
    }
  }

  return new Response(JSON.stringify({ total: questions?.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
