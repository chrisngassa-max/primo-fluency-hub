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

/** Liens de la séance + aperçu de l'exercice pointé (jamais son contenu). */
export async function fetchSessionDocumentLinks(sessionCode: string): Promise<LinkWithExercise[]> {
  const { data: links, error } = await supabase
    .from("session_document_links")
    .select(LINK_COLUMNS)
    .eq("session_code", sessionCode)
    .order("display_order", { ascending: true });
  if (error) throw error;

  const rows = (links ?? []) as SessionDocumentLink[];
  if (rows.length === 0) return [];

  const exerciseIds = [...new Set(rows.map((l) => l.linked_id))];
  const { data: exercises, error: exError } = await supabase
    .from("exercices")
    .select(BANK_PREVIEW_COLUMNS)
    .in("id", exerciseIds);
  if (exError) throw exError;

  const byId = new Map((exercises ?? []).map((e: ExerciseBankPreview) => [e.id, e]));
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

/** Retire l'exercice du déroulé. Supprime uniquement la liaison, jamais l'exercice. */
export async function removeExerciseLink(id: string): Promise<void> {
  const { error } = await supabase.from("session_document_links").delete().eq("id", id);
  if (error) throw error;
}

export async function updateExerciseLinkOrder(id: string, display_order: number): Promise<void> {
  const { error } = await supabase.from("session_document_links").update({ display_order }).eq("id", id);
  if (error) throw error;
}
