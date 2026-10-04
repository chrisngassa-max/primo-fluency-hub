/** Contrat banque d’indices pédagogiques Louise (lot 2A.2). */

export const HINT_BANK_ID = 'louise-hints-v1' as const;
export const HINT_CONTRACT_VERSION = 'louise-hints-v1' as const;
export const LOUISE_SOURCE_ID = '4a0e8321-9ece-42d7-bf76-8825b1e65e79' as const;
export const LOUISE_FACTS_HASH =
  'sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5' as const;

export const PILOT_EXERCISE_IDS = [
  '62b06150-7942-4c41-bab9-fdba0a4d852c',
  '972e14a8-9fe1-4f3d-93d1-9a8280028c91',
  'bcbcef25-7dcf-4e35-97dd-1fb641ab9815',
  'cb06e39a-e914-4729-8ce4-893e7f8faeaf',
] as const;

export type HintReviewStatus = 'draft' | 'validated' | 'rejected' | 'needs_review';
export type PilotLevel = 'A1' | 'A2' | 'B1' | 'B2';

export interface HintOrdinal {
  ordinal: 1 | 2 | 3;
  text: string;
}

export interface HintBankEntry {
  /** Identifiant de banque (ex. louise-hints-v1). Ouvert pour registres futurs. */
  bank_id: string;
  source_id: string;
  facts_hash: string;
  exercise_id: string;
  level: PilotLevel;
  item_id: string;
  review_status: HintReviewStatus;
  hints: HintOrdinal[];
  fact_refs: string[];
  authored_at: string;
  validated_at: string | null;
  validator: string | null;
  contract_version: string;
}

/** Métadonnées scellées nécessaires au validateur (jamais servies au frontend). */
export interface SealedItemForHints {
  exercise_id: string;
  level: PilotLevel;
  item_id: string;
  facts_hash: string;
  fact_refs: string[];
  instruction?: string;
  choices: Array<{ id: string; text: string; is_correct: boolean }>;
  justification: string | null;
}

export interface HintProjection {
  ordinal: 1 | 2 | 3;
  text: string;
  bank_id: string;
  review_status: 'validated';
}

export type HintValidationIssue =
  | 'hint_count'
  | 'ordinal_missing_or_duplicate'
  | 'status_unknown'
  | 'facts_hash_mismatch'
  | 'exercise_or_item_out_of_pilot'
  | 'hint_empty_or_too_long'
  | 'option_letter_or_number'
  | 'explicit_answer_phrase'
  | 'justification_copy'
  | 'discriminant_correct_option'
  | 'eliminated_option_reference'
  | 'fact_refs_unanchored';
