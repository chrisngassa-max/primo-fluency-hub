export type SliceLevel = "A1" | "A2" | "B1" | "B2";
export type SliceCompetence = "CO";
export type SliceValidationStatus = "pass" | "warning" | "fail" | "not_run";
export type ImplicitPolicy = false | "verifiable_only" | "supported_multi_fact";
export type SliceFormat = "qcm" | "vrai_faux" | "appariement" | "ordre_chronologique" | "mixed";
export type TransformationId =
  | "IDENTITY"
  | "A2_TO_A1"
  | "A2_TO_B1"
  | "A2_TO_B2"
  | "A1_TO_A2"
  | "A1_TO_B1"
  | "A1_TO_B2"
  | "B1_TO_A1"
  | "B1_TO_A2"
  | "B1_TO_B2"
  | "B2_TO_A1"
  | "B2_TO_A2"
  | "B2_TO_B1";

export const SLICE_LEVELS: readonly SliceLevel[] = ["A1", "A2", "B1", "B2"];

export interface FactProvenance {
  source_id: string;
  transcription_id: string;
  segment_refs: string[];
  chunk_refs: string[];
  quote: string;
  confidence?: number | null;
}

export interface DifferentiationFact {
  fact_id: string;
  subject: string;
  predicate: string;
  object: unknown;
  semantic_qualifiers: Record<string, unknown>;
  provenance: FactProvenance;
  required_for_task: boolean;
}

export interface DifferentiationFacts {
  required: DifferentiationFact[];
  facts_hash: string;
}

export interface CoLevelContract {
  target_level: SliceLevel;
  cognitive_operations: string[];
  guidance: "fort" | "moyen" | "faible" | "a_la_demande";
  autonomy: string;
  implicit_allowed: ImplicitPolicy;
  allowed_formats: string[];
  forbidden_formats: string[];
  allowed_distractor_categories: string[];
  volume_items_min: number;
  volume_items_max: number;
  qcm_max_choices?: number;
  audio_policy: {
    max_listens: number;
    transcript: "none" | "available" | "unlockable" | "always";
    target_seconds: number | null;
  };
  success_threshold_pct: number;
  generation_constraints: string[];
  objectives?: string[];
  human_review_dimensions?: HumanReviewDimension[];
}

/** @deprecated Prefer CoLevelContract — kept for A2-era imports. */
export type CoA2LevelContract = CoLevelContract;

export interface ExerciseChoice {
  id: string;
  text: string;
  is_correct: boolean;
  distractor_category?: string;
}

export interface SliceExerciseItem {
  id: string;
  type: Exclude<SliceFormat, "mixed">;
  instruction: string;
  choices?: ExerciseChoice[];
  fact_refs: string[];
  justification: string;
  review_flags?: string[];
  [key: string]: unknown;
}

export interface SliceExercise {
  title: string;
  instruction: string;
  format: SliceFormat;
  steps: string[];
  items: SliceExerciseItem[];
  expected_output: string;
  feedback?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SliceVariant {
  target_level: SliceLevel;
  competence: SliceCompetence;
  transformation_id: TransformationId;
  support_mode: "source" | "annotated" | "segmented" | "excerpted" | "didacticized";
  support_ref: string;
  applied_transformations: Array<Record<string, unknown>>;
  exercise: SliceExercise;
  scaffolding: Record<string, unknown>;
  success_criteria: string[];
}

export type HumanReviewDimension =
  | "distractor_ambiguity"
  | "instruction_cefr_fit"
  | "overall_difficulty"
  | "pedagogical_relevance"
  | "justification_quality"
  | "fact_selection";

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface SliceValidationReport {
  status: SliceValidationStatus;
  blocking: ValidationIssue[];
  warnings: ValidationIssue[];
  requires_human_review: HumanReviewDimension[];
}

export type LevelContractsMap = Partial<Record<SliceLevel, CoLevelContract>>;
export type VariantsMap = Partial<Record<SliceLevel, SliceVariant>>;

export interface DifferentiationFamilySliceV1 {
  schema_version: "slice-1.0";
  family_id: string;
  version: number;
  status: "draft" | "review" | "validated" | "published" | "archived";
  competence: SliceCompetence;
  subcompetence: string;
  objective: string;
  core_task: string;
  /** Pivot audio CapTCF : la source pédagogique reste le pivot A2. */
  source_level: "A2";
  generated_levels: [SliceLevel];
  source_document: {
    source_document_id: string;
    uri: string;
    content_hash: string;
    immutable: true;
    provenance: {
      type: "official" | "curriculum" | "licensed" | "authored";
      version: string | number;
      source_url?: string;
      verified_at?: string | null;
    };
  };
  facts: DifferentiationFacts;
  level_contracts: LevelContractsMap;
  variants: VariantsMap;
  generation?: {
    model_id?: string | null;
    prompt_version?: string | null;
    generated_at?: string | null;
    target_level?: SliceLevel | null;
    referential_version?: string | null;
    support_compatibility?: SupportCompatibilityResult | null;
  } | null;
  validation_report: SliceValidationReport;
}

export interface SupportCompatibilitySignal {
  id: string;
  present: boolean;
  evidence_fact_ids: string[];
}

export interface SupportCompatibilityResult {
  target_level: SliceLevel;
  supported: boolean;
  code: "OK" | "DIFF_TRANSFORMATION_NOT_SUPPORTED";
  message: string;
  signals: SupportCompatibilitySignal[];
}

export interface ValidationContext {
  sourceContentHash: string;
  segmentIds: Iterable<string>;
  chunkIds: Iterable<string>;
  chunkSegmentPairs?: Iterable<string>;
  timestampsVerified?: boolean;
  /** Trainer-reviewed current transcription (`status === reviewed`). `ready` is NOT enough. */
  transcriptionReviewed?: boolean;
  /** pedagogical_sources.status === analyzed */
  sourceAnalyzed?: boolean;
  /** pedagogical_sources.review_status in utilisable|valide */
  sourceReviewApproved?: boolean;
  /** pedagogical_sources.content_hash present (sha256:…). */
  sourceHashPresent?: boolean;
  /** Source hash matches family.source_document.content_hash. */
  sourceHashCoherent?: boolean;
  /** Original MP3 still referenced on the pedagogical source. */
  originalMp3Available?: boolean;
  /** Required facts carry textual segment + chunk provenance. */
  factualProvenancePresent?: boolean;
}

export function getSliceTargetLevel(family: DifferentiationFamilySliceV1): SliceLevel {
  const declared = family.generated_levels?.[0];
  if (declared && family.variants?.[declared]) return declared;
  for (const level of SLICE_LEVELS) {
    if (family.variants?.[level]) return level;
  }
  return "A2";
}

export function getSliceVariant(family: DifferentiationFamilySliceV1): SliceVariant {
  const level = getSliceTargetLevel(family);
  const variant = family.variants[level];
  if (!variant) {
    throw new Error(`SLICE_VARIANT_MISSING:${level}`);
  }
  return variant;
}

export function getSliceContract(family: DifferentiationFamilySliceV1): CoLevelContract {
  const level = getSliceTargetLevel(family);
  const contract = family.level_contracts[level];
  if (!contract) {
    throw new Error(`SLICE_CONTRACT_MISSING:${level}`);
  }
  return contract;
}
