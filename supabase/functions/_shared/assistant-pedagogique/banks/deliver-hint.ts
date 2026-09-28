import { DEFAULT_HINT_BANKS, type HintBankRegistration } from './registry.ts';
import { MODE_TOOL_MATRIX, type ActivityMode } from '../../assistant-accueil/contract-v1.ts';
import { HINT_BANK_ID, type HintBankEntry, type HintProjection, type SealedItemForHints } from './types.ts';
import { validateHintEntry } from './validate-bank.ts';

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

const NO_BANK = 'Aucun indice validé n’est disponible pour cet exercice.';

function maxLevel(mode: ActivityMode): number {
  if (mode === 'evaluation') return 0;
  if (mode === 'devoir') return MODE_TOOL_MATRIX.devoir.deliver_validated_hint.maxLevel;
  if (mode === 'entrainement') return MODE_TOOL_MATRIX.entrainement.deliver_validated_hint.maxLevel;
  return 0;
}

function project(entry: HintBankEntry, ordinal: 1 | 2 | 3, bankId: string): HintProjection | null {
  if (entry.review_status !== 'validated') return null;
  const hint = entry.hints.find((h) => h.ordinal === ordinal);
  if (!hint?.text) return null;
  return {
    ordinal,
    text: hint.text,
    bank_id: bankId,
    review_status: 'validated',
  };
}

/**
 * Sert uniquement une entrée `review_status=validated` d’une banque du registre
 * dont l’empreinte correspond à l’exercice chargé.
 * Aucun fallback justification, choices, scaffolding ou Gemini.
 */
export function deliverValidatedHint(
  context: HintDeliveryContext,
  requestedLevel: number,
  registry: readonly HintBankRegistration[] = DEFAULT_HINT_BANKS,
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

  const forExercise = registry.filter(
    (bank) => bank.review_status === 'validated' && bank.exercise_ids.includes(context.exerciseId),
  );
  if (!forExercise.length) {
    return {
      allowed: false,
      refused: true,
      text: NO_BANK,
      projection: null,
      reason: 'banque_absente',
    };
  }
  const bank = forExercise.find((candidate) => candidate.facts_hash === context.factsHash) ?? null;
  if (!bank) {
    return {
      allowed: false,
      refused: true,
      text: NO_BANK,
      projection: null,
      reason: 'facts_hash',
    };
  }

  const entry = bank.findEntry(context.exerciseId, context.itemId);
  if (!entry) {
    return {
      allowed: false,
      refused: true,
      text: NO_BANK,
      projection: null,
      reason: 'foreign_item',
    };
  }
  if (entry.review_status !== 'validated' || entry.facts_hash !== bank.facts_hash) {
    return {
      allowed: false,
      refused: true,
      text: NO_BANK,
      projection: null,
      reason: 'draft_or_unavailable',
    };
  }
  if (context.sealedItem) {
    if (bank.bank_id === HINT_BANK_ID) {
      const issues = validateHintEntry(entry, context.sealedItem);
      if (issues.length) {
        return {
          allowed: false,
          refused: true,
          text: NO_BANK,
          projection: null,
          reason: 'validation_failed',
        };
      }
    } else if (
      context.sealedItem.exercise_id !== entry.exercise_id ||
      context.sealedItem.item_id !== entry.item_id ||
      context.sealedItem.facts_hash !== entry.facts_hash
    ) {
      return {
        allowed: false,
        refused: true,
        text: NO_BANK,
        projection: null,
        reason: 'validation_failed',
      };
    }
  }
  const projection = project(entry, requestedLevel as 1 | 2 | 3, bank.bank_id);
  if (!projection) {
    return {
      allowed: false,
      refused: true,
      text: NO_BANK,
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
