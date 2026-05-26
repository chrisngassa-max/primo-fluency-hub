// Bulk TTS generation for system interventions
// Iterates over interventions WHERE is_systeme = true AND audio_url IS NULL
// Generates MP3 via Google TTS, uploads to "interventions-audio" bucket, updates row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "interventions-audio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GOOGLE_TTS_API_KEY");
    if (!apiKey) {
      return json({ error: "GOOGLE_TTS_API_KEY not configured" }, 500);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await safeJson(req);
    const limit: number = Math.min(Number(body?.limit ?? 50), 200);
    const force: boolean = body?.force === true;
    const onlyId: string | undefined = body?.intervention_id;

    let query = supabase
      .from("interventions")
      .select("id, contenu_texte, voix, audio_url, niveau_cible, competence, type_erreur_id")
      .eq("is_systeme", true)
      .limit(limit);
    if (onlyId) query = query.eq("id", onlyId);
    else if (!force) query = query.is("audio_url", null);

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!rows || rows.length === 0) {
      return json({ ok: true, processed: 0, message: "Nothing to generate" });
    }

    let success = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const row of rows) {
      try {
        const voice = row.voix || "fr-FR-Standard-F";
        const ttsRes = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text: String(row.contenu_texte).substring(0, 5000) },
              voice: { languageCode: "fr-FR", name: voice, ssmlGender: "FEMALE" },
              audioConfig: { audioEncoding: "MP3", speakingRate: 0.9, pitch: 0 },
            }),
          },
        );
        if (!ttsRes.ok) {
          const t = await ttsRes.text();
          throw new Error(`TTS ${ttsRes.status}: ${t.slice(0, 200)}`);
        }
        const ttsData = await ttsRes.json();
        const b64 = ttsData.audioContent as string;
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

        const path = `systeme/${row.type_erreur_id || "x"}_${row.niveau_cible || "x"}_${row.competence || "x"}_${row.id}.mp3`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, bin, { contentType: "audio/mpeg", upsert: true });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const audio_url = pub.publicUrl;

        const { error: updErr } = await supabase
          .from("interventions")
          .update({ audio_url, audio_generated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updErr) throw new Error(`update: ${updErr.message}`);

        success++;
      } catch (e) {
        failed++;
        errors.push({ id: row.id, error: (e as Error).message });
        console.error("intervention", row.id, e);
      }
    }

    return json({ ok: true, processed: rows.length, success, failed, errors });
  } catch (err) {
    console.error("generate-interventions-audio", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}
