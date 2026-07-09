import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as any;
const STORAGE_BUCKET = "pedagogical-sources";

export type PedagogicalSourceKind =
  | "manuel"
  | "lecon"
  | "exercice_source"
  | "image"
  | "document_authentique"
  | "audio"
  | "video"
  | "reference"
  | "corpus"
  | "evaluation";

export type PedagogicalReviewStatus = "brouillon" | "utilisable" | "valide" | "a_remplacer";
export type PedagogicalSourceStatus = "imported" | "analyzing" | "analyzed" | "error";

export type SourceUsageScope =
  | "context_ia"
  | "support_formateur"
  | "support_apprenant"
  | "source_exercices"
  | "source_vocabulaire";

export interface PedagogicalSource {
  id: string;
  title: string;
  author: string | null;
  source_kind: PedagogicalSourceKind;
  source_subtype: string | null;
  pedagogical_domains: string[];
  level_min: string | null;
  level_max: string | null;
  themes: string[];
  status: PedagogicalSourceStatus;
  review_status: PedagogicalReviewStatus;
  storage_bucket: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  source_origin: string | null;
  rights_status: string | null;
  license_note: string | null;
  reusable_for_students: boolean;
  reusable_for_ai: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionPedagogicalSourceLink {
  id: string;
  session_code: string;
  source_id: string;
  usage_scope: SourceUsageScope;
  priority: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  source?: PedagogicalSource;
}

export interface PedagogicalSourceFilters {
  search?: string;
  kind?: string;
  domain?: string;
  level?: string;
  reviewStatus?: string;
}

export interface CreatePedagogicalSourceInput {
  file: File;
  title: string;
  author?: string;
  sourceKind: PedagogicalSourceKind;
  sourceSubtype?: string;
  pedagogicalDomains: string[];
  levelMin?: string;
  levelMax?: string;
  themes: string[];
  sourceOrigin?: string;
  rightsStatus?: string;
  licenseNote?: string;
  reusableForStudents: boolean;
  reusableForAi: boolean;
  userId: string;
}

export const SOURCE_KIND_LABELS: Record<PedagogicalSourceKind, string> = {
  manuel: "Manuel",
  lecon: "Leçon",
  exercice_source: "Exercices source",
  image: "Image",
  document_authentique: "Document authentique",
  audio: "Audio",
  video: "Vidéo",
  reference: "Référence",
  corpus: "Corpus",
  evaluation: "Évaluation",
};

export const SOURCE_USAGE_LABELS: Record<SourceUsageScope, string> = {
  context_ia: "Contexte IA",
  support_formateur: "Support formateur",
  support_apprenant: "Support apprenant",
  source_exercices: "Source exercices",
  source_vocabulaire: "Source vocabulaire",
};

export const PEDAGOGICAL_DOMAINS = [
  "grammaire",
  "vocabulaire",
  "conjugaison",
  "phonetique",
  "CE",
  "CO",
  "EE",
  "EO",
  "civique",
  "methodologie_tcf",
] as const;

export const SOURCE_KINDS: PedagogicalSourceKind[] = [
  "manuel",
  "lecon",
  "exercice_source",
  "image",
  "document_authentique",
  "reference",
  "corpus",
  "evaluation",
  "audio",
  "video",
];

export const SOURCE_SUBTYPES = [
  "manuel_complet",
  "chapitre_manuel",
  "lecon_directe",
  "fiche_synthese",
  "liste_vocabulaire",
  "fiche_grammaire",
  "fiche_conjugaison",
  "fiche_phonetique",
  "serie_exercices",
  "corrige",
  "support_image",
  "formulaire",
  "dialogue",
  "transcription",
  "reference_cadrage",
  "evaluation_type",
] as const;

const SOURCE_COLUMNS = [
  "id",
  "title",
  "author",
  "source_kind",
  "source_subtype",
  "pedagogical_domains",
  "level_min",
  "level_max",
  "themes",
  "status",
  "review_status",
  "storage_bucket",
  "storage_path",
  "file_size",
  "mime_type",
  "source_origin",
  "rights_status",
  "license_note",
  "reusable_for_students",
  "reusable_for_ai",
  "metadata",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

const SESSION_SOURCE_COLUMNS = [
  "id",
  "session_code",
  "source_id",
  "usage_scope",
  "priority",
  "notes",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

function cleanList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function splitTags(value: string): string[] {
  return cleanList(value.split(/[,\n;]/g));
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "Taille inconnue";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function sourceKindFromFile(file: File): PedagogicalSourceKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document_authentique";
}

export async function uploadPedagogicalSourceFile(file: File, userId: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return storagePath;
}

export async function createPedagogicalSource(input: CreatePedagogicalSourceInput): Promise<PedagogicalSource> {
  const storagePath = await uploadPedagogicalSourceFile(input.file, input.userId);
  const { data, error } = await supabase
    .from("pedagogical_sources")
    .insert({
      title: input.title.trim(),
      author: input.author?.trim() || null,
      source_kind: input.sourceKind,
      source_subtype: input.sourceSubtype || null,
      pedagogical_domains: cleanList(input.pedagogicalDomains),
      level_min: input.levelMin || null,
      level_max: input.levelMax || null,
      themes: cleanList(input.themes),
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      file_size: input.file.size,
      mime_type: input.file.type || "application/octet-stream",
      source_origin: input.sourceOrigin?.trim() || null,
      rights_status: input.rightsStatus?.trim() || null,
      license_note: input.licenseNote?.trim() || null,
      reusable_for_students: input.reusableForStudents,
      reusable_for_ai: input.reusableForAi,
      metadata: {
        original_filename: input.file.name,
        imported_via: "pedagogical_sources_lot_a",
      },
      created_by: input.userId,
    })
    .select(SOURCE_COLUMNS)
    .single();
  if (error) throw error;
  return data as PedagogicalSource;
}

export async function fetchPedagogicalSources(filters: PedagogicalSourceFilters = {}): Promise<PedagogicalSource[]> {
  let query = supabase.from("pedagogical_sources").select(SOURCE_COLUMNS);
  if (filters.kind && filters.kind !== "all") query = query.eq("source_kind", filters.kind);
  if (filters.reviewStatus && filters.reviewStatus !== "all") query = query.eq("review_status", filters.reviewStatus);
  if (filters.domain && filters.domain !== "all") query = query.contains("pedagogical_domains", [filters.domain]);
  if (filters.level && filters.level !== "all") {
    query = query.or(`level_min.is.null,level_min.lte.${filters.level}`).or(`level_max.is.null,level_max.gte.${filters.level}`);
  }
  if (filters.search?.trim()) {
    const value = filters.search.trim();
    query = query.or(`title.ilike.%${value}%,author.ilike.%${value}%,source_origin.ilike.%${value}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as PedagogicalSource[];
}

export async function getPedagogicalSourceSignedUrl(source: PedagogicalSource, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(source.storage_bucket || STORAGE_BUCKET)
    .createSignedUrl(source.storage_path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl as string;
}

export async function fetchSessionPedagogicalSources(sessionCode: string): Promise<SessionPedagogicalSourceLink[]> {
  const { data: links, error } = await supabase
    .from("session_pedagogical_sources")
    .select(SESSION_SOURCE_COLUMNS)
    .eq("session_code", sessionCode)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (links ?? []) as SessionPedagogicalSourceLink[];
  if (rows.length === 0) return [];

  const sourceIds = [...new Set(rows.map((row) => row.source_id))];
  const { data: sources, error: sourceError } = await supabase
    .from("pedagogical_sources")
    .select(SOURCE_COLUMNS)
    .in("id", sourceIds);
  if (sourceError) throw sourceError;
  const byId = new Map<string, PedagogicalSource>((sources ?? []).map((source: PedagogicalSource) => [source.id, source]));
  return rows.map((row) => ({ ...row, source: byId.get(row.source_id) }));
}

export async function linkPedagogicalSourceToSession(params: {
  sessionCode: string;
  sourceId: string;
  usageScope: SourceUsageScope;
  notes?: string;
  userId: string;
}): Promise<SessionPedagogicalSourceLink> {
  const { data, error } = await supabase
    .from("session_pedagogical_sources")
    .insert({
      session_code: params.sessionCode,
      source_id: params.sourceId,
      usage_scope: params.usageScope,
      notes: params.notes?.trim() || null,
      created_by: params.userId,
    })
    .select(SESSION_SOURCE_COLUMNS)
    .single();
  if (error) throw error;
  return data as SessionPedagogicalSourceLink;
}

export async function unlinkPedagogicalSourceFromSession(id: string): Promise<void> {
  const { error } = await supabase.from("session_pedagogical_sources").delete().eq("id", id);
  if (error) throw error;
}
