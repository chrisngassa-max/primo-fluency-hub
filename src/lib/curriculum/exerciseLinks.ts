import { supabase as _supabase } from "@/integrations/supabase/client";
// session_document_links is added via supabase/migrations/20260709120000_*.sql,
// which also adds the "staff_read_bank_exercices" policy on exercices needed
// for search-first to actually return rows to a non-owner formateur. Cast to
// `any` like the rest of the curriculum v2 modules pending type regeneration.
const supabase = _supabase as any;
import type {
  ExerciseBankDetail,
  ExerciseBankFilters,
  ExerciseBankPreview,
  SessionDocumentAudience,
  SessionDocumentLink,
} from "./types";

const BANK_PREVIEW_COLUMNS = "id, titre, niveau_vise, competence, format, theme, validation_status, validation_score";
const LINK_COLUMNS = "id, session_code, linked_type, linked_id, audience, display_order, title, metadata, updated_at";

const DEFAULT_VALIDATION_STATUSES = ["validated_auto", "approved_human"];

/**
 * Recherche dans la banque d'exercices partagée uniquement (is_template=false,
 * eleve_id IS NULL — jamais un devoir ou une copie d'élève). Ne lit jamais
 * `contenu` ici : la liste de recherche reste légère et ne permet aucune
 * édition, conformément au Lot 3 (voir seulement, ne pas modifier l'exercice).
 */
export async function searchExerciseBank(filters: ExerciseBankFilters = {}): Promise<ExerciseBankPreview[]> {
  let query = supabase
    .from("exercices")
    .select(BANK_PREVIEW_COLUMNS)
    .eq("is_template", false)
    .is("eleve_id", null);

  query = query.eq("niveau_vise", filters.niveau_vise ?? "A2");
  if (filters.competence) query = query.eq("competence", filters.competence);
  if (filters.format) query = query.eq("format", filters.format);
  if (filters.theme) query = query.ilike("theme", `%${filters.theme}%`);

  const statuses = filters.validation_status ?? DEFAULT_VALIDATION_STATUSES;
  query = query.in("validation_status", statuses);

  const { data, error } = await query.order("titre").limit(100);
  if (error) throw error;
  return (data ?? []) as ExerciseBankPreview[];
}

export async function fetchExerciseBankDetail(id: string): Promise<ExerciseBankDetail> {
  const { data, error } = await supabase
    .from("exercices")
    .select(`${BANK_PREVIEW_COLUMNS}, consigne, contenu`)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ExerciseBankDetail;
}

interface LinkWithExercise {
  link: SessionDocumentLink;
  exercise: ExerciseBankPreview | null;
}

/** Liens de la séance + aperçu de l'exercice pointé (jamais son contenu).
 * Depuis le Lot 4, tous les liens ne sont pas des exercices (pdf/docx/image) :
 * `exercise` reste null pour ceux-là, leur affichage se construit depuis
 * link.metadata (voir ImportedFileCard). */
export async function fetchSessionDocumentLinks(sessionCode: string): Promise<LinkWithExercise[]> {
  const { data: links, error } = await supabase
    .from("session_document_links")
    .select(LINK_COLUMNS)
    .eq("session_code", sessionCode)
    .order("display_order", { ascending: true });
  if (error) throw error;

  const rows = (links ?? []) as SessionDocumentLink[];
  if (rows.length === 0) return [];

  const exerciseIds = [...new Set(rows.filter((l) => l.linked_type === "exercise").map((l) => l.linked_id))];
  const byId = new Map<string, ExerciseBankPreview>();
  if (exerciseIds.length > 0) {
    const { data: exercises, error: exError } = await supabase
      .from("exercices")
      .select(BANK_PREVIEW_COLUMNS)
      .in("id", exerciseIds);
    if (exError) throw exError;
    for (const e of (exercises ?? []) as ExerciseBankPreview[]) byId.set(e.id, e);
  }

  return rows.map((link) => ({ link, exercise: byId.get(link.linked_id) ?? null }));
}

/** Ajoute un exercice existant au déroulé. Ne copie ni ne modifie jamais l'exercice. */
export async function addExerciseLink(params: {
  sessionCode: string;
  exerciseId: string;
  title: string;
  audience?: SessionDocumentAudience;
  displayOrder: number;
}): Promise<SessionDocumentLink> {
  const { sessionCode, exerciseId, title, audience = "apprenant", displayOrder } = params;
  const { data, error } = await supabase
    .from("session_document_links")
    .insert({
      session_code: sessionCode,
      linked_type: "exercise",
      linked_id: exerciseId,
      audience,
      display_order: displayOrder,
      title,
    })
    .select(LINK_COLUMNS)
    .single();
  if (error) throw error;
  return data as SessionDocumentLink;
}

/** Retire un lien (exercice ou fichier importé) du déroulé. Supprime
 * uniquement la liaison — jamais l'exercice, jamais le fichier Storage
 * (nettoyage Storage prévu dans un lot ultérieur, voir Lot 4). */
export async function removeSessionDocumentLink(id: string): Promise<void> {
  const { error } = await supabase.from("session_document_links").delete().eq("id", id);
  if (error) throw error;
}

/** Affecte un lien (exercice ou fichier importé) à un public sans le
 * dupliquer : ne met à jour que audience (staging -> formateur/apprenant/both). */
export async function updateSessionDocumentLinkAudience(
  id: string,
  audience: SessionDocumentAudience,
): Promise<void> {
  const { error } = await supabase.from("session_document_links").update({ audience }).eq("id", id);
  if (error) throw error;
}
