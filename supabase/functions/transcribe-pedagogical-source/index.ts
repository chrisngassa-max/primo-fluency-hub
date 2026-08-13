import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isSha256ContentHash } from "../_shared/source-integrity.ts";
import { assessTimestampCoverage, readMp3Duration } from "../_shared/transcription/audio-duration.ts";
import { validateCanonicalTranscription } from "../_shared/transcription/canonical.ts";
import {
  AUDIO_TIMESTAMP_SOURCE,
  GOOGLE_STT_DEFAULT_MODEL,
  GOOGLE_STT_PROVIDER,
  buildDedicatedSttProviderParameters,
  isAllowedAudioTimestampProvider,
  toCanonicalTranscription,
  transcribeAudioWithDedicatedStt,
} from "../_shared/transcription/google-stt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_AUDIO_BYTES = 18 * 1024 * 1024;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(401, { error: "AUTH_REQUIRED" });
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let transcriptionId: string | null = null;

  try {
    const { data: { user }, error: userError } = await caller.auth.getUser();
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
      .select("id, created_by, source_kind, mime_type, storage_bucket, storage_path, content_hash")
      .eq("id", sourceId).maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) return json(404, { error: "SOURCE_NOT_FOUND" });
    if (!isAdmin && source.created_by !== user.id) return json(403, { error: "SOURCE_FORBIDDEN" });
    if (source.source_kind !== "audio" || !String(source.mime_type ?? "").startsWith("audio/")) {
      return json(422, { error: "SOURCE_NOT_AUDIO" });
    }
    if (!isSha256ContentHash(source.content_hash)) return json(422, { error: "SOURCE_HASH_REQUIRED" });

    const { data: current, error: currentError } = await admin
      .from("pedagogical_source_transcriptions")
      .select("id, status, attempt_number")
      .eq("source_id", source.id).eq("is_current", true).maybeSingle();
    if (currentError) throw currentError;
    if (current?.status === "processing") return json(409, { error: "TRANSCRIPTION_ALREADY_RUNNING" });
    if (!force && current && (current.status === "ready" || current.status === "reviewed")) {
      return json(200, { ok: true, cached: true, transcription_id: current.id, status: current.status });
    }
    if (force && current) {
      const { error } = await admin.from("pedagogical_source_transcriptions")
        .update({ is_current: false }).eq("id", current.id).eq("is_current", true);
      if (error) throw error;
    }

    const { data: created, error: createError } = await admin
      .from("pedagogical_source_transcriptions")
      .insert({
        source_id: source.id,
        attempt_number: (current?.attempt_number ?? 0) + 1,
        is_current: true,
        provider: GOOGLE_STT_PROVIDER,
        model_id: GOOGLE_STT_DEFAULT_MODEL,
        status: "processing",
        provider_parameters: {
          path: "dedicated_stt",
          content_hash: source.content_hash,
          timestamp_source: AUDIO_TIMESTAMP_SOURCE,
        },
      }).select("id").single();
    if (createError) {
      if (String(createError.code) === "23505") return json(409, { error: "TRANSCRIPTION_ALREADY_RUNNING" });
      throw createError;
    }
    transcriptionId = created.id;

    const { data: file, error: downloadError } = await admin.storage.from(source.storage_bucket).download(source.storage_path);
    if (downloadError || !file) throw new Error("SOURCE_FILE_NOT_FOUND");
    if (file.size === 0) throw new Error("SOURCE_FILE_EMPTY");
    if (file.size > MAX_AUDIO_BYTES) throw new Error("SOURCE_FILE_TOO_LARGE");
    const audioBytes = new Uint8Array(await file.arrayBuffer());
    const duration = String(source.mime_type ?? "").includes("mpeg") ? readMp3Duration(audioBytes) : null;
    const stt = await transcribeAudioWithDedicatedStt({
      bytes: audioBytes,
      mimeType: source.mime_type || file.type || "audio/mpeg",
      language: "fr-FR",
    });
    if (!isAllowedAudioTimestampProvider(stt.provider) || stt.metadata.timestamp_source !== AUDIO_TIMESTAMP_SOURCE) {
      throw new Error("STT_TIMESTAMP_PROVIDER_FORBIDDEN");
    }
    const transcription = toCanonicalTranscription(stt);
    const validationErrors = validateCanonicalTranscription(transcription);
    if (validationErrors.length > 0) throw new Error(`TRANSCRIPTION_INVALID:${validationErrors.join(",")}`);
    const timestampAssessment = assessTimestampCoverage(transcription.segments, duration?.durationMs ?? null);
    const firstStartMs = transcription.segments[0]?.start_ms ?? null;
    const lastEndMs = transcription.segments.at(-1)?.end_ms ?? timestampAssessment.transcriptEndMs;

    const { error: segmentError } = await admin.from("pedagogical_source_transcription_segments").insert(
      transcription.segments.map(({ text, ...segment }) => ({
        transcription_id: transcriptionId,
        ...segment,
        raw_text: text,
      })),
    );
    if (segmentError) throw segmentError;
    const { error: completeError } = await admin.from("pedagogical_source_transcriptions").update({
      status: "ready",
      provider: stt.provider,
      model_id: stt.modelId,
      raw_text: transcription.full_text,
      language_detected: transcription.language,
      average_confidence: stt.confidence,
      error_details: null,
      provider_parameters: buildDedicatedSttProviderParameters({
        contentHash: source.content_hash,
        modelId: stt.modelId,
        language: stt.language,
        chunkCount: Number(stt.metadata.chunk_count ?? 0),
        audioDurationMs: timestampAssessment.audioDurationMs,
        mp3FrameCount: duration?.frameCount ?? null,
        mpegVersion: duration?.mpegVersion ?? null,
        sampleRateHz: duration?.sampleRateHz ?? null,
        channels: duration?.channels ?? null,
        firstStartMs,
        lastEndMs,
        timestampStatus: timestampAssessment.status,
        transcriptEndMs: timestampAssessment.transcriptEndMs,
        timestampDriftMs: timestampAssessment.driftMs,
        overshootMs: timestampAssessment.overshootMs,
        trailingGapMs: timestampAssessment.trailingGapMs,
        coverageRatio: timestampAssessment.coverageRatio,
        chunkDiagnostics: Array.isArray(stt.metadata.chunk_diagnostics)
          ? stt.metadata.chunk_diagnostics as never
          : [],
      }),
    }).eq("id", transcriptionId);
    if (completeError) throw completeError;
    return json(200, {
      ok: true,
      cached: false,
      transcription_id: transcriptionId,
      status: "ready",
      provider: stt.provider,
      model_id: stt.modelId,
      segments_count: transcription.segments.length,
      timestamp_assessment: timestampAssessment,
      transformations_applied: [],
    });
  } catch (error) {
    console.error("transcribe-pedagogical-source error", error);
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "TRANSCRIPTION_FAILED";
    if (transcriptionId) {
      await admin.from("pedagogical_source_transcriptions").update({
        status: "error",
        error_details: { code: message.split(":")[0], message },
      }).eq("id", transcriptionId);
    }
    const status = message.startsWith("SOURCE_FILE_NOT_FOUND") ? 404
      : message.includes("TOO_LARGE") ? 413
      : message.startsWith("TRANSCRIPTION_INVALID")
        || message.startsWith("STT_TIMESTAMPS")
        || message.startsWith("STT_TIMESTAMP")
        || message.startsWith("STT_SEGMENT")
        || message.startsWith("STT_CHUNK")
        || message.startsWith("STT_UNSUPPORTED")
        ? 422
        : 502;
    return json(status, { error: message.split(":")[0] });
  }
});
