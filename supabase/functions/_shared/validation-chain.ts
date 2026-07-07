/**
 * Lot 9 — Socle validation déterministe L1–L7 (sans IA, sans scoring search-first).
 * Centralise validateExercise, hasUsableContent, format/compétence, niveau, thème,
 * reviewExercise({ useAI: false }) et règles de correction déterministes.
 */

import { validateExercise, type ExerciseLike } from "./exercise-validator.ts";
import {
  canonicalizeTheme,
  formatsAutorisesForCompetence,
  hasUsableContent,
  niveauWindow,
  type ExerciseRow,
} from "./exercise-search.ts";
import { reviewExercise } from "./review-exercise.ts";
import type { PedagogicalDirectives } from "./pedagogical-directives.ts";

export type ValidationLayer =
  | "L1_structure"
  | "L2_usable_content"
  | "L3_format_competence"
  | "L4_niveau"
  | "L5_theme"
  | "L6_pedagogie"
  | "L7_correction";

export interface ChainIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  field?: string;
  layer: ValidationLayer;
}

export type ValidationProfile = "legacy_bank" | "generated_strict";

export interface ValidationChainContext {
  targetNiveauVise?: string;
  targetThemeId?: string;
  targetTypeDemarche?: string;
  pedagogicalDirectives?: PedagogicalDirectives | null;
}

export interface ValidationChainOptions {
  profile?: ValidationProfile;
  context?: ValidationChainContext;
}

export type SimulatedValidationStatus =
  | "validated_auto"
  | "needs_review"
  | "rejected";

export interface ValidationChainResult {
  ok: boolean;
  status: SimulatedValidationStatus;
  issues: ChainIssue[];
  layers: Record<ValidationLayer, { passed: boolean; issueCount: number }>;
  flags: string[];
  structuralScore: number | null;
  checkedAt: string;
}

const VALID_LEVELS = new Set(["A0", "A1", "A2", "B1", "B2"]);
const SENSITIVE_THEMES = new Set(["prefecture", "vie_citoyenne"]);
const PRODUCTION_FORMATS = new Set(["production_ecrite", "production_orale"]);
const STRUCTURAL_QCM_ERROR_CODES = new Set([
  "qcm_no_options",
  "qcm_answer_not_in_options",
]);

const ALL_LAYERS: ValidationLayer[] = [
  "L1_structure",
  "L2_usable_content",
  "L3_format_competence",
  "L4_niveau",
  "L5_theme",
  "L6_pedagogie",
  "L7_correction",
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value: unknown): string {
  return stripAccents(String(value ?? "").trim().toLowerCase());
}

function tagIssues(
  issues: Array<{ code: string; severity: "error" | "warning"; message: string; field?: string }>,
  layer: ValidationLayer,
): ChainIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...(issue.field ? { field: issue.field } : {}),
    layer,
  }));
}

function emptyLayerSummary(): ValidationChainResult["layers"] {
  return Object.fromEntries(
    ALL_LAYERS.map((layer) => [layer, { passed: true, issueCount: 0 }]),
  ) as ValidationChainResult["layers"];
}

function summarizeLayers(issues: ChainIssue[]): ValidationChainResult["layers"] {
  const layers = emptyLayerSummary();
  for (const layer of ALL_LAYERS) {
    const layerIssues = issues.filter((i) => i.layer === layer);
    layers[layer] = {
      passed: !layerIssues.some((i) => i.severity === "error"),
      issueCount: layerIssues.length,
    };
  }
  return layers;
}

/** L1 — structure (wrap validateExercise). */
export function runLayerL1Structure(exercise: ExerciseLike): ChainIssue[] {
  const result = validateExercise(exercise);
  return tagIssues(result.issues, "L1_structure");
}

/** L2 — contenu jouable (hasUsableContent + renfort CE/CO). */
export function runLayerL2UsableContent(exercise: ExerciseRow): ChainIssue[] {
  const issues: ChainIssue[] = [];

  if (!hasUsableContent(exercise)) {
    issues.push({
      code: "not_usable_content",
      severity: "error",
      message: "Contenu non jouable (consigne vide ou items manquants)",
      layer: "L2_usable_content",
    });
  }

  const contenu = (exercise.contenu ?? {}) as Record<string, unknown>;
  if (exercise.competence === "CE") {
    const texte = contenu.texte;
    if (!texte || typeof texte !== "string" || texte.trim().length < 20) {
      issues.push({
        code: "missing_ce_text",
        severity: "error",
        message: "CE sans texte support valide",
        field: "contenu.texte",
        layer: "L2_usable_content",
      });
    }
  }

  if (exercise.competence === "CO") {
    const script = contenu.script_audio ?? exercise.script_audio;
    if (!script || typeof script !== "string" || script.trim().length < 10) {
      issues.push({
        code: "missing_audio_script",
        severity: "error",
        message: "CO sans script_audio valide",
        field: "contenu.script_audio",
        layer: "L2_usable_content",
      });
    }
  }

  return issues;
}

/** L3 — format ∈ FORMATS_BY_COMPETENCE. */
export function runLayerL3FormatCompetence(exercise: ExerciseRow): ChainIssue[] {
  const issues: ChainIssue[] = [];
  const competence = exercise.competence ?? "";
  const format = exercise.format ?? "";
  const allowed = formatsAutorisesForCompetence(competence);

  if (competence && format && allowed.length > 0 && !allowed.includes(format)) {
    issues.push({
      code: "EXCL_02_format_competence",
      severity: "error",
      message: `Format "${format}" inadapté à la compétence "${competence}"`,
      field: "format",
      layer: "L3_format_competence",
    });
  }

  return issues;
}

/** L4 — niveau CECRL déterministe. */
export function runLayerL4Niveau(
  exercise: ExerciseRow,
  ctx?: ValidationChainContext,
): ChainIssue[] {
  const issues: ChainIssue[] = [];
  const niveau = String(exercise.niveau_vise ?? "").toUpperCase();

  if (exercise.niveau_vise && !VALID_LEVELS.has(niveau)) {
    issues.push({
      code: "invalid_niveau_vise",
      severity: "error",
      message: `Niveau CECRL invalide: ${exercise.niveau_vise}`,
      field: "niveau_vise",
      layer: "L4_niveau",
    });
  }

  if (niveau === "A0" && exercise.format === "production_ecrite") {
    issues.push({
      code: "EXCL_04_a0_production_ecrite",
      severity: "error",
      message: "Public A0/NSA ne peut pas produire de texte libre",
      field: "format",
      layer: "L4_niveau",
    });
  }

  const target = ctx?.targetNiveauVise;
  if (target && exercise.niveau_vise) {
    const window = niveauWindow(target);
    if (!window.includes(niveau)) {
      issues.push({
        code: "level_doubtful",
        severity: "warning",
        message: `Écart de niveau: exercice ${niveau}, cible ${target} (fenêtre ±1: ${window.join(", ")})`,
        field: "niveau_vise",
        layer: "L4_niveau",
      });
    }
  }

  return issues;
}

/** L5 — thème IRN canonique + flags sensibles. Retourne aussi les flags détectés. */
export function runLayerL5Theme(
  exercise: ExerciseRow,
  ctx?: ValidationChainContext,
): { issues: ChainIssue[]; flags: string[] } {
  const issues: ChainIssue[] = [];
  const flags: string[] = [];
  const rawTheme = exercise.theme;
  const canonical = canonicalizeTheme(rawTheme);
  const canonicalContext = canonicalizeTheme(exercise.contexte_irn);

  if (rawTheme != null && String(rawTheme).trim() !== "" && !canonical) {
    issues.push({
      code: "invalid_theme",
      severity: "error",
      message: `Thème non reconnu: ${rawTheme}`,
      field: "theme",
      layer: "L5_theme",
    });
  }

  const targetTheme = ctx?.targetThemeId;
  if (targetTheme && canonicalizeTheme(targetTheme) && !canonical) {
    issues.push({
      code: "missing_theme",
      severity: "warning",
      message: "Thème absent alors qu'une cible thématique est définie",
      field: "theme",
      layer: "L5_theme",
    });
  }

  if (canonical && canonicalContext && canonical !== canonicalContext) {
    issues.push({
      code: "theme_context_mismatch",
      severity: "warning",
      message: `Thème "${canonical}" ≠ contexte_irn canonique "${canonicalContext}"`,
      field: "theme",
      layer: "L5_theme",
    });
  }

  if (canonical && SENSITIVE_THEMES.has(canonical)) {
    flags.push("sensitive_admin");
  }

  return { issues, flags };
}

/** L6 — pédagogie déterministe (reviewExercise sans IA). */
export async function runLayerL6Pedagogie(
  exercise: ExerciseLike,
  ctx?: ValidationChainContext,
): Promise<ChainIssue[]> {
  const review = await reviewExercise({
    exercise,
    pedagogicalDirectives: ctx?.pedagogicalDirectives ?? null,
    niveau: exercise.niveau_vise ?? ctx?.targetNiveauVise ?? null,
    competence: exercise.competence ?? null,
    useAI: false,
  });

  return tagIssues(review.issues, "L6_pedagogie");
}

function countPlausibleQcmOptions(item: Record<string, unknown>): number {
  const answer = normalizeText(item.bonne_reponse);
  const options = Array.isArray(item.options) ? item.options : [];
  if (!answer) return 0;

  return options.filter((opt) => {
    const n = normalizeText(opt);
    return n === answer || n.includes(answer) || answer.includes(n);
  }).length;
}

/** L7 — correction déterministe (CE dans texte, QCM ambigu, limite mots EE). */
export function runLayerL7Correction(exercise: ExerciseLike): ChainIssue[] {
  const issues: ChainIssue[] = [];
  const contenu = (exercise.contenu ?? {}) as Record<string, unknown>;
  const items = Array.isArray(contenu.items) ? contenu.items : [];
  const texteNorm = normalizeText(contenu.texte);
  const format = String(exercise.format ?? "");

  if (exercise.competence === "CE" && format === "qcm") {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx] as Record<string, unknown>;
      const answers = Array.isArray(item.bonne_reponse)
        ? item.bonne_reponse
        : [item.bonne_reponse];

      for (const answer of answers) {
        const answerNorm = normalizeText(answer);
        if (answerNorm && texteNorm && !texteNorm.includes(answerNorm)) {
          issues.push({
            code: "correction_not_in_text",
            severity: "error",
            message: `Item ${idx + 1}: bonne_reponse absente du texte support`,
            field: `contenu.items.${idx}.bonne_reponse`,
            layer: "L7_correction",
          });
        }
      }
    }
  }

  if (format === "qcm") {
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx] as Record<string, unknown>;
      if (countPlausibleQcmOptions(item) > 1) {
        issues.push({
          code: "ambiguous_correction",
          severity: "warning",
          message: `Item ${idx + 1}: plusieurs options plausibles (match partiel)`,
          field: `contenu.items.${idx}.options`,
          layer: "L7_correction",
        });
      }
    }
  }

  if (exercise.competence === "EE" && format === "production_ecrite") {
    const limite =
      (contenu.limite_mots_max as number | undefined) ??
      (exercise.metadata as Record<string, unknown> | undefined)?.limite_mots_max;
    if (typeof limite === "number" && limite > 90) {
      issues.push({
        code: "EXCL_03_word_limit",
        severity: "warning",
        message: `limite_mots_max=${limite} > 90 (plafond TCF IRN)`,
        field: "contenu.limite_mots_max",
        layer: "L7_correction",
      });
    }
  }

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx] as Record<string, unknown>;
    const explication = item.explication;
    if (typeof explication === "string") {
      const words = explication.trim().split(/\s+/).filter(Boolean).length;
      const niveau = String(exercise.niveau_vise ?? "").toUpperCase();
      if (words > 22 && (niveau === "A0" || niveau === "A1")) {
        issues.push({
          code: "feedback_too_long",
          severity: "warning",
          message: `Item ${idx + 1}: feedback trop long pour A0/A1 (${words} mots)`,
          field: `contenu.items.${idx}.explication`,
          layer: "L7_correction",
        });
      }
    }
  }

  return issues;
}

function dedupeMissingCeTextIssues(issues: ChainIssue[]): ChainIssue[] {
  const hits = issues.filter((i) => i.code === "missing_ce_text");
  if (hits.length <= 1) return issues;
  const keep = hits[0];
  return [...issues.filter((i) => i.code !== "missing_ce_text"), keep];
}

function hasStructuralQcmError(issues: ChainIssue[]): boolean {
  return issues.some(
    (i) => STRUCTURAL_QCM_ERROR_CODES.has(i.code) && i.severity === "error",
  );
}

/** Applique la sévérité effective selon le profil (détection inchangée en amont). */
export function applyProfileSeverity(
  issues: ChainIssue[],
  profile: ValidationProfile,
  exercise: ExerciseRow,
): ChainIssue[] {
  const base =
    profile === "legacy_bank" ? dedupeMissingCeTextIssues(issues) : issues;
  const structuralQcm = hasStructuralQcmError(base);

  return base.map((issue) => {
    if (profile === "generated_strict") {
      return issue;
    }

    let severity = issue.severity;
    switch (issue.code) {
      case "missing_ce_text":
        severity = hasUsableContent(exercise) ? "warning" : "error";
        break;
      case "correction_not_in_text":
        severity = structuralQcm ? "error" : "warning";
        break;
      case "missing_audio_script":
        severity = "warning";
        break;
      default:
        break;
    }

    return severity === issue.severity ? issue : { ...issue, severity };
  });
}

export function hasBlockingChainIssue(issues: ChainIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

export function groupIssuesByCode(issues: ChainIssue[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.code] = (counts[issue.code] ?? 0) + 1;
  }
  return counts;
}

/** Décision statut simulé (Lot 9 — sans L10 scoring). */
export function decideValidationStatus(
  issues: ChainIssue[],
  flags: string[],
): SimulatedValidationStatus {
  if (hasBlockingChainIssue(issues)) return "rejected";

  const warningCodes = new Set(
    issues.filter((i) => i.severity === "warning").map((i) => i.code),
  );

  const hasSensitiveWithWarnings =
    flags.includes("sensitive_admin") &&
    issues.some(
      (i) =>
        i.severity === "warning" &&
        (i.layer === "L5_theme" || i.layer === "L6_pedagogie"),
    );

  if (
    warningCodes.has("ambiguous_correction") ||
    warningCodes.has("level_doubtful") ||
    hasSensitiveWithWarnings ||
    warningCodes.size >= 3
  ) {
    return "needs_review";
  }

  return "validated_auto";
}

/** Point d'entrée principal — pipeline L1–L7 déterministe. */
export async function runValidationChain(
  exercise: ExerciseLike & ExerciseRow,
  options?: ValidationChainOptions,
): Promise<ValidationChainResult> {
  const profile = options?.profile ?? "generated_strict";
  const context = options?.context;
  const issues: ChainIssue[] = [];
  const flags: string[] = [];

  issues.push(...runLayerL1Structure(exercise));
  issues.push(...runLayerL2UsableContent(exercise));
  issues.push(...runLayerL3FormatCompetence(exercise));
  issues.push(...runLayerL4Niveau(exercise, context));

  const l5 = runLayerL5Theme(exercise, context);
  issues.push(...l5.issues);
  flags.push(...l5.flags);

  issues.push(...await runLayerL6Pedagogie(exercise, context));
  issues.push(...runLayerL7Correction(exercise));

  const effectiveIssues = applyProfileSeverity(issues, profile, exercise);
  const status = decideValidationStatus(effectiveIssues, flags);
  const ok = !hasBlockingChainIssue(effectiveIssues);

  return {
    ok,
    status,
    issues: effectiveIssues,
    layers: summarizeLayers(effectiveIssues),
    flags: [...new Set(flags)],
    structuralScore: null,
    checkedAt: new Date().toISOString(),
  };
}
