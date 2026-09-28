import { MODE_TOOL_MATRIX, type ActivityMode } from '../../assistant-accueil/contract-v1.ts';
import { findLouiseHintEntry, LOUISE_HINTS_V1 } from './louise-hints-v1.ts';
import { validateHintEntry } from './validate-bank.ts';
import {
  HINT_BANK_ID,
  LOUISE_FACTS_HASH,
  type HintBankEntry,
  type HintProjection,
  type SealedItemForHints,
} from './types.ts';

export interface HintDeliveryContext {
  mode: ActivityMode;
  exerciseId: string;
  itemId: string;
  factsHash: string;
  /** Présent uniquement pour contrôles automatiques locaux / tests ; jamais projeté. */
  sealedItem?: SealedItemForHints;
}

export interface HintDeliveryResult {
  allowed: boolean;
  refused: boolean;
  text: string;
  projection: HintProjection | null;
  reason:
    | 'ok'
    | 'evaluation'
    | 'niveau_indice'
    | 'draft_or_unavailable'
    | 'facts_hash'
    | 'foreign_item'
    | 'validation_failed'
    | 'banque_absente';
}

function maxLevel(mode: ActivityMode): number {
  if (mode === 'evaluation') return 0;
  if (mode === 'devoir') return MODE_TOOL_MATRIX.devoir.deliver_validated_hint.maxLevel;
  if (mode === 'entrainement') return MODE_TOOL_MATRIX.entrainement.deliver_validated_hint.maxLevel;
  return 0;
}

function project(entry: HintBankEntry, ordinal: 1 | 2 | 3): HintProjection | null {
  if (entry.review_status !== 'validated') return null;
  const hint = entry.hints.find((h) => h.ordinal === ordinal);
  if (!hint?.text) return null;
  return {
    ordinal,
    text: hint.text,
    bank_id: HINT_BANK_ID,
    review_status: 'validated',
  };
}

/**
 * Sert uniquement les entrées `review_status=validated`.
 * Les entrées draft / rejected / needs_review sont ignorées (comme une banque vide).
 * Aucun fallback justification, choices, scaffolding ou Gemini.
 */
export function deliverValidatedHint(
  context: HintDeliveryContext,
  requestedLevel: number,
  bank: readonly HintBankEntry[] = LOUISE_HINTS_V1,
): HintDeliveryResult {
  if (context.mode === 'evaluation') {
    return {
      allowed: false,
      refused: true,
      text: 'Les indices sont interdits pendant une évaluation.',
      projection: null,
      reason: 'evaluation',
    };
  }
  const max = maxLevel(context.mode);
  if (!Number.isInteger(requestedLevel) || requestedLevel < 1 || requestedLevel > max) {
    return {
      allowed: false,
      refused: true,
      text: context.mode === 'devoir'
        ? 'En devoir, seul l’indice 1 est disponible.'
        : 'Cet indice n’est pas disponible.',
      projection: null,
      reason: 'niveau_indice',
    };
  }
  if (context.factsHash !== LOUISE_FACTS_HASH) {
    return {
      allowed: false,
      refused: true,
      text: 'Aucun indice validé n’est disponible pour cet exercice.',
      projection: null,
      reason: 'facts_hash',
    };
  }
  if (!bank.length) {
    return {
      allowed: false,
      refused: true,
      text: 'Aucun indice validé n’est disponible pour cet exercice.',
      projection: null,
      reason: 'banque_absente',
    };
  }
  const entry = findLouiseHintEntry(context.exerciseId, context.itemId, bank);
  if (!entry) {
    return {
      allowed: false,
      refused: true,
      text: 'Aucun indice validé n’est disponible pour cet exercice.',
      projection: null,
      reason: 'foreign_item',
    };
  }
  if (entry.review_status !== 'validated' || entry.facts_hash !== LOUISE_FACTS_HASH) {
    return {
      allowed: false,
      refused: true,
      text: 'Aucun indice validé n’est disponible pour cet exercice.',
      projection: null,
      reason: 'draft_or_unavailable',
    };
  }
  if (context.sealedItem) {
    const issues = validateHintEntry(entry, context.sealedItem);
    if (issues.length) {
      return {
        allowed: false,
        refused: true,
        text: 'Aucun indice validé n’est disponible pour cet exercice.',
        projection: null,
        reason: 'validation_failed',
      };
    }
  }
  const projection = project(entry, requestedLevel as 1 | 2 | 3);
  if (!projection) {
    return {
      allowed: false,
      refused: true,
      text: 'Aucun indice validé n’est disponible pour cet exercice.',
      projection: null,
      reason: 'draft_or_unavailable',
    };
  }
  return {
    allowed: true,
    refused: false,
    text: projection.text,
    projection,
    reason: 'ok',
  };
}
