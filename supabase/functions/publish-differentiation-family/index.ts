import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { familyVariantToExerciceRow } from "../_shared/family-to-exercice-adapter.ts";
import type { DifferentiationFamilySliceV1 } from "../_shared/differentiation/types.ts";
import {
  getPedagogicalSourceReadinessError,
  isPedagogicalSourceReadyForDifferentiation,
} from "../_shared/pedagogical-source-guards.ts";
import { pickDeterministicCoA2MasteryPoint } from "../_shared/differentiation/publish-mastery-point.ts";

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
    const { data: isAdmin } = await admin.rpc("has_role", { uid: user.id, target_role: "admin" });
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
    const { data: source } = await admin
      .from("pedagogical_sources")
      .select("content_hash, status, review_status, source_kind, mime_type, storage_bucket, storage_path")
      .eq("id", family.source_id)
      .maybeSingle();
    if (!source || source.content_hash !== family.source_content_hash) return json(422, { error: "SOURCE_HASH_DIVERGED" });
    if (!isPedagogicalSourceReadyForDifferentiation(source)) {
      const readinessError = getPedagogicalSourceReadinessError(source);
      return json(422, { error: readinessError === "SOURCE_NOT_ANALYZED" ? "SOURCE_ANALYSIS_STALE" : readinessError });
    }
    if (source.source_kind === "audio" && (!source.storage_bucket || !source.storage_path)) {
      return json(422, { error: "SOURCE_MP3_MISSING" });
    }
    const { data: transcription, error: transcriptionError } = await admin
      .from("pedagogical_source_transcriptions")
      .select("reviewed_text")
      .eq("source_id", family.source_id)
      .eq("is_current", true)
      .eq("status", "reviewed")
      .maybeSingle();
    if (transcriptionError) throw transcriptionError;
    const audioScript = transcription?.reviewed_text?.trim();
    if (!audioScript) return json(422, { error: "REVIEWED_TRANSCRIPTION_REQUIRED" });
    const { data: masteryPoints, error: masteryPointsError } = await admin
      .from("points_a_maitriser")
      .select("id, ordre, niveau_min, niveau_max, sous_sections!inner(ordre, epreuves!inner(competence, ordre))")
      .eq("sous_sections.epreuves.competence", "CO");
    if (masteryPointsError) throw masteryPointsError;
    const defaultPoint = pickDeterministicCoA2MasteryPoint(masteryPoints ?? []);
    if (!defaultPoint) throw new Error("DEFAULT_MASTERY_POINT_REQUIRED");
    // Référence stable à la source audio originale (uniquement pour les sources
    // audio). Ne contient jamais de bucket/chemin Storage : le résolveur relit
    // pedagogical_sources côté serveur pour signer l'URL au moment de la lecture.
    const audioRef = source.source_kind === "audio"
      ? { source_id: family.source_id, source_content_hash: family.source_content_hash, mime_type: source.mime_type ?? null }
      : null;
    const { data: exercise, error: insertError } = await admin.from("exercices")
      .insert(familyVariantToExerciceRow(
        family.payload as DifferentiationFamilySliceV1,
        user.id,
        audioScript,
        defaultPoint.id,
        audioRef,
      )).select("id").single();
    if (insertError) throw insertError;
    const { data: publishedFamily, error: updateError } = await admin.from("differentiation_families").update({
      review_status: "published", published_exercise_id: exercise.id,
    }).eq("id", family.id).is("published_exercise_id", null).select("published_exercise_id").maybeSingle();
    if (updateError) throw updateError;
    if (!publishedFamily) {
      await admin.from("exercices").delete().eq("id", exercise.id);
      const { data: alreadyPublished } = await admin.from("differentiation_families")
        .select("published_exercise_id").eq("id", family.id).maybeSingle();
      return json(409, { error: "FAMILY_ALREADY_PUBLISHED", exercise_id: alreadyPublished?.published_exercise_id });
    }
    return json(200, { ok: true, exercise_id: exercise.id });
  } catch (error) {
    console.error("publish-differentiation-family error", error);
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "PUBLISH_FAMILY_FAILED";
    return json(500, { error: message });
  }
});
