import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  calculateFactsHash,
  evaluateSupportCompatibility,
  getCoLevelContract,
  isKnownCoLevel,
  validateDifferentiationFamilySlice,
  CURRENT_CO_REFERENTIAL_VERSION,
  SLICE_SCHEMA_VERSION,
} from "../_shared/differentiation/index.ts";
import type {
  DifferentiationFact,
  DifferentiationFamilySliceV1,
  SliceLevel,
  TransformationId,
} from "../_shared/differentiation/types.ts";
import {
  isPostgresUniqueViolation,
  resolveForceRegenerateGate,
  resolveIdempotentConflictResponse,
} from "../_shared/differentiation/generation-idempotence.ts";
import { getDifferentiationTransformationRule } from "../_shared/referential-loader.ts";
import { isSha256ContentHash } from "../_shared/source-integrity.ts";
import {
  getPedagogicalSourceAccessError,
  getPedagogicalSourceReadinessError,
} from "../_shared/pedagogical-source-guards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const stripFences = (raw: string) => raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
const SCHEMA_VERSION = SLICE_SCHEMA_VERSION;
const COMPETENCE = "CO";
/** Nouvelles familles multi-niveaux : toujours 1.1 (pas le legacy 1.0 A2-only). */
const REFERENTIAL_VERSION = CURRENT_CO_REFERENTIAL_VERSION;

function transformationIdFor(level: SliceLevel): TransformationId {
  if (level === "A2") return "IDENTITY";
  return `A2_TO_${level}` as TransformationId;
}

function familyCodeFor(level: SliceLevel): string {
  return `${level}CO-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

async function geminiJson(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      generationConfig: { responseMimeType: "application/json" },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error(`GEMINI_GENERATION_FAILED:${response.status}`);
  const raw = (await response.json()).candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("GEMINI_GENERATION_EMPTY");
  return JSON.parse(stripFences(raw));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(401, { error: "AUTH_REQUIRED" });
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let familyId: string | null = null;
  try {
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json(401, { error: "AUTH_INVALID" });
    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const force = body.force_regenerate === true;
    // Compat historique : absence de target_level => A2
    const rawLevel = typeof body.target_level === "string"
      ? body.target_level.trim().toUpperCase()
      : typeof body.targetLevel === "string"
        ? body.targetLevel.trim().toUpperCase()
        : "A2";
    if (!sourceId) return json(400, { error: "SOURCE_ID_REQUIRED" });
    if (!isKnownCoLevel(rawLevel)) {
      return json(400, { error: "TARGET_LEVEL_UNSUPPORTED", message: `Niveau non supporté: ${rawLevel}` });
    }
    const targetLevel = rawLevel as SliceLevel;

    const [{ data: trainer }, { data: adminRole }] = await Promise.all([
      admin.rpc("has_role", { uid: user.id, target_role: "formateur" }),
      admin.rpc("has_role", { uid: user.id, target_role: "admin" }),
    ]);
    if (!trainer && !adminRole) return json(403, { error: "STAFF_ROLE_REQUIRED" });

    const { data: source, error: sourceError } = await admin.from("pedagogical_sources")
      .select("id, created_by, title, storage_bucket, storage_path, content_hash, source_kind, status, review_status, mime_type")
      .eq("id", sourceId)
      .maybeSingle();
    if (sourceError) throw sourceError;
    const accessError = getPedagogicalSourceAccessError({
      isStaff: Boolean(trainer),
      isAdmin: Boolean(adminRole),
      userId: user.id,
      source,
    });
    if (accessError === "SOURCE_NOT_FOUND") return json(404, { error: accessError });
    if (accessError) return json(403, { error: accessError });
    if (source.source_kind !== "audio") return json(422, { error: "SOURCE_NOT_AUDIO" });
    const readinessError = getPedagogicalSourceReadinessError(source);
    if (readinessError) return json(422, { error: readinessError });
    if (!isSha256ContentHash(source.content_hash)) return json(422, { error: "SOURCE_HASH_REQUIRED" });
    if (!source.storage_bucket || !source.storage_path) return json(422, { error: "SOURCE_MP3_MISSING" });

    const { contract } = getCoLevelContract(targetLevel);
    const referentialVersion = REFERENTIAL_VERSION;
    const transformation = getDifferentiationTransformationRule("A2", targetLevel);
    if (!transformation) {
      return json(422, {
        error: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
        message: `Transformation A2→${targetLevel} non disponible.`,
      });
    }

    const { data: existing } = await admin.from("differentiation_families")
      .select("id, generation_status, payload, review_status, published_exercise_id")
      .eq("source_id", source.id)
      .eq("source_content_hash", source.content_hash)
      .eq("competence", COMPETENCE)
      .eq("target_level", targetLevel)
      .eq("schema_version", SCHEMA_VERSION)
      .eq("referential_version", referentialVersion)
      .neq("review_status", "archived")
      .in("generation_status", ["generating", "generated"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.generation_status === "generating") {
      return json(409, {
        error: "FAMILY_GENERATION_ALREADY_RUNNING",
        target_level: targetLevel,
        family_id: existing.id,
      });
    }
    if (!force && existing?.generation_status === "generated") {
      return json(200, {
        ok: true,
        cached: true,
        family_id: existing.id,
        target_level: targetLevel,
        referential_version: referentialVersion,
        payload: existing.payload,
      });
    }
    if (force) {
      const gate = resolveForceRegenerateGate(existing);
      if (!gate.allowed) {
        return json(409, {
          error: gate.error,
          family_id: existing?.id,
          target_level: targetLevel,
          message: "Une famille publiée ne peut pas être archivée ni écrasée silencieusement.",
        });
      }
      if (gate.canArchive && existing?.id) {
        await admin.from("differentiation_families")
          .update({ review_status: "archived" })
          .eq("id", existing.id)
          .is("published_exercise_id", null)
          .neq("review_status", "published");
      }
    }

    const { data: transcription } = await admin.from("pedagogical_source_transcriptions")
      .select("id, reviewed_text, provider_parameters, status")
      .eq("source_id", source.id)
      .eq("is_current", true)
      .eq("status", "reviewed")
      .maybeSingle();
    if (!transcription) return json(422, { error: "REVIEWED_TRANSCRIPTION_REQUIRED" });

    const { data: segments } = await admin.from("pedagogical_source_transcription_segments")
      .select("id, segment_key, reviewed_text, raw_text")
      .eq("transcription_id", transcription.id)
      .order("sequence_index");
    const { data: chunks } = await admin.from("pedagogical_source_chunks")
      .select("id, content_text, pedagogical_source_chunk_segments(segment_id)")
      .eq("source_id", source.id);
    if (!segments?.length || !chunks?.length) return json(422, { error: "ANALYZED_AUDIO_CHUNKS_REQUIRED" });

    const familyCode = familyCodeFor(targetLevel);
    const created = await admin.from("differentiation_families").insert({
      source_id: source.id,
      family_id: familyCode,
      competence: COMPETENCE,
      schema_version: SCHEMA_VERSION,
      referential_version: referentialVersion,
      source_content_hash: source.content_hash,
      target_level: targetLevel,
      generation_status: "generating",
      created_by: user.id,
      generation_started_at: new Date().toISOString(),
    }).select("id").single();
    if (created.error) {
      if (isPostgresUniqueViolation(created.error)) {
        const { data: conflictRow } = await admin.from("differentiation_families")
          .select("id, generation_status, payload, review_status, published_exercise_id")
          .eq("source_id", source.id)
          .eq("source_content_hash", source.content_hash)
          .eq("competence", COMPETENCE)
          .eq("target_level", targetLevel)
          .eq("schema_version", SCHEMA_VERSION)
          .eq("referential_version", referentialVersion)
          .neq("review_status", "archived")
          .in("generation_status", ["generating", "generated"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const resolved = resolveIdempotentConflictResponse(conflictRow);
        return json(resolved.status, {
          ...resolved.body,
          target_level: targetLevel,
          referential_version: referentialVersion,
        });
      }
      throw created.error;
    }
    familyId = created.data.id;

    const sourceContext = chunks.map((chunk: any) =>
      `CHUNK ${chunk.id} [segments ${(chunk.pedagogical_source_chunk_segments ?? []).map((link: any) => link.segment_id).join(",")}]: ${chunk.content_text}`
    ).join("\n");

    const factResponse = await geminiJson(
      `Extrait seulement des faits vérifiables de cette transcription audio. JSON {"facts":[{"fact_id":"fact_01","subject":"...","predicate":"...","object":"...","semantic_qualifiers":{"fact_kind":"explicit_info|main_idea|chronology|cause|consequence|opinion|intention|viewpoint|argument|implicature|hypothesis|fact","speaker":"...","viewpoint":"...","justified":false,"support_fact_ids":[],"epistemic":"fact|opinion|hypothesis"},"chunk_refs":["uuid"],"segment_refs":["uuid"],"quote":"...","required_for_task":true}]}. Chaque référence doit venir du contexte; pas d'invention; pas d'inférence non supportée.\n${sourceContext}`,
    );

    const validSegmentIds = new Set(segments.map((segment) => segment.id));
    const validChunkIds = new Set(chunks.map((chunk) => chunk.id));
    const facts: DifferentiationFact[] = (Array.isArray(factResponse.facts) ? factResponse.facts : [])
      .filter((fact: any) =>
        Array.isArray(fact.segment_refs) &&
        fact.segment_refs.length > 0 &&
        fact.segment_refs.every((id: unknown) => typeof id === "string" && validSegmentIds.has(id)) &&
        Array.isArray(fact.chunk_refs) &&
        fact.chunk_refs.length > 0 &&
        fact.chunk_refs.every((id: unknown) => typeof id === "string" && validChunkIds.has(id))
      )
      .map((fact: any, index: number) => ({
        fact_id: `fact_${String(index + 1).padStart(2, "0")}`,
        subject: String(fact.subject ?? ""),
        predicate: String(fact.predicate ?? ""),
        object: fact.object ?? "",
        semantic_qualifiers: fact.semantic_qualifiers ?? {},
        provenance: {
          source_id: source.id,
          transcription_id: transcription.id,
          segment_refs: fact.segment_refs,
          chunk_refs: fact.chunk_refs,
          quote: String(fact.quote ?? ""),
        },
        required_for_task: fact.required_for_task !== false,
      }));

    if (facts.length === 0) throw new Error("NO_VERIFIABLE_FACTS");

    const compatibility = evaluateSupportCompatibility(targetLevel, facts);
    if (!compatibility.supported) {
      await admin.from("differentiation_families").update({
        generation_status: "failed",
        generation_error: {
          code: compatibility.code,
          message: compatibility.message,
          support_compatibility: compatibility,
        },
        generation_completed_at: new Date().toISOString(),
      }).eq("id", familyId);
      return json(422, {
        error: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
        target_level: targetLevel,
        message: compatibility.message,
        support_compatibility: compatibility,
        family_id: familyId,
        referential_version: referentialVersion,
      });
    }

    const qcmMax = contract.qcm_max_choices ?? 4;
    const itemsResponse = await geminiJson(
      `Crée ${contract.volume_items_min} à ${contract.volume_items_max} questions ${targetLevel} de compréhension orale depuis ces faits.
Applique exactement ce contrat: ${JSON.stringify(contract)}.
Transformation: ${transformation.id} — ${transformation.rule.expected_evidence ?? transformation.rule.operation}.
Interdit: inventer des faits, inventer une difficulté B2, exiger une connaissance extérieure, modifier des timestamps.
JSON {"title":"...","instruction":"...","format":"qcm|vrai_faux|appariement|ordre_chronologique|mixed","items":[{"id":"item_01","type":"qcm","instruction":"...","choices":[{"id":"a","text":"...","is_correct":true},{"id":"b","text":"...","is_correct":false,"distractor_category":"..."}],"fact_refs":["fact_01"],"justification":"..."}]}.
Contraintes QCM: exactement une bonne réponse; A1 => max ${qcmMax} choix.
Aucune règle hors contrat.
${JSON.stringify(facts)}`,
    );

    const normalizedItems = Array.isArray(itemsResponse.items)
      ? itemsResponse.items.map((item: Record<string, unknown>, index: number) => ({
        ...item,
        id: `item_${String(index + 1).padStart(2, "0")}`,
      }))
      : [];

    const transformationId = transformationIdFor(targetLevel);
    const family = {
      schema_version: SCHEMA_VERSION,
      family_id: familyCode,
      version: 1,
      status: "draft",
      competence: COMPETENCE,
      subcompetence: "comprehension_orale",
      objective: (contract.objectives?.[0] ?? `Comprendre un document audio au niveau ${targetLevel}.`),
      core_task: "Répondre aux questions après écoute.",
      source_level: "A2",
      generated_levels: [targetLevel],
      source_document: {
        source_document_id: source.id,
        uri: `${source.storage_bucket}/${source.storage_path}`,
        content_hash: source.content_hash,
        immutable: true,
        provenance: { type: "licensed", version: 1 },
      },
      facts: { required: facts, facts_hash: await calculateFactsHash(facts) },
      level_contracts: { [targetLevel]: contract },
      variants: {
        [targetLevel]: {
          target_level: targetLevel,
          competence: COMPETENCE,
          transformation_id: transformationId,
          support_mode: targetLevel === "A1" ? "segmented" : "source",
          support_ref: transcription.id,
          applied_transformations: targetLevel === "A2"
            ? []
            : [{
              rule_id: transformationId,
              applied_to: "exercise",
              evidence: transformation.rule.expected_evidence ?? transformation.rule.operation,
            }],
          exercise: {
            ...itemsResponse,
            items: normalizedItems,
            steps: ["Écouter", "Répondre"],
            expected_output: "Réponses aux questions",
          },
          scaffolding: targetLevel === "A1" ? { lexique: true, segmentation: true } : {},
          success_criteria: [
            `Répondre correctement aux questions ${targetLevel} fondées sur le support audio.`,
          ],
        },
      },
      generation: {
        model_id: "gemini-2.5-flash",
        prompt_version: `co-audio-${targetLevel.toLowerCase()}-v1`,
        generated_at: new Date().toISOString(),
        target_level: targetLevel,
        referential_version: referentialVersion,
        support_compatibility: compatibility,
      },
      validation_report: { status: "not_run", blocking: [], warnings: [], requires_human_review: [] },
    } as DifferentiationFamilySliceV1;

    const chunkSegmentPairs = (chunks ?? []).flatMap((chunk: any) =>
      (chunk.pedagogical_source_chunk_segments ?? []).map((link: any) => `${chunk.id}:${link.segment_id}`)
    );
    const hashPresent = isSha256ContentHash(source.content_hash);
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: source.content_hash,
      segmentIds: segments.map((segment) => segment.id),
      chunkIds: chunks.map((chunk) => chunk.id),
      chunkSegmentPairs,
      timestampsVerified: transcription.provider_parameters?.timestamp_status === "verified",
      transcriptionReviewed: transcription.status === "reviewed",
      sourceAnalyzed: source.status === "analyzed",
      sourceReviewApproved: source.review_status === "utilisable" || source.review_status === "valide",
      sourceHashPresent: hashPresent,
      sourceHashCoherent: hashPresent && family.source_document.content_hash === source.content_hash,
      originalMp3Available: Boolean(source.storage_bucket && source.storage_path),
      factualProvenancePresent: facts.every((fact) =>
        Boolean(fact.provenance?.segment_refs?.length && fact.provenance?.chunk_refs?.length && fact.provenance?.quote)
      ),
    });
    family.validation_report = report;

    const { error: finishError } = await admin.from("differentiation_families").update({
      generation_status: "generated",
      validation_status: report.status === "pass"
        ? "passed"
        : report.status === "warning"
          ? "passed_with_warnings"
          : "failed",
      payload: family,
      validation_report: report,
      generation_completed_at: new Date().toISOString(),
    }).eq("id", familyId);
    if (finishError) throw finishError;

    return json(200, {
      ok: true,
      family_id: familyId,
      target_level: targetLevel,
      referential_version: referentialVersion,
      validation_status: report.status,
      support_compatibility: compatibility,
      payload: family,
    });
  } catch (error) {
    if (familyId) {
      await admin.from("differentiation_families").update({
        generation_status: "failed",
        generation_error: { message: error instanceof Error ? error.message : "Unknown error" },
      }).eq("id", familyId);
    }
    console.error("generate-differentiation-family error", error);
    return json(502, {
      error: error instanceof Error ? error.message.split(":")[0] : "FAMILY_GENERATION_FAILED",
    });
  }
});
