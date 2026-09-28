import { describe, expect, it, vi } from 'vitest';
import { handlePedagogical, type DataStore } from './index.ts';
import {
  deliverValidatedHint,
  DEFAULT_HINT_BANKS,
  findLouiseHintEntry,
  LOUISE_FACTS_HASH,
  LOUISE_HINT_BANK,
  resolveHintBank,
  type HintBankRegistration,
} from './banks/index.ts';
import {
  devoir,
  learner,
  louiseHintReadyFixture,
  otherLearner,
  publishedSynthetic,
  publishedWithoutBankFixture,
  session,
} from './fixtures.ts';

function storeOf(rows: Record<string, Record<string, unknown>[]>): DataStore {
  return {
    async read(table, _columns, filters) {
      return (rows[table] ?? []).filter((row) => Object.entries(filters).every(([k, v]) => row[k] === v));
    },
    insert: vi.fn(async (table, row) => {
      rows[table] = rows[table] ?? [];
      rows[table].push(row);
    }),
  };
}

function ask(
  rows: Record<string, Record<string, unknown>[]>,
  body: Record<string, unknown>,
  uid = learner,
) {
  const store = storeOf(rows);
  return {
    store,
    result: () => handlePedagogical({ authUserId: uid, body, userStore: store, contentStore: store }),
  };
}

describe('Lot 2A.3 : assistant sur exercices publiés autorisés', () => {
  it('1 Louise publiée + banque correspondante → indice servi', async () => {
    const rows = louiseHintReadyFixture();
    const entry = findLouiseHintEntry(rows.exercices[0].id as string, 'item_01')!;
    const { result } = ask(rows, {
      exerciseId: rows.exercices[0].id,
      devoirId: devoir,
      itemIndex: 0,
      tool: { name: 'deliver_validated_hint', args: { level: 1 } },
      question: 'Donne-moi un indice',
    });
    const r = await result();
    expect(r.refused).toBe(false);
    expect(r.text).toBe(entry.hints[0].text);
    expect(r.aiInvoked).toBe(false);
  });

  it('2 Louise avec facts_hash altéré → banque refusée', async () => {
    const rows = louiseHintReadyFixture();
    const meta = (rows.exercices[0].contenu as { metadata: { facts_hash: string } }).metadata;
    meta.facts_hash = `sha256:${'d'.repeat(64)}`;
    (rows.differentiation_families[0].payload as { facts: { facts_hash: string } }).facts.facts_hash =
      meta.facts_hash;
    const { result } = ask(rows, {
      exerciseId: rows.exercices[0].id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Donne-moi un indice',
    });
    const r = await result();
    // Empreinte incohérente avec la famille OU banque : contexte refusé / indice indisponible.
    expect(r.refused).toBe(true);
    expect(JSON.stringify(r)).not.toContain(entrySafeHint());
  });

  it('3 exercice publié synthétique sans banque → consigne disponible', async () => {
    const rows = publishedWithoutBankFixture();
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Explique la consigne plus simplement',
    });
    const r = await result();
    expect(r.refused).toBe(false);
    expect(r.text).toContain('Lisez le document');
    expect(r.aiInvoked).toBe(false);
  });

  it('4 même exercice sans banque → indice indisponible explicite', async () => {
    const rows = publishedWithoutBankFixture();
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Donne-moi un indice',
    });
    const r = await result();
    expect(r.refused).toBe(true);
    expect(r.text).toBe('Aucun indice validé n’est disponible pour cet exercice.');
    expect(JSON.stringify(r)).not.toContain(publishedSynthetic.explanation);
    expect(JSON.stringify(r)).not.toContain(publishedSynthetic.hintText);
  });

  it('5 exercice sans banque après remise/libération → explication autorisée', async () => {
    const rows = publishedWithoutBankFixture();
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Pourquoi ma réponse est-elle fausse ?',
    });
    const r = await result();
    expect(r.refused).toBe(false);
    expect(r.text).toContain(publishedSynthetic.explanation);
  });

  it('6 exercice sans banque avant remise → explication refusée', async () => {
    const rows = publishedWithoutBankFixture();
    rows.resultats = [];
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Pourquoi ma réponse est-elle fausse ?',
      submitted: true,
    });
    const r = await result();
    expect(r.refused).toBe(true);
    expect(r.text).toContain('après remise et libération');
    expect(JSON.stringify(r)).not.toContain(publishedSynthetic.explanation);
  });

  it('7 exercice non rattaché au devoir → refus', async () => {
    const rows = publishedWithoutBankFixture();
    rows.devoirs[0].exercice_id = '62b06150-7942-4c41-bab9-fdba0a4d852c';
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Explique la consigne plus simplement',
    });
    expect((await result()).refused).toBe(true);
  });

  it('8 exercice non rattaché à la séance → refus', async () => {
    const rows = publishedWithoutBankFixture();
    rows.session_exercices = [];
    rows.session_document_links = [];
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: undefined,
      sessionId: session,
      itemIndex: 0,
      question: 'Explique la consigne plus simplement',
    });
    expect((await result()).refused).toBe(true);
  });

  it('9 exercice d’un autre élève → refus', async () => {
    const rows = publishedWithoutBankFixture();
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Explique la consigne plus simplement',
    }, otherLearner);
    expect((await result()).refused).toBe(true);
  });

  it('10 ancienne variante ou version incohérente → refus', async () => {
    const rows = publishedWithoutBankFixture();
    (rows.exercices[0].contenu as { items: { instruction: string }[] }).items[0].instruction = 'VARIANTE_OBSOLETE';
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      question: 'Explique la consigne plus simplement',
    });
    const r = await result();
    expect(r.refused).toBe(true);
    expect(JSON.stringify(r)).not.toContain('VARIANTE_OBSOLETE');
  });

  it('11 évaluation → indice/replay/explication refusés', async () => {
    const rows = publishedWithoutBankFixture();
    rows.test_sessions = [{ apprenant_id: learner, statut: 'en_cours' }];
    const base = { exerciseId: publishedSynthetic.id, devoirId: devoir, itemIndex: 0 };
    const hint = await ask(rows, { ...base, question: 'Donne-moi un indice' }).result();
    const replay = await ask(rows, { ...base, tool: { name: 'replay_audio_segment' } }).result();
    const explain = await ask(rows, { ...base, question: 'Pourquoi ma réponse est-elle fausse ?' }).result();
    expect(hint.refused).toBe(true);
    expect(hint.text).toMatch(/évaluation/i);
    expect(replay.refused).toBe(true);
    expect(explain.refused).toBe(true);
    expect(JSON.stringify(explain)).not.toContain(publishedSynthetic.explanation);
  });

  it('12 demande Atelier toujours disponible selon la matrice', async () => {
    const rows = publishedWithoutBankFixture();
    const { store, result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: undefined,
      sessionId: session,
      itemIndex: 0,
      question: 'J’ai besoin du professeur',
      category: 'consigne',
      note: 'PII_PRIVEE',
    });
    const r = await result();
    expect(r.refused).toBe(false);
    expect(r.text).toContain('formateur');
    expect(store.insert).toHaveBeenCalled();
    const payload = JSON.stringify((store.insert as ReturnType<typeof vi.fn>).mock.calls[0]);
    expect(payload).not.toContain('PII_PRIVEE');
  });

  it('13 aucune justification utilisée comme fallback d’indice', async () => {
    const rows = publishedWithoutBankFixture();
    const { result } = ask(rows, {
      exerciseId: publishedSynthetic.id,
      devoirId: devoir,
      itemIndex: 0,
      tool: { name: 'deliver_validated_hint', args: { level: 1 } },
      question: 'Donne-moi un indice',
    });
    const r = await result();
    expect(r.refused).toBe(true);
    expect(JSON.stringify(r)).not.toContain(publishedSynthetic.explanation);
    expect(JSON.stringify(r)).not.toContain('OPTION_SECRETE_SYNTH');
  });

  it('14 aucune invocation Gemini', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Réseau interdit'));
    try {
      const rows = publishedWithoutBankFixture();
      const r = await ask(rows, {
        exerciseId: publishedSynthetic.id,
        devoirId: devoir,
        itemIndex: 0,
        question: 'Explique la consigne plus simplement',
        aiEnabled: true,
      }).result();
      expect(r.aiInvoked).toBe(false);
      expect(r.realAiBlocked).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('15 ajout d’une seconde banque synthétique via le registre sans modifier l’orchestrateur', () => {
    const synthEntry = {
      bank_id: 'synth-hints-test-v1',
      source_id: publishedSynthetic.source,
      facts_hash: publishedSynthetic.factsHash,
      exercise_id: publishedSynthetic.id,
      level: 'A2' as const,
      item_id: 'item_01',
      review_status: 'validated' as const,
      hints: [
        { ordinal: 1 as const, text: 'Repère le lieu nommé dans le premier paragraphe.' },
        { ordinal: 2 as const, text: 'Compare ce lieu avec les propositions.' },
        { ordinal: 3 as const, text: 'Retiens le lieu explicitement cité.' },
      ],
      fact_refs: ['fact_synth_1'],
      authored_at: '2026-09-28T00:00:00.000Z',
      validated_at: '2026-09-28',
      validator: 'test',
      contract_version: 'synth-hints-test-v1',
    };
    const secondBank: HintBankRegistration = {
      bank_id: 'synth-hints-test-v1',
      contract_version: 'synth-hints-test-v1',
      source_id: publishedSynthetic.source,
      facts_hash: publishedSynthetic.factsHash,
      review_status: 'validated',
      exercise_ids: [publishedSynthetic.id],
      entries: [synthEntry],
      findEntry: (exerciseId, itemId) =>
        exerciseId === publishedSynthetic.id && itemId === 'item_01' ? synthEntry : undefined,
    };
    const registry = [...DEFAULT_HINT_BANKS, secondBank];
    expect(resolveHintBank(publishedSynthetic.id, publishedSynthetic.factsHash, DEFAULT_HINT_BANKS)).toBeNull();
    expect(resolveHintBank(publishedSynthetic.id, publishedSynthetic.factsHash, registry)?.bank_id).toBe(
      'synth-hints-test-v1',
    );
    expect(LOUISE_HINT_BANK.bank_id).toBe('louise-hints-v1');
    const delivered = deliverValidatedHint({
      mode: 'entrainement',
      exerciseId: publishedSynthetic.id,
      itemId: 'item_01',
      factsHash: publishedSynthetic.factsHash,
      sealedItem: {
        exercise_id: publishedSynthetic.id,
        level: 'A2',
        item_id: 'item_01',
        facts_hash: publishedSynthetic.factsHash,
        fact_refs: ['fact_synth_1'],
        choices: [
          { id: 'a', text: 'OPTION_SECRETE_SYNTH', is_correct: true },
          { id: 'b', text: 'Autre proposition', is_correct: false },
        ],
        justification: publishedSynthetic.explanation,
      },
    }, 1, registry);
    expect(delivered.allowed).toBe(true);
    expect(delivered.text).toBe(synthEntry.hints[0].text);
    expect(delivered.projection?.bank_id).toBe('synth-hints-test-v1');
    // Sans toucher à l’orchestrateur : la banque Louise reste résolue seule.
    expect(resolveHintBank(LOUISE_HINT_BANK.exercise_ids[0], LOUISE_FACTS_HASH)?.bank_id).toBe('louise-hints-v1');
  });
});

function entrySafeHint(): string {
  return findLouiseHintEntry('62b06150-7942-4c41-bab9-fdba0a4d852c', 'item_01')!.hints[0].text;
}
