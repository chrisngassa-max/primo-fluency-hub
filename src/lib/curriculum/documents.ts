import { supabase as _supabase } from "@/integrations/supabase/client";
// session_documents is added via supabase/migrations/20260708210000_*.sql
// and extended (display_order, audience) via 20260709100000_*.sql.
// Until Supabase types are regenerated, cast the client to `any` like the
// rest of the curriculum v2 modules (see src/lib/curriculum/api.ts).
const supabase = _supabase as any;
import type { SessionDocument, SessionDocumentAudience, SessionDocumentStatus, SessionDocumentType } from "./types";

const SESSION_DOCUMENT_COLUMNS =
  "id, session_code, document_type, title, level, competence, status, content_html, content_json, source_file_path, file_url, version, display_order, audience, updated_at";

const BLANK_DOCUMENT_LABELS: Partial<Record<SessionDocumentType, string>> = {
  note_formateur: "Note formateur",
  consigne_apprenant: "Consigne apprenant",
  activite_ecrite: "Activité écrite",
  activite_orale: "Activité orale",
  support_libre: "Support libre",
};

export async function fetchSessionDocuments(sessionCode: string): Promise<SessionDocument[]> {
  const { data, error } = await supabase
    .from("session_documents")
    .select(SESSION_DOCUMENT_COLUMNS)
    .eq("session_code", sessionCode)
    .order("display_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionDocument[];
}

export async function updateSessionDocumentContent(
  id: string,
  content_html: string,
): Promise<void> {
  const { error } = await supabase
    .from("session_documents")
    .update({ content_html })
    .eq("id", id);

  if (error) throw error;
}

export async function updateSessionDocumentStatus(
  id: string,
  status: SessionDocumentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("session_documents")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Renumérote 1..N les display_order de la séance selon l'ordre du tableau
 * reçu (ordre global, toutes audiences confondues). Utilisé après une
 * insertion pour spliced le nouveau document à la bonne position sans
 * gérer d'ordre fractionnaire.
 */
export async function reorderSessionDocuments(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("session_documents").update({ display_order: index + 1 }).eq("id", id),
    ),
  );
}

/** Échange le display_order de deux documents (bouton Monter/Descendre). */
export async function swapSessionDocumentOrder(
  docA: { id: string; display_order: number },
  docB: { id: string; display_order: number },
): Promise<void> {
  await Promise.all([
    supabase.from("session_documents").update({ display_order: docB.display_order }).eq("id", docA.id),
    supabase.from("session_documents").update({ display_order: docA.display_order }).eq("id", docB.id),
  ]);
}

export async function createBlankSessionDocument(params: {
  sessionCode: string;
  documentType: SessionDocumentType;
  audience: SessionDocumentAudience;
  displayOrder: number;
}): Promise<SessionDocument> {
  const { sessionCode, documentType, audience, displayOrder } = params;
  const { data, error } = await supabase
    .from("session_documents")
    .insert({
      session_code: sessionCode,
      document_type: documentType,
      title: BLANK_DOCUMENT_LABELS[documentType] ?? "Nouveau document",
      status: "brouillon",
      content_html: "",
      audience,
      display_order: displayOrder,
    })
    .select(SESSION_DOCUMENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as SessionDocument;
}

export async function deleteSessionDocument(id: string): Promise<void> {
  const { error } = await supabase.from("session_documents").delete().eq("id", id);
  if (error) throw error;
}
