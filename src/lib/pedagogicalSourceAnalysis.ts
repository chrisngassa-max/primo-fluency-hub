import { supabase as _supabase } from "@/integrations/supabase/client";

const supabase = _supabase as any;

export type PedagogicalSourceChunkType =
  | "resume"
  | "extrait"
  | "lecon"
  | "consigne"
  | "exercice"
  | "corrige"
  | "vocabulaire"
  | "grammaire"
  | "conjugaison"
  | "phonetique"
  | "civique"
  | "image_description"
  | "metadata";

export interface PedagogicalSourceChunk {
  id: string;
  source_id: string;
  chunk_type: PedagogicalSourceChunkType;
  title: string | null;
  content_text: string;
  page_start: number | null;
  page_end: number | null;
  level: string | null;
  domains: string[];
  theme: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const CHUNK_COLUMNS = [
  "id",
  "source_id",
  "chunk_type",
  "title",
  "content_text",
  "page_start",
  "page_end",
  "level",
  "domains",
  "theme",
  "metadata",
  "created_at",
  "updated_at",
].join(", ");

export async function fetchPedagogicalSourceChunks(sourceId: string): Promise<PedagogicalSourceChunk[]> {
  const { data, error } = await supabase
    .from("pedagogical_source_chunks")
    .select(CHUNK_COLUMNS)
    .eq("source_id", sourceId)
    .order("page_start", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PedagogicalSourceChunk[];
}

export async function countPedagogicalSourceChunks(sourceId: string): Promise<number> {
  const { count, error } = await supabase
    .from("pedagogical_source_chunks")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);

  if (error) throw error;
  return count ?? 0;
}

export async function analyzePedagogicalSource(sourceId: string): Promise<{ chunks_count: number; summary?: string }> {
  const { data, error } = await supabase.functions.invoke("analyze-pedagogical-source", {
    body: { sourceId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as { chunks_count: number; summary?: string };
}
