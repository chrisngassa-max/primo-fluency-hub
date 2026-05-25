// Edge function: import-pedagogical-data
// POST { type: "activities" | "documents" | "errors", data: [...] }
// Header: Authorization: Bearer <IMPORT_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const IMPORT_SECRET = Deno.env.get("IMPORT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!IMPORT_SECRET || !SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Server misconfigured: missing secrets" }, 500);
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${IMPORT_SECRET}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { type?: string; data?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { type, data } = body;
  if (!type || !Array.isArray(data)) {
    return json({ error: "Body must be { type, data: [] }" }, 400);
  }
  if (data.length === 0) return json({ imported: 0 });

  const tableMap: Record<string, { table: string; conflict: string }> = {
    activities: { table: "pedagogical_activities", conflict: "import_key" },
    documents: { table: "pedagogical_documents", conflict: "document_id" },
    errors: { table: "pedagogical_extraction_errors", conflict: "file_name" },
  };
  const target = tableMap[type];
  if (!target) return json({ error: `Unknown type: ${type}` }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Upsert by chunks to stay under request limits
  const CHUNK = 500;
  let imported = 0;
  try {
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from(target.table)
        .upsert(chunk as never, { onConflict: target.conflict, count: "exact" });
      if (error) {
        return json(
          { error: `Upsert failed at chunk ${i}: ${error.message}`, imported },
          500,
        );
      }
      imported += count ?? chunk.length;
    }
    return json({ imported, table: target.table });
  } catch (e) {
    return json({ error: (e as Error).message, imported }, 500);
  }
});
