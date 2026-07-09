import { supabase as _supabase } from "@/integrations/supabase/client";
import { addExerciseLink } from "./exerciseLinks";
import type { ImportedFileMetadata, SessionDocumentLink } from "./types";

const supabase = _supabase as any;

export type PdfTransformFormat = "qcm" | "vrai_faux" | "texte_lacunaire" | "production_ecrite";
export type PdfTransformLevel = "A1" | "A2" | "B1" | "B2";
export type PdfTransformCompetence = "CE" | "CO" | "EE" | "EO" | "Structures";

export interface PdfTransformItem {
  question: string;
  options: string[];
  bonne_reponse: string;
  explication: string;
}

export interface PdfTransformDraft {
  sessionCode: string;
  sourceLink: SessionDocumentLink;
  title: string;
  level: PdfTransformLevel;
  competence: PdfTransformCompetence;
  theme: string;
  format: PdfTransformFormat;
  consigne: string;
  sourceText: string;
  items: PdfTransformItem[];
}

export interface PdfTransformIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export const PDF_TRANSFORM_FORMAT_LABELS: Record<PdfTransformFormat, string> = {
  qcm: "QCM interactif",
  vrai_faux: "Vrai / Faux",
  texte_lacunaire: "Texte lacunaire",
  production_ecrite: "Questions ouvertes / production écrite",
};

export function createEmptyPdfTransformItem(format: PdfTransformFormat): PdfTransformItem {
  if (format === "qcm") {
    return { question: "", options: ["", "", "", ""], bonne_reponse: "", explication: "" };
  }
  if (format === "vrai_faux") {
    return { question: "", options: ["vrai", "faux"], bonne_reponse: "vrai", explication: "" };
  }
  return { question: "", options: [], bonne_reponse: "", explication: "" };
}

export function createEmptyPdfTransformItems(format: PdfTransformFormat, count = 3): PdfTransformItem[] {
  return Array.from({ length: count }, () => createEmptyPdfTransformItem(format));
}

export function prevalidatePdfTransformDraft(draft: PdfTransformDraft): {
  status: "draft" | "needs_review";
  score: number;
  issues: PdfTransformIssue[];
} {
  const issues: PdfTransformIssue[] = [];
  const sourceText = draft.sourceText.trim();
  const filledItems = draft.items.filter((item) => item.question.trim());

  if (!draft.title.trim()) {
    issues.push({ code: "missing_title", severity: "error", message: "Le titre de l'exercice est obligatoire." });
  }
  if (!draft.consigne.trim()) {
    issues.push({ code: "missing_instruction", severity: "error", message: "La consigne est obligatoire." });
  }
  if (sourceText.length < 80 && draft.competence === "CE") {
    issues.push({
      code: "source_text_too_short",
      severity: "warning",
      message: "Le texte support est court pour une compréhension écrite.",
    });
  }
  if (filledItems.length === 0 && draft.format !== "production_ecrite") {
    issues.push({ code: "missing_items", severity: "error", message: "Ajoutez au moins une question exploitable." });
  }

  filledItems.forEach((item, index) => {
    const prefix = `Question ${index + 1}`;
    if (draft.format === "qcm") {
      const options = item.options.map((option) => option.trim()).filter(Boolean);
      if (options.length < 3) {
        issues.push({ code: "qcm_not_enough_options", severity: "error", message: `${prefix} : au moins 3 options sont nécessaires.` });
      }
      if (!item.bonne_reponse.trim()) {
        issues.push({ code: "missing_answer", severity: "error", message: `${prefix} : indiquez la bonne réponse.` });
      } else if (!options.includes(item.bonne_reponse.trim())) {
        issues.push({
          code: "answer_not_in_options",
          severity: "error",
          message: `${prefix} : la bonne réponse doit être identique à une option.`,
        });
      }
    } else if (!item.bonne_reponse.trim() && draft.format !== "production_ecrite") {
      issues.push({ code: "missing_answer", severity: "warning", message: `${prefix} : ajoutez une réponse attendue.` });
    }
  });

  const hasError = issues.some((issue) => issue.severity === "error");
  const score = Math.max(20, 100 - issues.filter((i) => i.severity === "error").length * 30 - issues.filter((i) => i.severity === "warning").length * 10);

  return {
    status: hasError ? "draft" : "needs_review",
    score,
    issues,
  };
}

function buildContent(draft: PdfTransformDraft) {
  const meta = draft.sourceLink.metadata as unknown as Partial<ImportedFileMetadata>;
  const cleanItems = draft.items
    .filter((item) => item.question.trim())
    .map((item) => ({
      question: item.question.trim(),
      options: draft.format === "qcm" || draft.format === "vrai_faux" ? item.options.map((option) => option.trim()).filter(Boolean) : undefined,
      bonne_reponse: item.bonne_reponse.trim(),
      explication: item.explication.trim(),
    }));

  return {
    texte: draft.sourceText.trim(),
    items: cleanItems,
    metadata: {
      created_from: "session_pdf_transform",
      source_link_id: draft.sourceLink.id,
      source_storage_path: meta.storage_path ?? null,
      source_filename: meta.original_filename ?? draft.sourceLink.title,
      session_code: draft.sessionCode,
      requires_human_review: true,
    },
  };
}

async function fetchDefaultPointId(): Promise<string> {
  const { data, error } = await supabase.from("points_a_maitriser").select("id").limit(1).single();
  if (error) throw error;
  return data.id;
}

export async function createExerciseFromPdfTransform(params: {
  draft: PdfTransformDraft;
  userId: string;
  displayOrder: number;
}): Promise<SessionDocumentLink> {
  const { draft, userId, displayOrder } = params;
  const validation = prevalidatePdfTransformDraft(draft);
  const pointId = await fetchDefaultPointId();
  const metadataCode = `pdf-import:${draft.sessionCode}:${crypto.randomUUID()}`;

  const insertPayload = {
    formateur_id: userId,
    titre: draft.title.trim(),
    consigne: draft.consigne.trim(),
    competence: draft.competence,
    format: draft.format,
    difficulte: draft.level === "A1" ? 1 : draft.level === "A2" ? 2 : draft.level === "B1" ? 3 : 4,
    niveau_vise: draft.level,
    theme: draft.theme.trim() || null,
    contenu: buildContent(draft),
    point_a_maitriser_id: pointId,
    is_ai_generated: false,
    is_template: false,
    source: "pdf_import",
    statut: "draft",
    validation_status: validation.status,
    validation_profile: "generated_strict",
    validation_source: "import",
    validation_score: validation.score,
    validation_issues: validation.issues,
    validation_checked_at: new Date().toISOString(),
    metadata_code: metadataCode,
  };

  const { data, error } = await supabase.from("exercices").insert(insertPayload).select("id, titre").single();
  if (error) throw error;

  return addExerciseLink({
    sessionCode: draft.sessionCode,
    exerciseId: data.id,
    title: data.titre,
    audience: "apprenant",
    displayOrder,
  });
}
