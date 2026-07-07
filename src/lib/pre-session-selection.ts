/**
 * Lot 9 — Sélection pré-séance (logique pure, rapport uniquement).
 * Aucune génération IA, aucune écriture Supabase.
 */

import {
  buildScoringContexts,
  canonicalizeTheme,
  formatsAutorisesForCompetence,
  hasUsableContent,
  mapRowToScoringExercise,
  niveauWindow,
  REUSE_SCORE_MIN,
  scoreCandidateWithTheme,
  type ExerciseRow,
  type SearchTarget,
} from "../../supabase/functions/_shared/exercise-search.ts";

// ─── Constantes stratégie ───────────────────────────────────────────────────

export const NR_MAX_RATIO = 0.3;
export const FRESHNESS_WINDOW_DAYS = 30;

export const P0_CELLS = new Set([
  "B2:CE",
  "A2:Structures",
  "B1:EE",
  "B1:Structures",
  "B2:EE",
  "B2:Structures",
]);

export const SENSITIVE_THEMES = new Set(["prefecture", "vie_citoyenne"]);

const CORRECTION_WARNING_CODES = new Set(["ambiguous_correction", "correction_not_in_text"]);

const L6_CONSIGNE_PREFIX = "consigne_too_long";

export type ValidationStatus =
  | "draft"
  | "validated_auto"
  | "needs_review"
  | "rejected"
  | "approved_human";

export type NrTier = "vert" | "orange" | "rouge";

export type SelectionTier = "P1_validated" | "P2_nr_vert" | "P2_nr_orange";

export type ExclusionCode =
  | "EXCL_VALIDATION_REJECTED"
  | "EXCL_VALIDATION_DRAFT"
  | "EXCL_SCORE_LOW"
  | "EXCL_SCORING"
  | "EXCL_FORMAT"
  | "EXCL_STALE"
  | "EXCL_NR_TIER_ROUGE"
  | "EXCL_NR_THEME_SENSIBLE"
  | "EXCL_ALREADY_LINKED"
  | "EXCL_NOT_USABLE"
  | "EXCL_COMPETENCE"
  | "EXCL_NIVEAU";

export type GenerationReason =
  | "P0_CELL_ZERO_VA"
  | "PARTIAL_GAP"
  | "THEME_ZERO_VA"
  | "FORMAT_ZERO_VA"
  | "ALL_REJECTED_OR_STALE";

export interface ValidationIssueRef {
  code: string;
  severity: "error" | "warning";
  layer?: string;
}

export interface PreSessionCandidate extends ExerciseRow {
  validation_status: ValidationStatus | string;
  validation_issues?: ValidationIssueRef[];
  validation_score?: number | null;
  /** Score search-first pré-calculé (optionnel). */
  search_score?: number | null;
  matched_rules?: string[];
  fresh?: boolean;
  recent_occurrences?: number;
}

export interface PreSessionSelectionParams {
  niveauVise: string;
  competence: string;
  themeId?: string | null;
  quota: number;
  formats?: string[] | null;
  excludeExerciceIds?: string[];
  typeDemarche?: string;
  reuseScoreMin?: number;
}

export interface RetainedExercise {
  exercice_id: string;
  titre: string | null;
  competence: string | null;
  niveau_vise: string | null;
  format: string | null;
  theme: string | null;
  validation_status: string;
  selection_tier: SelectionTier;
  score: number;
  fresh: boolean;
  matched_rules: string[];
  source: "banque" | "banque_needs_review";
}

export interface ExcludedSample {
  exercice_id: string;
  titre: string | null;
  reason: ExclusionCode;
  detail?: string;
}

export interface ExcludedSection {
  counts: Partial<Record<ExclusionCode, number>>;
  samples: ExcludedSample[];
}

export interface RemainingGap {
  cell_key: string;
  requested: number;
  retained_va: number;
  retained_nr: number;
  gap: number;
  is_p0_cell: boolean;
  va_in_bank: number;
  severity: "none" | "partial" | "critical";
}

export interface GenerationNeedSlot {
  competence: string;
  niveau_vise: string;
  gap: number;
  reason: GenerationReason;
}

export interface GenerationNeed {
  required: boolean;
  total_gap: number;
  slots: GenerationNeedSlot[];
  estimated_generation_count: number;
  defer_to_lot8_p0: boolean;
}

export type HumanReviewType =
  | "NR_REPLI_USED"
  | "NR_TIER_ROUGE_SKIPPED"
  | "SENSITIVE_THEME_GAP"
  | "AMBIGUOUS_CORRECTION_NEARBY"
  | "P0_BLOCKING";

export interface HumanReviewItem {
  type: HumanReviewType;
  exercice_id?: string;
  cell_key: string;
  message: string;
  priority: "haute" | "moyenne";
}

export interface PreSessionSelectionReport {
  params: PreSessionSelectionParams;
  retained: RetainedExercise[];
  excluded: ExcludedSection;
  remaining_gaps: RemainingGap[];
  generation_need: GenerationNeed;
  human_review_items: HumanReviewItem[];
  meta: {
    generated_at: string;
    p1_pool: number;
    p2_pool_vert: number;
    p2_pool_orange: number;
    nr_fallback_allowed: boolean;
  };
}

export function cellKey(niveau: string, competence: string): string {
  return `${niveau.toUpperCase()}:${competence}`;
}

export function isP0Cell(niveau: string, competence: string): boolean {
  return P0_CELLS.has(cellKey(niveau, competence));
}

function isL6ConsigneWarning(code: string): boolean {
  return code === "feedback_too_long" || code.startsWith(L6_CONSIGNE_PREFIX);
}

/** Classification tiers NR — alignée docs/pre-session-selection-strategy.md §2.2 */
export function classifyNrTier(
  issues: ValidationIssueRef[] | undefined,
  theme?: string | null,
): NrTier {
  const allIssues = issues ?? [];
  const warnings = allIssues.filter((i) => i.severity === "warning");
  const warningCodes = new Set(warnings.map((w) => w.code));

  if (warningCodes.has("ambiguous_correction") || warningCodes.has("correction_not_in_text")) {
    return "rouge";
  }
  if (warningCodes.has("level_doubtful")) return "rouge";
  if (warnings.length >= 3) return "rouge";

  const canonicalTheme = canonicalizeTheme(theme);
  if (
    canonicalTheme &&
    SENSITIVE_THEMES.has(canonicalTheme) &&
    warnings.some((w) => CORRECTION_WARNING_CODES.has(w.code) || w.layer === "L7_correction")
  ) {
    return "rouge";
  }

  const hasMissingMedia =
    allIssues.some((i) => i.code === "missing_audio_script") ||
    allIssues.some((i) => i.code === "missing_ce_text");

  if (hasMissingMedia && warnings.length <= 2) return "orange";

  const onlyL6Warnings =
    warnings.length > 0 &&
    warnings.every((w) => isL6ConsigneWarning(w.code)) &&
    !warnings.some((w) => CORRECTION_WARNING_CODES.has(w.code));

  if (onlyL6Warnings) return "vert";

  if (hasMissingMedia) return "orange";

  return "rouge";
}

function isNrFallbackBlocked(params: PreSessionSelectionParams, vaInBank: number): boolean {
  const theme = canonicalizeTheme(params.themeId);
  const niveau = params.niveauVise.toUpperCase();
  if (theme === "prefecture" && (niveau === "B1" || niveau === "B2")) return true;
  if (isP0Cell(params.niveauVise, params.competence) && vaInBank === 0) return true;
  return false;
}

function isSensitiveNrUnapproved(candidate: PreSessionCandidate): boolean {
  if (candidate.validation_status === "approved_human") return false;
  if (candidate.validation_status !== "needs_review") return false;
  const theme = canonicalizeTheme(candidate.theme);
  return theme !== null && SENSITIVE_THEMES.has(theme);
}

interface ScoredCandidate {
  row: PreSessionCandidate;
  score: number;
  excluded: boolean;
  exclusionReason?: string;
  matchedRules: string[];
  fresh: boolean;
}

function scoreCandidate(
  row: PreSessionCandidate,
  params: PreSessionSelectionParams,
  reuseScoreMin: number,
): ScoredCandidate {
  const fresh = row.fresh !== false;
  const recentOccurrences = row.recent_occurrences ?? 0;

  if (typeof row.search_score === "number") {
    return {
      row,
      score: row.search_score,
      excluded: row.search_score < reuseScoreMin,
      matchedRules: row.matched_rules ?? [],
      fresh,
    };
  }

  if (typeof row.validation_score === "number") {
    return {
      row,
      score: row.validation_score,
      excluded: row.validation_score < reuseScoreMin,
      matchedRules: row.matched_rules ?? [],
      fresh,
    };
  }

  const target: SearchTarget = {
    competence: params.competence,
    niveauVise: params.niveauVise,
    themeId: params.themeId,
    typeDemarche: params.typeDemarche ?? "titre_sejour",
  };
  const ctx = buildScoringContexts(target);
  const targetThemeId = canonicalizeTheme(params.themeId);
  const result = scoreCandidateWithTheme(
    mapRowToScoringExercise(row, target),
    ctx,
    targetThemeId,
  );

  return {
    row,
    score: result.score,
    excluded: result.excluded || result.score < reuseScoreMin,
    exclusionReason: result.exclusionReason,
    matchedRules: result.matchedRules,
    fresh,
  };
}

function recordExclusion(
  excluded: ExcludedSection,
  reason: ExclusionCode,
  row: PreSessionCandidate,
  detail?: string,
) {
  excluded.counts[reason] = (excluded.counts[reason] ?? 0) + 1;
  const samples = excluded.samples.filter((s) => s.reason === reason);
  if (samples.length < 20) {
    excluded.samples.push({
      exercice_id: row.id,
      titre: row.titre ?? null,
      reason,
      detail,
    });
  }
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate, exactNiveau: string): number {
  const exactA = a.row.niveau_vise?.toUpperCase() === exactNiveau.toUpperCase() ? 1 : 0;
  const exactB = b.row.niveau_vise?.toUpperCase() === exactNiveau.toUpperCase() ? 1 : 0;
  if (exactB !== exactA) return exactB - exactA;
  if (b.score !== a.score) return b.score - a.score;
  return (a.row.recent_occurrences ?? 0) - (b.row.recent_occurrences ?? 0);
}

function buildGenerationNeed(
  params: PreSessionSelectionParams,
  gap: RemainingGap,
  vaEligibleInBank: number,
): GenerationNeed {
  const theme = canonicalizeTheme(params.themeId);
  const niveau = params.niveauVise.toUpperCase();
  const slots: GenerationNeedSlot[] = [];
  let reason: GenerationReason = "PARTIAL_GAP";
  let deferToLot8 = false;

  if (gap.is_p0_cell && gap.va_in_bank === 0) {
    reason = "P0_CELL_ZERO_VA";
    deferToLot8 = true;
  } else if (theme === "prefecture" && (niveau === "B1" || niveau === "B2") && gap.va_in_bank === 0) {
    reason = "THEME_ZERO_VA";
  } else if (gap.gap > 0 && vaEligibleInBank === 0) {
    reason = "ALL_REJECTED_OR_STALE";
  } else if (gap.gap > 0) {
    reason = "PARTIAL_GAP";
  }

  if (gap.gap > 0) {
    slots.push({
      competence: params.competence,
      niveau_vise: params.niveauVise,
      gap: gap.gap,
      reason,
    });
  }

  const totalGap = gap.gap;
  const integral =
    (gap.is_p0_cell && gap.va_in_bank === 0) ||
    (theme === "prefecture" && (niveau === "B1" || niveau === "B2") && gap.va_in_bank === 0);

  return {
    required: totalGap > 0,
    total_gap: totalGap,
    slots,
    estimated_generation_count: integral ? params.quota : totalGap,
    defer_to_lot8_p0: deferToLot8,
  };
}

/**
 * Sélection pré-séance — logique pure sur un pool de candidats déjà chargé.
 */
export function preSessionSelectExercises(
  candidates: PreSessionCandidate[],
  params: PreSessionSelectionParams,
): PreSessionSelectionReport {
  const reuseScoreMin = params.reuseScoreMin ?? REUSE_SCORE_MIN;
  const excludeIds = new Set(params.excludeExerciceIds ?? []);
  const niveaux = new Set(niveauWindow(params.niveauVise).map((n) => n.toUpperCase()));
  const allowedFormats =
    params.formats && params.formats.length > 0
      ? new Set(params.formats)
      : new Set(formatsAutorisesForCompetence(params.competence));

  const excluded: ExcludedSection = { counts: {}, samples: [] };
  const dimensionFiltered: PreSessionCandidate[] = [];

  for (const row of candidates) {
    if (excludeIds.has(row.id)) {
      recordExclusion(excluded, "EXCL_ALREADY_LINKED", row);
      continue;
    }
    if (row.competence !== params.competence) {
      recordExclusion(excluded, "EXCL_COMPETENCE", row);
      continue;
    }
    const niveau = String(row.niveau_vise ?? "").toUpperCase();
    if (!niveaux.has(niveau)) {
      recordExclusion(excluded, "EXCL_NIVEAU", row);
      continue;
    }
    const format = String(row.format ?? "");
    if (format && allowedFormats.size > 0 && !allowedFormats.has(format)) {
      recordExclusion(excluded, "EXCL_FORMAT", row);
      continue;
    }
    if (!hasUsableContent(row)) {
      recordExclusion(excluded, "EXCL_NOT_USABLE", row);
      continue;
    }
    dimensionFiltered.push(row);
  }

  const vaInBank = dimensionFiltered.filter(
    (r) => r.validation_status === "validated_auto" || r.validation_status === "approved_human",
  ).length;

  const nrFallbackAllowed = !isNrFallbackBlocked(params, vaInBank);
  const nrMaxCount = Math.floor(params.quota * NR_MAX_RATIO);

  const p1Pool: ScoredCandidate[] = [];
  const p2VertPool: ScoredCandidate[] = [];
  const p2OrangePool: ScoredCandidate[] = [];
  let nrRougeOnlyAvailable = 0;
  let ambiguousNrNearby = 0;

  for (const row of dimensionFiltered) {
    const status = row.validation_status;

    if (status === "rejected") {
      recordExclusion(excluded, "EXCL_VALIDATION_REJECTED", row);
      continue;
    }
    if (status === "draft") {
      recordExclusion(excluded, "EXCL_VALIDATION_DRAFT", row);
      continue;
    }

    if (status === "needs_review") {
      if (isSensitiveNrUnapproved(row)) {
        recordExclusion(excluded, "EXCL_NR_THEME_SENSIBLE", row);
        continue;
      }
      const tier = classifyNrTier(row.validation_issues, row.theme);
      if (tier === "rouge") {
        recordExclusion(excluded, "EXCL_NR_TIER_ROUGE", row);
        if (vaInBank === 0) nrRougeOnlyAvailable++;
        if (CORRECTION_WARNING_CODES.has(row.validation_issues?.[0]?.code ?? "")) {
          ambiguousNrNearby++;
        }
        for (const issue of row.validation_issues ?? []) {
          if (CORRECTION_WARNING_CODES.has(issue.code)) ambiguousNrNearby++;
        }
        continue;
      }

      const scored = scoreCandidate(row, params, reuseScoreMin);
      if (!scored.fresh) {
        recordExclusion(excluded, "EXCL_STALE", row);
        continue;
      }
      if (scored.excluded) {
        recordExclusion(
          excluded,
          scored.exclusionReason?.startsWith("EXCL_") ? "EXCL_SCORING" : "EXCL_SCORE_LOW",
          row,
          scored.exclusionReason,
        );
        continue;
      }

      if (tier === "vert") p2VertPool.push(scored);
      else p2OrangePool.push(scored);
      continue;
    }

    if (status !== "validated_auto" && status !== "approved_human") {
      recordExclusion(excluded, "EXCL_VALIDATION_DRAFT", row, `statut inconnu: ${status}`);
      continue;
    }

    const scored = scoreCandidate(row, params, reuseScoreMin);
    if (!scored.fresh) {
      recordExclusion(excluded, "EXCL_STALE", row);
      continue;
    }
    if (scored.excluded) {
      recordExclusion(
        excluded,
        scored.exclusionReason?.startsWith("EXCL_") ? "EXCL_SCORING" : "EXCL_SCORE_LOW",
        row,
        scored.exclusionReason,
      );
      continue;
    }
    p1Pool.push(scored);
  }

  p1Pool.sort((a, b) => compareCandidates(a, b, params.niveauVise));
  p2VertPool.sort((a, b) => compareCandidates(a, b, params.niveauVise));
  p2OrangePool.sort((a, b) => compareCandidates(a, b, params.niveauVise));

  const retained: RetainedExercise[] = [];
  const human_review_items: HumanReviewItem[] = [];
  const key = cellKey(params.niveauVise, params.competence);

  for (const scored of p1Pool.slice(0, params.quota)) {
    retained.push({
      exercice_id: scored.row.id,
      titre: scored.row.titre ?? null,
      competence: scored.row.competence ?? null,
      niveau_vise: scored.row.niveau_vise ?? null,
      format: scored.row.format ?? null,
      theme: canonicalizeTheme(scored.row.theme),
      validation_status: scored.row.validation_status,
      selection_tier: "P1_validated",
      score: scored.score,
      fresh: scored.fresh,
      matched_rules: scored.matchedRules,
      source: "banque",
    });
  }

  let gap = params.quota - retained.length;
  let retainedNr = 0;

  if (gap > 0 && nrFallbackAllowed) {
    const nrBudget = Math.min(gap, nrMaxCount);
    const nrSelected: Array<{ scored: ScoredCandidate; tier: SelectionTier }> = [];

    for (const scored of p2VertPool) {
      if (nrSelected.length >= nrBudget) break;
      nrSelected.push({ scored, tier: "P2_nr_vert" });
    }
    for (const scored of p2OrangePool) {
      if (nrSelected.length >= nrBudget) break;
      nrSelected.push({ scored, tier: "P2_nr_orange" });
    }

    for (const { scored, tier } of nrSelected) {
      retained.push({
        exercice_id: scored.row.id,
        titre: scored.row.titre ?? null,
        competence: scored.row.competence ?? null,
        niveau_vise: scored.row.niveau_vise ?? null,
        format: scored.row.format ?? null,
        theme: canonicalizeTheme(scored.row.theme),
        validation_status: scored.row.validation_status,
        selection_tier: tier,
        score: scored.score,
        fresh: scored.fresh,
        matched_rules: scored.matchedRules,
        source: "banque_needs_review",
      });
      retainedNr++;
      human_review_items.push({
        type: "NR_REPLI_USED",
        exercice_id: scored.row.id,
        cell_key: key,
        message: `Exercice NR retenu en repli (${tier})`,
        priority: "moyenne",
      });
    }
    gap = params.quota - retained.length;
  }

  const retainedVa = retained.filter((r) => r.selection_tier === "P1_validated").length;

  let severity: RemainingGap["severity"] = "none";
  if (gap > 0) {
    if (isP0Cell(params.niveauVise, params.competence) || vaInBank === 0) {
      severity = "critical";
    } else {
      severity = "partial";
    }
  }

  const remaining_gaps: RemainingGap[] = [
    {
      cell_key: key,
      requested: params.quota,
      retained_va: retainedVa,
      retained_nr: retainedNr,
      gap,
      is_p0_cell: isP0Cell(params.niveauVise, params.competence),
      va_in_bank: vaInBank,
      severity,
    },
  ];

  const vaEligibleScored = p1Pool.length;
  const generation_need = buildGenerationNeed(params, remaining_gaps[0], vaEligibleScored);

  if (nrRougeOnlyAvailable > 0 && retained.length < params.quota) {
    human_review_items.push({
      type: "NR_TIER_ROUGE_SKIPPED",
      cell_key: key,
      message: "NR tier rouge exclus mais seuls candidats disponibles",
      priority: "haute",
    });
  }

  const theme = canonicalizeTheme(params.themeId);
  if (
    theme &&
    SENSITIVE_THEMES.has(theme) &&
    vaInBank === 0 &&
    retained.length < params.quota
  ) {
    human_review_items.push({
      type: "SENSITIVE_THEME_GAP",
      cell_key: key,
      message: `Thème sensible « ${theme} » sans VA en banque`,
      priority: "haute",
    });
  }

  if (ambiguousNrNearby >= 5) {
    human_review_items.push({
      type: "AMBIGUOUS_CORRECTION_NEARBY",
      cell_key: key,
      message: `Cellule avec ≥ 5 NR ambigus en banque (${ambiguousNrNearby})`,
      priority: "moyenne",
    });
  }

  if (isP0Cell(params.niveauVise, params.competence) && gap > 0) {
    human_review_items.push({
      type: "P0_BLOCKING",
      cell_key: key,
      message: "Séance cible cellule P0 Lot 8 — génération intégrale signalée",
      priority: "haute",
    });
  }

  return {
    params,
    retained,
    excluded,
    remaining_gaps,
    generation_need,
    human_review_items,
    meta: {
      generated_at: new Date().toISOString(),
      p1_pool: p1Pool.length,
      p2_pool_vert: p2VertPool.length,
      p2_pool_orange: p2OrangePool.length,
      nr_fallback_allowed: nrFallbackAllowed,
    },
  };
}
