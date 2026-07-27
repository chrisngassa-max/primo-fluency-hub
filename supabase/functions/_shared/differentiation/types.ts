export type SliceLevel = "A2";
export type SliceCompetence = "CO";
export type SliceValidationStatus = "pass" | "warning" | "fail" | "not_run";

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

export interface CoA2LevelContract {
  target_level: SliceLevel;
  cognitive_operations: string[];
  guidance: "moyen";
  autonomy: "moyenne";
  implicit_allowed: false;
  allowed_formats: string[];
  forbidden_formats: string[];
  allowed_distractor_categories: string[];
  volume_items_min: number;
  volume_items_max: number;
  audio_policy: {
    max_listens: number;
    transcript: "none" | "available" | "unlockable" | "always";
    target_seconds: number | null;
  };
  success_threshold_pct: number;
  generation_constraints: string[];
  human_review_dimensions?: HumanReviewDimension[];
}

export interface ExerciseChoice {
  id: string;
  text: string;
  is_correct: boolean;
  distractor_category?: string;
}

export interface SliceExerciseItem {
  id: string;
  type: "qcm" | "vrai_faux" | "appariement";
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
  format: "qcm" | "vrai_faux" | "appariement" | "mixed";
  steps: string[];
  items: SliceExerciseItem[];
  expected_output: string;
  feedback?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SliceVariant {
  target_level: SliceLevel;
  competence: SliceCompetence;
  transformation_id: "IDENTITY";
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

export interface DifferentiationFamilySliceV1 {
  schema_version: "slice-1.0";
  family_id: string;
  version: number;
  status: "draft" | "review" | "validated" | "published" | "archived";
  competence: SliceCompetence;
  subcompetence: string;
  objective: string;
  core_task: string;
  source_level: SliceLevel;
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
  level_contracts: { A2: CoA2LevelContract };
  variants: { A2: SliceVariant };
  generation?: {
    model_id?: string | null;
    prompt_version?: string | null;
    generated_at?: string | null;
  } | null;
  validation_report: SliceValidationReport;
}

export interface ValidationContext {
  sourceContentHash: string;
  segmentIds: Iterable<string>;
  chunkIds: Iterable<string>;
}
