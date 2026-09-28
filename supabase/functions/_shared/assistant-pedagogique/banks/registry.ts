import {
  HINT_BANK_ID,
  HINT_CONTRACT_VERSION,
  LOUISE_FACTS_HASH,
  LOUISE_SOURCE_ID,
  PILOT_EXERCISE_IDS,
  type HintBankEntry,
} from './types.ts';
import { findLouiseHintEntry, LOUISE_HINTS_V1 } from './louise-hints-v1.ts';

/**
 * Registre générique des banques d’indices.
 * L’orchestrateur ne connaît que cette résolution — pas Louise en dur.
 */
export interface HintBankRegistration {
  bank_id: string;
  contract_version: string;
  source_id: string;
  facts_hash: string;
  review_status: 'validated';
  exercise_ids: readonly string[];
  entries: readonly HintBankEntry[];
  findEntry(exerciseId: string, itemId: string): HintBankEntry | undefined;
}

export const LOUISE_HINT_BANK: HintBankRegistration = {
  bank_id: HINT_BANK_ID,
  contract_version: HINT_CONTRACT_VERSION,
  source_id: LOUISE_SOURCE_ID,
  facts_hash: LOUISE_FACTS_HASH,
  review_status: 'validated',
  exercise_ids: PILOT_EXERCISE_IDS,
  entries: LOUISE_HINTS_V1,
  findEntry(exerciseId, itemId) {
    return findLouiseHintEntry(exerciseId, itemId) ?? undefined;
  },
};

/** Banques actives en production pour ce lot : Louise uniquement. */
export const DEFAULT_HINT_BANKS: readonly HintBankRegistration[] = [LOUISE_HINT_BANK];

/**
 * Résout une banque validée pour un exercice + empreinte.
 * Retourne null si aucune banque ne correspond (indices indisponibles, reste de l’aide OK).
 */
export function resolveHintBank(
  exerciseId: string,
  factsHash: string,
  registry: readonly HintBankRegistration[] = DEFAULT_HINT_BANKS,
): HintBankRegistration | null {
  if (!exerciseId || !factsHash) return null;
  const match = registry.find(
    (bank) =>
      bank.review_status === 'validated' &&
      bank.facts_hash === factsHash &&
      bank.exercise_ids.includes(exerciseId),
  );
  return match ?? null;
}
