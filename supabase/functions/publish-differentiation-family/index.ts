import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { familyVariantToExerciceRow } from "../_shared/family-to-exercice-adapter.ts";
import type { DifferentiationFamilySliceV1 } from "../_shared/differentiation/types.ts";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(401, { error: "AUTH_REQUIRED" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json(401, { error: "AUTH_INVALID" });
    const body = await request.json().catch(() => ({}));
    if (typeof body.familyId !== "string") return json(400, { error: "FAMILY_ID_REQUIRED" });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: family, error } = await admin.from("differentiation_families")
      .select("id, source_id, source_content_hash, created_by, generation_status, validation_status, review_status, published_exercise_id, payload")
      .eq("id", body.familyId).maybeSingle();
    if (error) throw error;
    if (!family) return json(404, { error: "FAMILY_NOT_FOUND" });
    if (!isAdmin && family.created_by !== user.id) return json(403, { error: "FAMILY_FORBIDDEN" });
    if (family.published_exercise_id) return json(409, { error: "FAMILY_ALREADY_PUBLISHED", exercise_id: family.published_exercise_id });
    if (family.generation_status !== "generated" || !["passed", "passed_with_warnings"].includes(family.validation_status) || family.review_status !== "validated") {
      return json(422, { error: "FAMILY_NOT_APPROVED_FOR_PUBLICATION" });
    }
    const { data: source } = await admin.from("pedagogical_sources").select("content_hash").eq("id", family.source_id).maybeSingle();
    if (!source || source.content_hash !== family.source_content_hash) return json(422, { error: "SOURCE_HASH_DIVERGED" });
    const { data: exercise, error: insertError } = await admin.from("exercices")
      .insert(familyVariantToExerciceRow(family.payload as DifferentiationFamilySliceV1, user.id)).select("id").single();
    if (insertError) throw insertError;
    const { error: updateError } = await admin.from("differentiation_families").update({
      review_status: "published", published_exercise_id: exercise.id,
    }).eq("id", family.id).is("published_exercise_id", null);
    if (updateError) throw updateError;
    return json(200, { ok: true, exercise_id: exercise.id });
  } catch (error) {
    console.error("publish-differentiation-family error", error);
    return json(500, { error: error instanceof Error ? error.message : "PUBLISH_FAMILY_FAILED" });
  }
});
