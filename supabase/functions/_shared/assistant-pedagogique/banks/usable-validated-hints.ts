/**
 * Inventaire et accès local aux aides déjà validées (Lot 4).
 * Aucune génération, aucune generation_directe.
 */
import { LOUISE_HINTS_V1 } from './louise-hints-v1.ts';
import {
  HINT_BANK_ID,
  HINT_CONTRACT_VERSION,
  LOUISE_FACTS_HASH,
  PILOT_EXERCISE_IDS,
  type HintBankEntry,
} from './types.ts';

export type UsableValidatedHintSummary = {
  bank_id: string;
  exercise_id: string;
  item_id: string;
  level: HintBankEntry['level'];
  /** Non portée par la banque ; résolue au runtime via exercices.sous_competence. */
  sous_competence: null;
  review_status: HintBankEntry['review_status'];
  origine: 'banque';
  contenu_version: string;
  contract_version: string;
  usable: boolean;
  hint_levels: number;
};

function hasUsableText(entry: HintBankEntry): boolean {
  return entry.review_status === 'validated'
    && entry.hints.some((hint) => typeof hint.text === 'string' && hint.text.trim().length > 0);
}

/** Inventaire prioritaire : banque Louise pilote (parcours actifs A1–B2). */
export function inventoryUsableValidatedHints(
  bank: readonly HintBankEntry[] = LOUISE_HINTS_V1,
): UsableValidatedHintSummary[] {
  return bank
    .filter((entry) => (PILOT_EXERCISE_IDS as readonly string[]).includes(entry.exercise_id))
    .map((entry) => ({
      bank_id: entry.bank_id || HINT_BANK_ID,
      exercise_id: entry.exercise_id,
      item_id: entry.item_id,
      level: entry.level,
      sous_competence: null,
      review_status: entry.review_status,
      origine: 'banque' as const,
      contenu_version: entry.facts_hash || LOUISE_FACTS_HASH,
      contract_version: entry.contract_version || HINT_CONTRACT_VERSION,
      usable: hasUsableText(entry),
      hint_levels: entry.hints.filter((h) => h.text?.trim()).length,
    }));
}

/** itemIndex 0 → item_01 (convention banque Louise). */
export function pedagogicalItemId(itemIndex: number): string {
  if (!Number.isInteger(itemIndex) || itemIndex < 0) return '';
  return `item_${String(itemIndex + 1).padStart(2, '0')}`;
}

/** True seulement si une entrée validée avec texte utilisable existe pour cet exercice/item. */
export function hasUsableValidatedHint(
  exerciseId: string,
  itemId: string,
  bank: readonly HintBankEntry[] = LOUISE_HINTS_V1,
): boolean {
  if (!exerciseId || !itemId) return false;
  const entry = bank.find((row) => row.exercise_id === exerciseId && row.item_id === itemId);
  return entry ? hasUsableText(entry) : false;
}
