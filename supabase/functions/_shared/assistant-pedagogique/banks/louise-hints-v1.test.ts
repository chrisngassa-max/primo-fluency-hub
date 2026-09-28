import { describe, expect, it, vi } from 'vitest';
import {
  deliverValidatedHint,
  LOUISE_FACTS_HASH,
  LOUISE_HINTS_V1,
  LOUISE_SOURCE_ID,
  findLouiseHintEntry,
  validateHintEntry,
  type HintBankEntry,
  type SealedItemForHints,
} from './index.ts';
import { handlePedagogical, type DataStore } from '../index.ts';
import { devoir, explanation, fixture, learner, pilot } from '../fixtures.ts';

const EXERCISE_A1 = pilot[0][1];
const EXERCISE_A2 = pilot[1][1];
const EXERCISE_B1 = pilot[2][1];
const EXERCISE_B2 = pilot[3][1];

function sealedA1Item01(overrides: Partial<SealedItemForHints> = {}): SealedItemForHints {
  return {
    exercise_id: EXERCISE_A1,
    level: 'A1',
    item_id: 'item_01',
    facts_hash: LOUISE_FACTS_HASH,
    fact_refs: ['fact_01'],
    instruction: "Quel est le sujet principal dont parle l'intervenant ?",
    choices: [
      { id: 'a', text: 'La danse.', is_correct: false },
      { id: 'b', text: 'La musique.', is_correct: true },
      { id: 'c', text: 'Le sport.', is_correct: false },
    ],
    justification: "L'intervenant dit explicitement : 'Le thème d'aujourd'hui sera la musique.'",
    ...overrides,
  };
}

function bankEntry(exerciseId: string, itemId: string): HintBankEntry {
  const base = findLouiseHintEntry(exerciseId, itemId);
  if (!base) throw new Error(`missing bank entry ${itemId}`);
  return structuredClone(base);
}

function draftClone(itemId = 'item_01'): HintBankEntry {
  return {
    ...bankEntry(EXERCISE_A1, itemId),
    review_status: 'draft',
    validated_at: null,
    validator: null,
  };
}

describe('Lot 2A.2 : banque d’indices Louise', () => {
  it('couvre 21 items pilote validés par le propriétaire', () => {
    expect(LOUISE_HINTS_V1).toHaveLength(21);
    expect(LOUISE_HINTS_V1.every((e) => e.review_status === 'validated')).toBe(true);
    expect(LOUISE_HINTS_V1.every((e) => e.validated_at === '2026-09-28' && e.validator === 'propriétaire')).toBe(true);
    expect(LOUISE_HINTS_V1.every((e) => e.source_id === LOUISE_SOURCE_ID && e.facts_hash === LOUISE_FACTS_HASH)).toBe(true);
    expect(LOUISE_HINTS_V1.flatMap((e) => e.hints)).toHaveLength(63);
    const byLevel = { A1: 0, A2: 0, B1: 0, B2: 0 };
    for (const e of LOUISE_HINTS_V1) byLevel[e.level]++;
    expect(byLevel).toEqual({ A1: 4, A2: 6, B1: 6, B2: 5 });
  });

  it('1 entrée draft non servie', () => {
    const r = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
    }, 1, [draftClone()]);
    expect(r.allowed).toBe(false);
    expect(r.text).toBe('Aucun indice validé n’est disponible pour cet exercice.');
    expect(r.projection).toBeNull();
  });

  it('2 entrée validated servie', () => {
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    const r = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
      sealedItem: sealedA1Item01(),
    }, 1);
    expect(r.allowed).toBe(true);
    expect(r.text).toBe(entry.hints[0].text);
    expect(r.projection).toEqual({
      ordinal: 1, text: entry.hints[0].text, bank_id: 'louise-hints-v1', review_status: 'validated',
    });
  });

  it('3 entraînement : ordre 1→2→3', () => {
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    const texts = [1, 2, 3].map((level) => deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
      sealedItem: sealedA1Item01(),
    }, level).text);
    expect(texts).toEqual(entry.hints.map((h) => h.text));
  });

  it('4 devoir : seul indice 1', () => {
    const ok = deliverValidatedHint({
      mode: 'devoir', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
      sealedItem: sealedA1Item01(),
    }, 1);
    expect(ok.allowed).toBe(true);
    const blocked = deliverValidatedHint({
      mode: 'devoir', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
    }, 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.text).toContain('seul l’indice 1');
  });

  it('5 évaluation : aucun indice', () => {
    const r = deliverValidatedHint({
      mode: 'evaluation', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
    }, 1);
    expect(r.allowed).toBe(false);
    expect(r.text).toContain('évaluation');
  });

  it('6 item étranger refusé', () => {
    const r = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_99', factsHash: LOUISE_FACTS_HASH,
    }, 1);
    expect(r.reason).toBe('foreign_item');
  });

  it('7 facts_hash différent refusé', () => {
    const r = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01',
      factsHash: 'sha256:' + 'b'.repeat(64),
    }, 1);
    expect(r.reason).toBe('facts_hash');
  });

  it('8 copie de justification refusée', () => {
    const sealed = sealedA1Item01();
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    entry.hints[0].text = sealed.justification!;
    expect(validateHintEntry(entry, sealed)).toContain('justification_copy');
  });

  it('9 mention explicite de bonne réponse refusée', () => {
    const sealed = sealedA1Item01();
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    entry.hints[1].text = 'La bonne réponse est évidente si tu écoutes bien.';
    expect(validateHintEntry(entry, sealed)).toContain('explicit_answer_phrase');
  });

  it('10 numéro/lettre d’option refusé', () => {
    const sealed = sealedA1Item01();
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    entry.hints[2].text = 'Regarde l’option B attentivement.';
    expect(validateHintEntry(entry, sealed)).toContain('option_letter_or_number');
  });

  it('11 mot discriminant de la bonne option refusé', () => {
    const sealed = sealedA1Item01();
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    entry.hints[0].text = 'Écoute le mot musique au début.';
    expect(validateHintEntry(entry, sealed)).toContain('discriminant_correct_option');
  });

  it('12 indice sans fact_ref refusé', () => {
    const sealed = sealedA1Item01();
    const entry = bankEntry(EXERCISE_A1, 'item_01');
    entry.fact_refs = ['fact_99'];
    expect(validateHintEntry(entry, sealed)).toContain('fact_refs_unanchored');
  });

  it('13 absence de banque = message explicite', () => {
    const r = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
    }, 1, []);
    expect(r.reason).toBe('banque_absente');
    expect(r.text).toBe('Aucun indice validé n’est disponible pour cet exercice.');
  });

  it('14 aucune utilisation de Gemini', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Réseau interdit'));
    try {
      const rows = fixture(0);
      const store: DataStore = {
        async read(table, _columns, filters) {
          return (rows[table] ?? []).filter((row) => Object.entries(filters).every(([k, v]) => row[k] === v));
        },
        insert: vi.fn(async () => undefined),
      };
      const r = await handlePedagogical({
        authUserId: learner,
        body: { exerciseId: EXERCISE_A1, devoirId: devoir, itemIndex: 0, question: 'Donne-moi un indice', aiEnabled: true },
        userStore: store,
        contentStore: store,
      });
      expect(r.aiInvoked).toBe(false);
      expect(r.realAiBlocked).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('15 aucune fuite de correction dans la projection frontend', () => {
    const r = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
      sealedItem: sealedA1Item01(),
    }, 1);
    const payload = JSON.stringify(r.projection);
    expect(payload).not.toContain('musique');
    expect(payload).not.toContain('is_correct');
    expect(payload).not.toContain('justification');
    expect(payload).not.toContain(explanation);
    expect(payload).not.toMatch(/fact_01/);
    expect(r.projection).not.toHaveProperty('choices');
    expect(r.projection).not.toHaveProperty('correct');
  });

  it('projection validated ne contient pas le hash ni les UUID d’exercice', () => {
    const mismatch = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01',
      factsHash: 'sha256:' + 'c'.repeat(64),
      sealedItem: sealedA1Item01(),
    }, 1);
    expect(mismatch.projection).toBeNull();
    const ok = deliverValidatedHint({
      mode: 'entrainement', exerciseId: EXERCISE_A1, itemId: 'item_01', factsHash: LOUISE_FACTS_HASH,
      sealedItem: sealedA1Item01(),
    }, 2);
    const payload = JSON.stringify(ok.projection);
    expect(payload).not.toContain(EXERCISE_A1);
    expect(payload).not.toContain(LOUISE_FACTS_HASH);
  });

  it('A2 item_06 (V/F) ne révèle pas sa valeur', () => {
    const entry = bankEntry(EXERCISE_A2, 'item_06');
    const blob = entry.hints.map((h) => h.text).join(' ').toLowerCase();
    expect(blob).not.toMatch(/\bvrai\b/);
    expect(blob).not.toMatch(/\bfaux\b/);
    expect(blob).not.toContain('espérance de vie');
    expect(entry.hints[1].text).toBe(
      'Repère précisément l’avantage évoqué à la fin et compare-le avec l’affirmation.',
    );
    expect(entry.hints[2].text).toBe(
      'Vérifie si l’affirmation garde le même sens que les paroles, sans utiliser tes connaissances personnelles.',
    );
  });

  it('B1 item_05 ne fournit pas directement l’opinion finale', () => {
    const entry = bankEntry(EXERCISE_B1, 'item_05');
    const blob = entry.hints.map((h) => h.text).join(' ').toLowerCase();
    expect(blob).not.toContain('nécessaire');
    expect(blob).not.toContain('difficile');
    expect(blob).not.toContain('bête noire');
    expect(blob).not.toContain('pénible');
    expect(entry.hints[1].text).toBe('Repère deux idées opposées dans le passage sur le solfège.');
    expect(entry.hints[2].text).toBe('Compare ce que le locuteur ressent avec ce qu’il dit devoir faire.');
  });

  it('B2 item_03 ne fournit pas directement la réponse', () => {
    const entry = bankEntry(EXERCISE_B2, 'item_03');
    const blob = entry.hints.map((h) => h.text).join(' ').toLowerCase();
    expect(blob).not.toContain('contrainte');
    expect(blob).not.toContain('désagréable');
    expect(blob).not.toContain('indispensable');
    expect(blob).not.toContain('bête noire');
    expect(blob).not.toContain('fidèlement');
    expect(entry.hints[1].text).toBe(
      'Repère le changement entre le sentiment exprimé et la suite du raisonnement.',
    );
    expect(entry.hints[2].text).toBe(
      'Reformule séparément ce que le locuteur ressent et ce qu’il estime nécessaire.',
    );
  });

  it('B2 item_04 ne reprend pas le texte de l’option correcte', () => {
    const entry = bankEntry(EXERCISE_B2, 'item_04');
    const blob = entry.hints.map((h) => h.text).join(' ').toLowerCase();
    expect(blob).not.toContain('monter son propre groupe');
    expect(blob).not.toContain('amis');
    expect(blob).not.toContain('famille');
    expect(blob).not.toContain('pratique individuelle');
    expect(entry.hints[1].text).toBe(
      'Distingue ce qui est organisé par d’autres de ce que la personne organise elle-même.',
    );
    expect(entry.hints[2].text).toBe(
      'Pour mesurer l’autonomie, repère qui prend l’initiative et qui choisit les partenaires.',
    );
  });

  it('B2 item_05 ne dit pas explicitement que l’âge n’est pas un obstacle', () => {
    const entry = bankEntry(EXERCISE_B2, 'item_05');
    const blob = entry.hints.map((h) => h.text).join(' ');
    expect(blob.toLowerCase()).not.toContain('n’est pas un obstacle');
    expect(blob.toLowerCase()).not.toContain("n'est pas un obstacle");
    expect(blob.toLowerCase()).not.toContain('peu importe votre âge');
    expect(entry.hints[1].text).toBe(
      'Repère la forme verbale utilisée dans la conclusion pour s’adresser aux auditeurs.',
    );
    expect(entry.hints[2].text).toBe(
      'Compare l’invitation finale avec ce qui a été dit plus tôt sur le moment de commencer.',
    );
  });
});
