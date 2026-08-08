import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calculateFactsHash, validateDifferentiationFamilySlice } from "../_shared/differentiation/index.ts";
import { getCoA2LevelContract } from "../_shared/differentiation/co-level-contract-loader.ts";
import type { DifferentiationFact, DifferentiationFamilySliceV1 } from "../_shared/differentiation/types.ts";
import { isSha256ContentHash } from "../_shared/source-integrity.ts";
import {
  getPedagogicalSourceAccessError,
  getPedagogicalSourceReadinessError,
} from "../_shared/pedagogical-source-guards.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const stripFences = (raw: string) => raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

async function geminiJson(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY_MISSING");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ generationConfig: { responseMimeType: "application/json" }, contents: [{ parts: [{ text: prompt }] }] }),
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
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let familyId: string | null = null;
  try {
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json(401, { error: "AUTH_INVALID" });
    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
    const force = body.force_regenerate === true;
    if (!sourceId) return json(400, { error: "SOURCE_ID_REQUIRED" });
    const [{ data: trainer }, { data: adminRole }] = await Promise.all([
      admin.rpc("has_role", { uid: user.id, target_role: "formateur" }),
      admin.rpc("has_role", { uid: user.id, target_role: "admin" }),
    ]);
    if (!trainer && !adminRole) return json(403, { error: "STAFF_ROLE_REQUIRED" });
    const { data: source, error: sourceError } = await admin.from("pedagogical_sources")
      .select("id, created_by, title, storage_bucket, storage_path, content_hash, source_kind, status, review_status")
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
    const { version: referentialVersion, contract } = getCoA2LevelContract();
    const { data: existing } = await admin.from("differentiation_families").select("id, generation_status, payload")
      .eq("source_id", source.id).eq("source_content_hash", source.content_hash).eq("referential_version", referentialVersion)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.generation_status === "generating") return json(409, { error: "FAMILY_GENERATION_ALREADY_RUNNING" });
    if (!force && existing?.generation_status === "generated") return json(200, { ok: true, cached: true, family_id: existing.id, payload: existing.payload });
    const { data: transcription } = await admin.from("pedagogical_source_transcriptions").select("id, reviewed_text, provider_parameters")
      .eq("source_id", source.id).eq("is_current", true).eq("status", "reviewed").maybeSingle();
    if (!transcription) return json(422, { error: "REVIEWED_TRANSCRIPTION_REQUIRED" });
    const { data: segments } = await admin.from("pedagogical_source_transcription_segments").select("id, segment_key, reviewed_text, raw_text")
      .eq("transcription_id", transcription.id).order("sequence_index");
    const { data: chunks } = await admin.from("pedagogical_source_chunks")
      .select("id, content_text, pedagogical_source_chunk_segments(segment_id)")
      .eq("source_id", source.id);
    if (!segments?.length || !chunks?.length) return json(422, { error: "ANALYZED_AUDIO_CHUNKS_REQUIRED" });
    const familyCode = `A2CO-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const created = await admin.from("differentiation_families").insert({
      source_id: source.id, family_id: familyCode, referential_version: referentialVersion, source_content_hash: source.content_hash,
      generation_status: "generating", created_by: user.id, generation_started_at: new Date().toISOString(),
    }).select("id").single();
    if (created.error) throw created.error;
    familyId = created.data.id;
    const sourceContext = chunks.map((chunk: any) => `CHUNK ${chunk.id} [segments ${(chunk.pedagogical_source_chunk_segments ?? []).map((link: any) => link.segment_id).join(",")}]: ${chunk.content_text}`).join("\n");
    const factResponse = await geminiJson(`Extrait seulement des faits explicites de cette transcription audio. JSON {"facts":[{"fact_id":"fact_01","subject":"...","predicate":"...","object":"...","semantic_qualifiers":{},"chunk_refs":["uuid"],"segment_refs":["uuid"],"quote":"...","required_for_task":true}]}. Chaque référence doit venir du contexte; pas d'inférence.\n${sourceContext}`);
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
        subject: String(fact.subject ?? ""), predicate: String(fact.predicate ?? ""), object: fact.object ?? "",
        semantic_qualifiers: fact.semantic_qualifiers ?? {},
        provenance: { source_id: source.id, transcription_id: transcription.id, segment_refs: fact.segment_refs, chunk_refs: fact.chunk_refs, quote: String(fact.quote ?? "") },
        required_for_task: fact.required_for_task !== false,
      }));
    if (facts.length === 0) throw new Error("NO_VERIFIABLE_FACTS");
    const itemsResponse = await geminiJson(`Crée ${contract.volume_items_min} à ${contract.volume_items_max} questions A2 de compréhension orale depuis ces faits. Applique exactement ce contrat: ${JSON.stringify(contract)}. JSON {"title":"...","instruction":"...","format":"qcm|vrai_faux|appariement|mixed","items":[{"id":"item_01","type":"qcm","instruction":"...","choices":[{"id":"a","text":"...","is_correct":true},{"id":"b","text":"...","is_correct":false,"distractor_category":"confusion_temporelle"}],"fact_refs":["fact_01"],"justification":"..."}]}. Aucune règle hors contrat.\n${JSON.stringify(facts)}`);
    const normalizedItems = Array.isArray(itemsResponse.items)
      ? itemsResponse.items.map((item: Record<string, unknown>, index: number) => ({
        ...item,
        id: `item_${String(index + 1).padStart(2, "0")}`,
      }))
      : [];
    const family = {
      schema_version: "slice-1.0", family_id: familyCode, version: 1, status: "draft", competence: "CO", subcompetence: "comprehension_orale",
      objective: "Comprendre des informations explicites dans un document audio.", core_task: "Répondre aux questions après écoute.", source_level: "A2",
      generated_levels: ["A2"], source_document: { source_document_id: source.id, uri: `${source.storage_bucket}/${source.storage_path}`, content_hash: source.content_hash, immutable: true, provenance: { type: "licensed", version: 1 } },
      facts: { required: facts, facts_hash: await calculateFactsHash(facts) }, level_contracts: { A2: contract },
      variants: { A2: { target_level: "A2", competence: "CO", transformation_id: "IDENTITY", support_mode: "segmented", support_ref: transcription.id, applied_transformations: [], exercise: { ...itemsResponse, items: normalizedItems, steps: ["Écouter", "Répondre"], expected_output: "Réponses aux questions" }, scaffolding: {}, success_criteria: ["Répondre correctement aux questions explicites du support audio."] } },
      generation: { model_id: "gemini-2.5-flash", prompt_version: "a2-audio-v1", generated_at: new Date().toISOString() },
      validation_report: { status: "not_run", blocking: [], warnings: [], requires_human_review: [] },
    } as DifferentiationFamilySliceV1;
    const chunkSegmentPairs = (chunks ?? []).flatMap((chunk: any) =>
      (chunk.pedagogical_source_chunk_segments ?? []).map((link: any) => `${chunk.id}:${link.segment_id}`)
    );
    const report = await validateDifferentiationFamilySlice(family, {
      sourceContentHash: source.content_hash,
      segmentIds: segments.map((segment) => segment.id),
      chunkIds: chunks.map((chunk) => chunk.id),
      chunkSegmentPairs,
      timestampsVerified: transcription.provider_parameters?.timestamp_status === "verified",
    });
    family.validation_report = report;
    const { error: finishError } = await admin.from("differentiation_families").update({
      generation_status: "generated", validation_status: report.status === "pass" ? "passed" : report.status === "warning" ? "passed_with_warnings" : "failed",
      payload: family, validation_report: report, generation_completed_at: new Date().toISOString(),
    }).eq("id", familyId);
    if (finishError) throw finishError;
    return json(200, { ok: true, family_id: familyId, validation_status: report.status, payload: family });
  } catch (error) {
    if (familyId) await admin.from("differentiation_families").update({ generation_status: "failed", generation_error: { message: error instanceof Error ? error.message : "Unknown error" } }).eq("id", familyId);
    console.error("generate-differentiation-family error", error);
    return json(502, { error: error instanceof Error ? error.message.split(":")[0] : "FAMILY_GENERATION_FAILED" });
  }
});
