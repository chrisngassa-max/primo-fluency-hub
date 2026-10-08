import { describe, expect, it } from 'vitest';
import { LOUISE_HINTS_V1 } from './louise-hints-v1.ts';
import { PILOT_EXERCISE_IDS } from './types.ts';
import {
  hasUsableValidatedHint,
  inventoryUsableValidatedHints,
  pedagogicalItemId,
} from './usable-validated-hints.ts';

describe('Lot 4.2 — inventaire des aides validées (louise-hints-v1)', () => {
  it('recense les 21 items pilote validés et utilisables', () => {
    const inventory = inventoryUsableValidatedHints();
    expect(inventory).toHaveLength(21);
    expect(inventory.every((row) => row.review_status === 'validated')).toBe(true);
    expect(inventory.every((row) => row.usable)).toBe(true);
    expect(inventory.every((row) => row.origine === 'banque')).toBe(true);
    expect(inventory.every((row) => row.hint_levels === 3)).toBe(true);
    expect(inventory.every((row) => row.sous_competence === null)).toBe(true);
    const byExercise = new Map<string, number>();
    for (const row of inventory) {
      byExercise.set(row.exercise_id, (byExercise.get(row.exercise_id) ?? 0) + 1);
    }
    expect([...byExercise.keys()].sort()).toEqual([...PILOT_EXERCISE_IDS].sort());
    expect(byExercise.get(PILOT_EXERCISE_IDS[0])).toBe(4);
    expect(byExercise.get(PILOT_EXERCISE_IDS[1])).toBe(6);
    expect(byExercise.get(PILOT_EXERCISE_IDS[2])).toBe(6);
    expect(byExercise.get(PILOT_EXERCISE_IDS[3])).toBe(5);
  });

  it('hasUsableValidatedHint : seulement le bon exercice/item', () => {
    const a1 = PILOT_EXERCISE_IDS[0];
    expect(hasUsableValidatedHint(a1, 'item_01')).toBe(true);
    expect(hasUsableValidatedHint(a1, 'item_99')).toBe(false);
    expect(hasUsableValidatedHint('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0101', 'item_01')).toBe(false);
  });

  it('n’expose pas une entrée non validée', () => {
    const draft = {
      ...LOUISE_HINTS_V1[0],
      review_status: 'draft' as const,
      validated_at: null,
      item_id: 'item_draft',
    };
    expect(hasUsableValidatedHint(draft.exercise_id, 'item_draft', [draft])).toBe(false);
    expect(inventoryUsableValidatedHints([draft]).every((row) => row.usable === false)).toBe(true);
  });

  it('pedagogicalItemId suit la convention item_NN', () => {
    expect(pedagogicalItemId(0)).toBe('item_01');
    expect(pedagogicalItemId(5)).toBe('item_06');
    expect(pedagogicalItemId(-1)).toBe('');
  });
});
