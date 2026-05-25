import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stablePart(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function mapActivity(a: any) {
  return {
    import_key: [stablePart(a.activity_id), stablePart(a.document_id), stablePart(a.source_pdf), stablePart(a.title)].join("::"),
    activity_id: a.activity_id,
    title: a.title,
    category: a.category,
    audience: a.audience ?? null,
    level_min: a.level_min,
    level_max: a.level_max,
    objective: a.objective ?? "",
    duration_min: a.duration_min ?? null,
    duration_max: a.duration_max ?? null,
    materials_needed: toArray(a.materials_needed),
    instructions: a.instructions ?? "",
    tags: toArray(a.tags),
    document_id: a.document_id ?? null,
    source_pdf: a.source_pdf ?? null,
    source_kind: "pdf_extraction",
    raw: a,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const expected = Deno.env.get("IMPORT_SECRET");
  if (!expected || auth !== `Bearer ${expected}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { type, data } = body ?? {};
  if (!Array.isArray(data)) return json({ error: "data must be an array" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let table: string; let conflict: string; let rows: any[];
  switch (type) {
    case "activities":
      table = "pedagogical_activities"; conflict = "import_key";
      rows = data.map(mapActivity);
      break;
    case "documents":
      table = "pedagogical_documents"; conflict = "document_id"; rows = data;
      break;
    case "errors":
      table = "pedagogical_extraction_errors"; conflict = "file_name"; rows = data;
      break;
    default:
      return json({ error: "type must be 'activities' | 'documents' | 'errors'" }, 400);
  }

  const batchSize = 100;
  let imported = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
    if (error) {
      console.error("upsert error", error);
      return json({ error: error.message, imported }, 500);
    }
    imported += batch.length;
  }

  return json({ imported });
});
