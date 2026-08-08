import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isSha256ContentHash, sha256ContentHash } from "../_shared/source-integrity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_HASH_BYTES = 100 * 1024 * 1024;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json(401, { error: "AUTH_REQUIRED" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json(401, { error: "AUTH_INVALID" });

    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const force = body.force === true;
    if (!sourceId) return json(400, { error: "SOURCE_ID_REQUIRED" });

    const [{ data: isTrainer }, { data: isAdmin }] = await Promise.all([
      admin.rpc("has_role", { uid: user.id, target_role: "formateur" }),
      admin.rpc("has_role", { uid: user.id, target_role: "admin" }),
    ]);
    if (!isTrainer && !isAdmin) return json(403, { error: "STAFF_ROLE_REQUIRED" });

    const { data: source, error: sourceError } = await admin
      .from("pedagogical_sources")
      .select("id, created_by, storage_bucket, storage_path, content_hash")
      .eq("id", sourceId)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return json(404, { error: "SOURCE_NOT_FOUND" });
    if (!isAdmin && source.created_by !== user.id) return json(403, { error: "SOURCE_FORBIDDEN" });

    if (!force && isSha256ContentHash(source.content_hash)) {
      return json(200, { ok: true, source_id: source.id, content_hash: source.content_hash, cached: true });
    }

    const { data: file, error: downloadError } = await admin.storage
      .from(source.storage_bucket)
      .download(source.storage_path);
    if (downloadError || !file) return json(404, { error: "SOURCE_FILE_NOT_FOUND" });
    if (file.size === 0) return json(422, { error: "SOURCE_FILE_EMPTY" });
    if (file.size > MAX_HASH_BYTES) return json(413, { error: "SOURCE_FILE_TOO_LARGE", max_bytes: MAX_HASH_BYTES });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentHash = await sha256ContentHash(bytes);
    const { error: updateError } = await admin
      .from("pedagogical_sources")
      .update({ content_hash: contentHash })
      .eq("id", source.id);
    if (updateError) throw updateError;

    return json(200, {
      ok: true,
      source_id: source.id,
      content_hash: contentHash,
      file_size: bytes.byteLength,
      cached: false,
    });
  } catch (error) {
    console.error("hash-pedagogical-source error", error);
    return json(500, { error: "HASH_SOURCE_FAILED" });
  }
});
