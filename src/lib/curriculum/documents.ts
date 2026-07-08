import { supabase as _supabase } from "@/integrations/supabase/client";
// session_documents is added via supabase/migrations/20260708210000_*.sql.
// Until Supabase types are regenerated, cast the client to `any` like the
// rest of the curriculum v2 modules (see src/lib/curriculum/api.ts).
const supabase = _supabase as any;
import type { SessionDocument, SessionDocumentStatus } from "./types";

export async function fetchSessionDocuments(sessionCode: string): Promise<SessionDocument[]> {
  const { data, error } = await supabase
    .from("session_documents")
    .select(
      "id, session_code, document_type, title, level, competence, status, content_html, content_json, source_file_path, file_url, version, updated_at",
    )
    .eq("session_code", sessionCode)
    .order("document_type");

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
