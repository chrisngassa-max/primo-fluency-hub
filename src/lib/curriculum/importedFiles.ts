import { supabase as _supabase } from "@/integrations/supabase/client";
const supabase = _supabase as any;
import type { ImportedFileMetadata, SessionDocumentAudience, SessionDocumentLink, SessionDocumentLinkType } from "./types";

const STORAGE_BUCKET = "session-documents";
const LINK_COLUMNS = "id, session_code, linked_type, linked_id, audience, display_order, title, metadata, updated_at";

const EXTENSION_TO_LINK_TYPE: Record<string, SessionDocumentLinkType> = {
  pdf: "pdf",
  docx: "docx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  mp4: "video",
  webm: "video",
};

export function linkTypeForFilename(filename: string): SessionDocumentLinkType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? EXTENSION_TO_LINK_TYPE[ext] ?? null : null;
}

/** Dépose le fichier dans le bucket privé session-documents, sous
 * <session_code>/<uuid>-<nom assaini>. Ne crée aucune ligne en base :
 * voir addFileLink pour la liaison au déroulé de séance. */
export async function uploadSessionFile(file: File, sessionCode: string): Promise<{ storagePath: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${sessionCode}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return { storagePath };
}

/** Crée la liaison session_document_links pour un fichier déjà uploadé.
 * linked_id est un uuid synthétique (pas de ligne exercices correspondante) ;
 * la vraie référence au fichier vit dans metadata.storage_path. */
export async function addFileLink(params: {
  sessionCode: string;
  file: File;
  storagePath: string;
  linkedType: SessionDocumentLinkType;
  audience?: SessionDocumentAudience;
  displayOrder: number;
}): Promise<SessionDocumentLink> {
  const { sessionCode, file, storagePath, linkedType, audience = "staging", displayOrder } = params;
  const metadata: ImportedFileMetadata = {
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type || "application/octet-stream",
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("session_document_links")
    .insert({
      session_code: sessionCode,
      linked_type: linkedType,
      linked_id: crypto.randomUUID(),
      audience,
      display_order: displayOrder,
      title: file.name,
      metadata,
    })
    .select(LINK_COLUMNS)
    .single();
  if (error) throw error;
  return data as SessionDocumentLink;
}

/** URL signée temporaire pour "Voir / Ouvrir" (le bucket est privé). */
export async function getFileSignedUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl as string;
}
