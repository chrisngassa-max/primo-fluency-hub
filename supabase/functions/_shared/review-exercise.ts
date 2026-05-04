import { callAI } from "./ai-client.ts";
import type { PedagogicalDirectives } from "./pedagogical-directives.ts";

export interface ExerciseReviewInput {
  exercise: Record<string, any>;
  pedagogicalDirectives?: PedagogicalDirectives | null;
  niveau?: string | null;
  competence?: string | null;
  contexte?: string | null;
  useAI?: boolean;
}

export interface ExerciseReviewIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  field?: string;
  correction?: string;
}

export interface ExerciseReviewResult {
  niveau_ok: boolean;
  pedagogie_ok: boolean;
  directives_ok: boolean;
  issues: ExerciseReviewIssue[];
  suggestions: string[];
  corrections: Array<{
    item_index?: number | null;
    probleme: string;
    correction: string;
  }>;
  source: "deterministic" | "ai" | "deterministic_ai_failed";
}

const PRODUCTION_ECRITE_LONGUE_FORMATS = new Set(["redaction_libre", "production_ecrite_longue"]);
const TEXT_LONG_LIMIT = 450;

function wordCount(value: unknown): number {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function getItems(exercise: Record<string, any>): any[] {
  const items = exercise?.contenu?.items;
  return Array.isArray(items) ? items : [];
}

function pushIssue(
  issues: ExerciseReviewIssue[],
  code: string,
  severity: "error" | "warning",
  message: string,
  field?: string,
  correction?: string,
) {
  issues.push({ code, severity, message, ...(field ? { field } : {}), ...(correction ? { correction } : {}) });
}

function deterministicReview(input: ExerciseReviewInput): ExerciseReviewResult {
  const { exercise, pedagogicalDirectives } = input;
  const issues: ExerciseReviewIssue[] = [];
  const suggestions: string[] = [];
  const corrections: ExerciseReviewResult["corrections"] = [];
  const format = String(exercise?.format ?? "");
  const competence = String(exercise?.competence ?? input.competence ?? "");
  const contenu = exercise?.contenu ?? {};
  const items = getItems(exercise);
  const maxConsigneWords = pedagogicalDirectives?.longueur_max_consigne_mots ?? 12;

  if (wordCount(exercise?.consigne) > maxConsigneWords) {
    pushIssue(
      issues,
      "consigne_too_long_for_directives",
      "warning",
      `Consigne trop longue (${wordCount(exercise?.consigne)} mots, max ${maxConsigneWords}).`,
      "consigne",
      "Reformuler avec un imperatif court.",
    );
  }

  if (pedagogicalDirectives?.formats_interdits?.includes(format) || PRODUCTION_ECRITE_LONGUE_FORMATS.has(format)) {
    pushIssue(
      issues,
      "format_forbidden_by_directives",
      "error",
      `Format interdit par les directives: ${format}.`,
      "format",
      `Choisir: ${pedagogicalDirectives?.formats_autorises?.join(", ") || "qcm, appariement, texte_lacunaire"}.`,
    );
  }

  if (
    pedagogicalDirectives?.formats_interdits?.includes("texte_long") &&
    typeof contenu.texte === "string" &&
    contenu.texte.length > TEXT_LONG_LIMIT
  ) {
    pushIssue(
      issues,
      "text_too_long_for_directives",
      "warning",
      `Texte support trop long (${contenu.texte.length} caracteres).`,
      "contenu.texte",
      "Reduire le support ou le transformer en audio/image.",
    );
  }

  if (pedagogicalDirectives?.nombre_items_max && items.length > pedagogicalDirectives.nombre_items_max) {
    pushIssue(
      issues,
      "too_many_items_for_scaffolding",
      "warning",
      `Trop d'items (${items.length}, max ${pedagogicalDirectives.nombre_items_max}).`,
      "contenu.items",
      "Reduire le nombre d'items pour limiter la charge cognitive.",
    );
  }

  const requiredSupports = pedagogicalDirectives?.supports_obligatoires ?? [];
  if (requiredSupports.includes("audio") && competence === "CO" && !contenu.script_audio) {
    pushIssue(issues, "missing_required_audio", "error", "Support audio obligatoire absent.", "contenu.script_audio");
  }
  if (requiredSupports.includes("image") && !contenu.image_description && !contenu.image_url) {
    pushIssue(issues, "missing_required_image", "warning", "Support image attendu par les directives.", "contenu.image_description");
  }
  if (requiredSupports.includes("banque_de_mots") && !contenu.banque_de_mots && !contenu.word_bank) {
    suggestions.push("Ajouter une banque de mots pour reduire la charge d'ecriture.");
  }

  if (pedagogicalDirectives?.regle_descente && (format === "production_ecrite" || format === "production_ecrite_longue")) {
    pushIssue(
      issues,
      "missing_competence_descent",
      "error",
      "EE faible: l'exercice demande encore une production ecrite libre.",
      "format",
      "Remplacer par Structures, texte lacunaire, appariement ou transformation simple.",
    );
  }

  items.forEach((item, index) => {
    if (format === "qcm" && Array.isArray(item.options)) {
      const answers = Array.isArray(item.bonne_reponse) ? item.bonne_reponse : [item.bonne_reponse];
      for (const answer of answers) {
        if (!item.options.some((option: any) => String(option).trim().toLowerCase() === String(answer).trim().toLowerCase())) {
          pushIssue(
            issues,
            "qcm_answer_not_in_options",
            "error",
            `Item ${index + 1}: bonne_reponse absente des options.`,
            `contenu.items.${index}.bonne_reponse`,
          );
        }
      }
    }
    if (item.explication && wordCount(item.explication) > 22) {
      pushIssue(
        issues,
        "feedback_too_long",
        "warning",
        `Item ${index + 1}: feedback trop long pour A0/A1.`,
        `contenu.items.${index}.explication`,
        "Utiliser une phrase courte: La bonne reponse est ...",
      );
    }
  });

  if (pedagogicalDirectives?.niveau_etayage === "fort" && !exercise?.variante_niveau_bas) {
    pushIssue(issues, "missing_low_variant", "warning", "Variante basse absente pour un etayage fort.", "variante_niveau_bas");
  }

  return {
    niveau_ok: !issues.some((issue) => issue.code === "consigne_too_long_for_directives" && issue.severity === "error"),
    pedagogie_ok: !issues.some((issue) => issue.severity === "error"),
    directives_ok: !issues.some((issue) =>
      issue.severity === "error" && (issue.code.includes("directives") || issue.code === "missing_competence_descent")
    ),
    issues,
    suggestions,
    corrections,
    source: "deterministic",
  };
}

function mergeReviews(base: ExerciseReviewResult, aiReview: any): ExerciseReviewResult {
  const aiIssues = Array.isArray(aiReview?.issues)
    ? aiReview.issues
    : Array.isArray(aiReview?.corrections)
      ? aiReview.corrections.map((c: any) => ({
          code: "ai_correction",
          severity: "warning",
          message: String(c.probleme ?? "Correction suggeree"),
          correction: String(c.correction ?? ""),
        }))
      : [];

  return {
    niveau_ok: Boolean(aiReview?.niveau_ok ?? true) && base.niveau_ok,
    pedagogie_ok: Boolean(aiReview?.pedagogie_ok ?? aiReview?.niveau_ok ?? true) && base.pedagogie_ok,
    directives_ok: Boolean(aiReview?.directives_ok ?? true) && base.directives_ok,
    issues: [
      ...base.issues,
      ...aiIssues.map((issue: any) => ({
        code: String(issue.code ?? "ai_review"),
        severity: issue.severity === "error" ? "error" : "warning",
        message: String(issue.message ?? issue.probleme ?? "Signal pedagogique IA"),
        ...(issue.field ? { field: String(issue.field) } : {}),
        ...(issue.correction ? { correction: String(issue.correction) } : {}),
      })),
    ],
    suggestions: [...base.suggestions, ...(Array.isArray(aiReview?.suggestions) ? aiReview.suggestions.map(String) : [])],
    corrections: [
      ...base.corrections,
      ...(Array.isArray(aiReview?.corrections)
        ? aiReview.corrections.map((c: any) => ({
            item_index: typeof c.item_index === "number" ? c.item_index : null,
            probleme: String(c.probleme ?? ""),
            correction: String(c.correction ?? ""),
          }))
        : []),
    ],
    source: "ai",
  };
}

export async function reviewExercise(input: ExerciseReviewInput): Promise<ExerciseReviewResult> {
  const base = deterministicReview(input);
  if (input.useAI === false) return base;

  const systemPrompt = `Tu es expert en didactique du FLE A0/A1 et preparation TCF IRN.
Tu fais une revue pedagogique stricte d'un exercice.
Retourne uniquement du JSON strict avec:
{
  "niveau_ok": boolean,
  "pedagogie_ok": boolean,
  "directives_ok": boolean,
  "issues": [{"code": string, "severity": "error"|"warning", "message": string, "field": string, "correction": string}],
  "suggestions": string[],
  "corrections": [{"item_index": number|null, "probleme": string, "correction": string}]
}

Controle:
- niveau A0/A1 reel, vocabulaire quotidien, phrases simples;
- coherence consigne / questions / reponses;
- distracteurs plausibles mais non ambigus;
- feedback simple, non technique;
- respect TCF IRN et competence cible;
- respect strict des directives pedagogiques si fournies.`;

  const userPrompt = `EXERCICE:
${JSON.stringify(input.exercise, null, 2)}

DIRECTIVES PEDAGOGIQUES:
${JSON.stringify(input.pedagogicalDirectives ?? null, null, 2)}

CONTEXTE:
${JSON.stringify({
    niveau: input.niveau ?? input.exercise?.niveau_vise ?? "A1",
    competence: input.competence ?? input.exercise?.competence ?? null,
    contexte: input.contexte ?? null,
  }, null, 2)}

REVUE DETERMINISTE DEJA DETECTEE:
${JSON.stringify(base, null, 2)}`;

  try {
    const data = await callAI({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "review_exercise",
          description: "Retourne la revue pedagogique structuree d'un exercice FLE A0/A1 TCF IRN",
          parameters: {
            type: "object",
            properties: {
              niveau_ok: { type: "boolean" },
              pedagogie_ok: { type: "boolean" },
              directives_ok: { type: "boolean" },
              issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    code: { type: "string" },
                    severity: { type: "string", enum: ["error", "warning"] },
                    message: { type: "string" },
                    field: { type: "string" },
                    correction: { type: "string" },
                  },
                  required: ["code", "severity", "message"],
                },
              },
              suggestions: { type: "array", items: { type: "string" } },
              corrections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item_index: { type: "number" },
                    probleme: { type: "string" },
                    correction: { type: "string" },
                  },
                  required: ["probleme", "correction"],
                },
              },
            },
            required: ["niveau_ok", "pedagogie_ok", "directives_ok", "issues", "suggestions", "corrections"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "review_exercise" } },
    });

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return base;
    return mergeReviews(base, JSON.parse(toolCall.function.arguments));
  } catch (error) {
    console.warn("[review-exercise] AI review failed, keeping deterministic review:", error);
    return { ...base, source: "deterministic_ai_failed" };
  }
}

export function hasBlockingReviewIssue(review: ExerciseReviewResult): boolean {
  return review.issues.some((issue) => issue.severity === "error") || !review.pedagogie_ok || !review.directives_ok;
}
