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

// Le déplacement/renumérotation (Monter/Descendre, insertion) passe par
// src/lib/curriculum/sessionFlow.ts depuis le Lot 3 : l'ordre est partagé
// avec session_document_links (exercices liés), donc il ne peut plus être
// géré uniquement au niveau de cette table.

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
