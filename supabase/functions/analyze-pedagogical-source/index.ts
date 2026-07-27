import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import mammoth from "npm:mammoth@1.8.0";
import { AIError, callAI } from "../_shared/ai-client.ts";
import {
  ensurePseudonymSecretOrLog,
  getUserIdFromAuth,
  logAICall,
} from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime-version",
};

const TEXT_LIMIT = 18_000;
const MAX_FILE_BYTES = 18 * 1024 * 1024;
const CHUNK_TYPES = new Set([
  "resume",
  "extrait",
  "lecon",
  "consigne",
  "exercice",
  "corrige",
  "vocabulaire",
  "grammaire",
  "conjugaison",
  "phonetique",
  "civique",
  "image_description",
  "metadata",
]);

type SourceRow = {
  id: string;
  title: string;
  source_kind: string;
  source_subtype: string | null;
  pedagogical_domains: string[];
  level_min: string | null;
  level_max: string | null;
  themes: string[];
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  metadata: Record<string, unknown>;
};

type ReviewedTranscriptionSegment = {
  id: string;
  segment_key: string;
  sequence_index: number;
  start_ms: number;
  end_ms: number;
  raw_text: string;
  reviewed_text: string | null;
};

type AnalysisChunk = {
  chunk_type?: string;
  title?: string;
  content_text?: string;
  page_start?: number;
  page_end?: number;
  level?: string;
  domains?: string[];
  theme?: string;
  metadata?: Record<string, unknown>;
  segment_keys?: string[];
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return normalizeExtractedText(text);
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeExtractedText(result.value);
}

function normalizeExtractedText(value: unknown): string {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripJsonFences(value: string): string {
  return value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function buildSystemPrompt() {
  return [
    "Tu analyses une source pedagogique FLE/TCF IRN pour CapTCF.",
    "Tu dois extraire uniquement ce qui est present ou raisonnablement observable dans le document.",
    "N'invente pas de contenu pedagogique absent.",
    "Reponds uniquement en JSON valide, sans markdown.",
  ].join(" ");
}

function buildSourceContext(source: SourceRow): string {
  return [
    `Titre: ${source.title}`,
    `Type: ${source.source_kind}${source.source_subtype ? ` / ${source.source_subtype}` : ""}`,
    `Domaines declares: ${(source.pedagogical_domains || []).join(", ") || "non renseignes"}`,
    `Niveaux declares: ${source.level_min || "?"} - ${source.level_max || "?"}`,
    `Themes declares: ${(source.themes || []).join(", ") || "non renseignes"}`,
  ].join("\n");
}

function buildAnalysisPrompt(source: SourceRow, extractedText?: string, isAudio = false): string {
  const textBlock = extractedText
    ? `\n\nTEXTE EXTRAIT:\n${extractedText.slice(0, TEXT_LIMIT)}`
    : "\n\nAnalyse le fichier joint. S'il s'agit d'une image ou d'un PDF scanne, decris le contenu visible et les usages pedagogiques possibles.";

  return `${buildSourceContext(source)}

Retourne cet objet JSON:
{
  "summary": "synthese factuelle courte",
  "detected_level": "A0|A1|A2|B1|B2|C1|C2|null",
  "detected_domains": ["grammaire","vocabulaire","conjugaison","phonetique","CE","CO","EE","EO","civique","methodologie_tcf"],
  "chunks": [
    {
      "chunk_type": "resume|extrait|lecon|consigne|exercice|corrige|vocabulaire|grammaire|conjugaison|phonetique|civique|image_description|metadata",
      "title": "titre court",
      "content_text": "contenu exploitable, autonome et fidele a la source",
      "page_start": 1,
      "page_end": 1,
      "level": "A0|A1|A2|B1|B2|C1|C2|null",
      "domains": ["vocabulaire"],
      "theme": "theme court",
      "metadata": { "usage": "contexte_ia|support|exercice_source|image" },
      "segment_keys": ["seg-001"]
    }
  ]
}

Contraintes:
- Cree 4 a 18 chunks maximum.
- Le premier chunk doit etre un resume.
- Si tu detectes une lecon, separe vocabulaire, grammaire, conjugaison et phonetique quand c'est possible.
- Si tu detectes des exercices/corriges, cree des chunks distincts.
- Si c'est une image, cree au moins un chunk image_description.
- Pour une transcription audio, chaque chunk doit contenir uniquement des segment_keys fournis dans le texte.
- Aucun nom d'eleve ou donnee personnelle inventee.${textBlock}`;
}

function parseAnalysis(raw: string): { summary?: string; detected_level?: string | null; detected_domains?: string[]; chunks?: AnalysisChunk[] } {
  const parsed = JSON.parse(stripJsonFences(raw));
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    detected_level: typeof parsed.detected_level === "string" ? parsed.detected_level : null,
    detected_domains: Array.isArray(parsed.detected_domains) ? parsed.detected_domains : [],
    chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
  };
}

async function analyzeText(source: SourceRow, text: string, isAudio = false) {
  const response = await callAI({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildAnalysisPrompt(source, text, isAudio) },
    ],
  });
  const raw = response.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new AIError("L'IA n'a pas renvoye d'analyse exploitable.", 422);
  return parseAnalysis(raw);
}

async function analyzeFileWithGemini(source: SourceRow, bytes: Uint8Array, mimeType: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) {
    throw new AIError(
      "GEMINI_API_KEY est requis pour analyser les images ou les PDF scannes.",
      500,
    );
  }

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${buildSystemPrompt()}\n\n${buildAnalysisPrompt(source)}` },
            {
              inline_data: {
                mime_type: mimeType || "application/octet-stream",
                data: bytesToBase64(bytes),
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AIError(`Analyse multimodale impossible (${response.status}).`, response.status, detail);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new AIError("Gemini n'a pas renvoye d'analyse exploitable.", 422);
  return parseAnalysis(raw);
}

async function extractTextForMime(bytes: Uint8Array, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      return await extractPdfText(bytes);
    } catch (error) {
      console.warn("PDF text extraction failed:", error);
      return "";
    }
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType.includes("wordprocessingml")
  ) {
    return await extractDocxText(bytes);
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return normalizeExtractedText(new TextDecoder("utf-8").decode(bytes));
  }
  return "";
}

function normalizeChunk(chunk: AnalysisChunk, source: SourceRow, index: number) {
  const type = CHUNK_TYPES.has(String(chunk.chunk_type)) ? String(chunk.chunk_type) : "extrait";
  const contentText = normalizeExtractedText(chunk.content_text);
  if (!contentText) return null;

  return {
    source_id: source.id,
    chunk_type: type,
    title: chunk.title?.trim() || `${source.title} - extrait ${index + 1}`,
    content_text: contentText.slice(0, 8000),
    page_start: Number.isFinite(chunk.page_start) ? chunk.page_start : null,
    page_end: Number.isFinite(chunk.page_end) ? chunk.page_end : null,
    level: typeof chunk.level === "string" && chunk.level ? chunk.level : source.level_min,
    domains: Array.isArray(chunk.domains) && chunk.domains.length ? chunk.domains : source.pedagogical_domains,
    theme: chunk.theme?.trim() || source.themes?.[0] || null,
    metadata: {
      ...(chunk.metadata || {}),
      analysis_lot: "B",
      source_kind: source.source_kind,
      transcription_segment_keys: Array.isArray(chunk.segment_keys) ? chunk.segment_keys : [],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  let triggeredBy: string | null = null;
  let sourceId: string | null = null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    triggeredBy = await getUserIdFromAuth(req);
    if (!triggeredBy) return json(401, { error: "Authentification requise." });

    const secretBlock = await ensurePseudonymSecretOrLog("analyze-pedagogical-source", corsHeaders, null);
    if (secretBlock) return secretBlock;

    const body = await req.json();
    sourceId = body?.sourceId;
    if (!sourceId || typeof sourceId !== "string") return json(400, { error: "sourceId est requis." });

    const { data: source, error: sourceError } = await supabase
      .from("pedagogical_sources")
      .select("*")
      .eq("id", sourceId)
      .single();
    if (sourceError || !source) throw sourceError || new Error("Source introuvable.");

    let reviewedSegments: ReviewedTranscriptionSegment[] = [];
    if (source.source_kind === "audio") {
      const { data: transcription, error: transcriptionError } = await supabase
        .from("pedagogical_source_transcriptions")
        .select("id, status")
        .eq("source_id", sourceId)
        .eq("is_current", true)
        .eq("status", "reviewed")
        .maybeSingle();
      if (transcriptionError) throw transcriptionError;
      if (!transcription) return json(422, { error: "REVIEWED_TRANSCRIPTION_REQUIRED" });
      const { data: segments, error: segmentsError } = await supabase
        .from("pedagogical_source_transcription_segments")
        .select("id, segment_key, sequence_index, start_ms, end_ms, raw_text, reviewed_text")
        .eq("transcription_id", transcription.id)
        .order("sequence_index");
      if (segmentsError) throw segmentsError;
      reviewedSegments = (segments ?? []) as ReviewedTranscriptionSegment[];
      if (reviewedSegments.length === 0 || reviewedSegments.some((segment) => !(segment.reviewed_text || segment.raw_text).trim())) {
        return json(422, { error: "REVIEWED_TRANSCRIPTION_SEGMENTS_REQUIRED" });
      }
    }

    await supabase
      .from("pedagogical_sources")
      .update({
        status: "analyzing",
        metadata: {
          ...(source.metadata || {}),
          analysis_started_at: new Date().toISOString(),
        },
      })
      .eq("id", sourceId);

    let extractedText = "";
    let analysis;
    if (source.source_kind === "audio") {
      extractedText = reviewedSegments
        .map((segment) => `[${segment.segment_key} ${segment.start_ms}-${segment.end_ms}] ${segment.reviewed_text || segment.raw_text}`)
        .join("\n");
      analysis = await analyzeText(source, extractedText, true);
    } else {
      const { data: file, error: downloadError } = await supabase.storage
        .from(source.storage_bucket)
        .download(source.storage_path);
      if (downloadError || !file) throw downloadError || new Error("Fichier source introuvable.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > MAX_FILE_BYTES) throw new AIError("Fichier trop volumineux pour le lot B. Limite : 18 Mo.", 413);
      const mimeType = source.mime_type || file.type || "application/octet-stream";
      extractedText = await extractTextForMime(bytes, mimeType);
      analysis = extractedText.length > 80
        ? await analyzeText(source, extractedText)
        : await analyzeFileWithGemini(source, bytes, mimeType);
    }

    const chunks = (analysis.chunks || [])
      .slice(0, 24)
      .map((chunk, index) => normalizeChunk(chunk, source, index))
      .filter(Boolean);

    if (chunks.length === 0) {
      throw new AIError("Analyse terminee mais aucun morceau exploitable n'a ete extrait.", 422);
    }

    await supabase.from("pedagogical_source_chunks").delete().eq("source_id", sourceId);
    const { data: insertedChunks, error: insertError } = await supabase.from("pedagogical_source_chunks").insert(chunks).select("id, metadata");
    if (insertError) throw insertError;
    if (source.source_kind === "audio") {
      const segmentByKey = new Map(reviewedSegments.map((segment) => [segment.segment_key, segment]));
      const links = (insertedChunks ?? []).flatMap((chunk: { id: string; metadata: Record<string, unknown> }) => {
        const keys = Array.isArray(chunk.metadata?.transcription_segment_keys)
          ? chunk.metadata.transcription_segment_keys.filter((key): key is string => typeof key === "string" && segmentByKey.has(key))
          : [];
        return keys.map((key, sequence_index) => ({ chunk_id: chunk.id, segment_id: segmentByKey.get(key)!.id, sequence_index }));
      });
      if (links.length === 0) throw new AIError("Analyse audio invalide : aucun chunk ne référence un segment existant.", 422);
      const { error: linksError } = await supabase.from("pedagogical_source_chunk_segments").insert(links);
      if (linksError) throw linksError;
    }

    const updatedMetadata = {
      ...(source.metadata || {}),
      analysis_completed_at: new Date().toISOString(),
      analysis_model: extractedText.length > 80 ? "text+google/gemini-2.5-flash" : "multimodal/gemini-2.5-flash",
      analysis_summary: analysis.summary || null,
      detected_level: analysis.detected_level || null,
      detected_domains: analysis.detected_domains || [],
      chunks_count: chunks.length,
      text_extracted_chars: extractedText.length,
    };

    await supabase
      .from("pedagogical_sources")
      .update({ status: "analyzed", metadata: updatedMetadata })
      .eq("id", sourceId);

    await logAICall({
      function_name: "analyze-pedagogical-source",
      triggered_by_user_id: triggeredBy,
      status: "ok",
      data_categories: ["pedagogical_source"],
      pseudonymization_level: "none",
      duration_ms: Date.now() - startedAt,
    });

    return json(200, {
      ok: true,
      chunks_count: chunks.length,
      summary: analysis.summary,
    });
  } catch (error) {
    console.error("analyze-pedagogical-source error:", error);

    if (sourceId) {
      await supabase
        .from("pedagogical_sources")
        .update({
          status: "error",
          metadata: {
            analysis_error: error instanceof Error ? error.message : "Erreur inconnue",
            analysis_failed_at: new Date().toISOString(),
          },
        })
        .eq("id", sourceId);
    }

    await logAICall({
      function_name: "analyze-pedagogical-source",
      triggered_by_user_id: triggeredBy,
      status: "error",
      data_categories: ["pedagogical_source"],
      pseudonymization_level: "none",
      duration_ms: Date.now() - startedAt,
    });

    if (error instanceof AIError) {
      if (error.detail) console.error("AI provider detail:", error.detail.slice(0, 1000));
      const status = error.status >= 500 ? 502 : error.status;
      return json(status, { error: error.message });
    }

    return json(500, { error: error instanceof Error ? error.message : "Erreur inconnue" });
  }
});
