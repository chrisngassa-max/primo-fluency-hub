// Fixtures expurgées : structure/niveaux/volumes Louise constatés dans le
// handoff. Textes, élèves et affectations SYNTHÉTIQUES, pas une copie du corrigé.
export const learner = '10000000-0000-4000-8000-000000000001';
export const otherLearner = '10000000-0000-4000-8000-000000000099';
export const session = '20000000-0000-4000-8000-000000000001';
export const devoir = '30000000-0000-4000-8000-000000000001';
export const attempt = '40000000-0000-4000-8000-000000000001';
export const source = '4a0e8321-9ece-42d7-bf76-8825b1e65e79';
export const factsHash = 'sha256:4fd8d5565ba8cedeb8fa0d9bbf20451dece02b4c83157f4303433398ba03f5a5';
/** Exercice publié synthétique — hors Louise, sans banque d’indices. */
export const publishedSynthetic = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0101',
  source: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
  factsHash: `sha256:${'b'.repeat(64)}`,
  contentHash: `sha256:${'c'.repeat(64)}`,
  level: 'A2' as const,
  explanation: 'Justification synthétique publiée : le texte indique clairement le lieu.',
  hintText: 'NE_DOIT_PAS_SERVIR_DE_FALLBACK',
} as const;
export const pilot = [
  ['A1', '62b06150-7942-4c41-bab9-fdba0a4d852c', 4, 3],
  ['A2', '972e14a8-9fe1-4f3d-93d1-9a8280028c91', 6, 2],
  ['B1', 'bcbcef25-7dcf-4e35-97dd-1fb641ab9815', 6, 2],
  ['B2', 'cb06e39a-e914-4729-8ce4-893e7f8faeaf', 5, 2],
] as const;
export const explanation = 'Justification synthétique : repérez le lieu mentionné dans le document.';

/** Item Louise A1/item_01 aligné sur la banque validée (pour tests d’indice). */
export function louiseItem01() {
  return {
    id: 'item_01',
    type: 'qcm',
    instruction: "Quel est le sujet principal dont parle l'intervenant ?",
    choices: [
      { id: 'a', text: 'La danse.', is_correct: false },
      { id: 'b', text: 'La musique.', is_correct: true },
      { id: 'c', text: 'Le sport.', is_correct: false },
    ],
    fact_refs: ['fact_01'],
    justification: "L'intervenant dit explicitement : 'Le thème d'aujourd'hui sera la musique.'",
  };
}

export function fixture(level = 0): Record<string, Record<string, unknown>[]> {
  const [niveau, id, count, listens] = pilot[level];
  const hash = `sha256:${'a'.repeat(64)}`;
  const items = Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`, type: 'qcm', instruction: 'Écoutez le document puis choisissez une réponse.',
    choices: [{ id: 'a', text: 'REPONSE_SECRETE', is_correct: true }, { id: 'b', text: 'Autre lieu', is_correct: false }],
    fact_refs: ['F1'], justification: explanation,
  }));
  return {
    devoirs: [{ id: devoir, eleve_id: learner, exercice_id: id, session_id: session, contexte: 'devoir', statut: 'en_attente' }],
    sessions: [{ id: session, group_id: 'group', titre: 'Séance synthétique', objectifs: 'Comprendre une information orale', training_session_id: 'training' }],
    group_members: [{ group_id: 'group', eleve_id: learner }],
    groups: [{ id: 'group', niveau }], profils_eleves: [{ eleve_id: learner, niveau_co: niveau }],
    training_sessions: [{ id: 'training', code: 'S01' }],
    session_document_links: [{ session_code: 'S01', linked_id: id, linked_type: 'exercise', audience: 'apprenant', eleve_id: learner }],
    session_exercices: [{ session_id: session, exercice_id: id, eleve_id: learner, is_sent: true, bloc: 'core' }],
    test_sessions: [],
    exercices: [{ id, consigne: 'Écoutez le document.', competence: 'CO', niveau_vise: niveau, format: 'qcm', contenu: {
      items, audio: { source_id: source, source_content_hash: hash },
      metadata: { source_id: source, source_content_hash: hash, facts_hash: factsHash, level_contract: { audio_policy: { max_listens: listens } } },
    } }],
    differentiation_families: [{ published_exercise_id: id, source_id: source, source_content_hash: hash, review_status: 'published', payload: { facts: { facts_hash: factsHash }, variants: { [niveau]: { exercise: { instruction: 'Écoutez le document.', items: structuredClone(items) } } } } }],
    pedagogical_sources: [{ id: source, content_hash: hash, status: 'analyzed', review_status: 'valide' }],
    // Remise devoir = table resultats (submit-devoir-result). Pas de source_devoir_id.
    resultats: [{ id: 'resultat-1', devoir_id: devoir, eleve_id: learner, exercice_id: id, created_at: '2026-09-27', correction_released_at: '2026-09-27' }],
    exercise_attempts: [{ id: attempt, learner_id: learner, exercise_id: id, session_id: session, status: 'completed', completed_at: '2026-09-27', correction_released_at: '2026-09-27' }],
    routing_decisions: [{ eleve_id: learner, exercice_id: id, session_id: session, reason_student: 'Continue avec ton prochain devoir.', reason_trainer: 'SECRET_TRAINER', rule_id: 'SECRET_RULE', context_snapshot: { seuil: 80 }, devoir_genere: devoir }],
    session_live_events: [],
  };
}

/** Louise A1 avec item_01 aligné banque — pour servir un indice validé. */
export function louiseHintReadyFixture(): Record<string, Record<string, unknown>[]> {
  const rows = fixture(0);
  const item = louiseItem01();
  const contenu = rows.exercices[0].contenu as { items: unknown[] };
  contenu.items = [item];
  const family = rows.differentiation_families[0];
  const payload = family.payload as { variants: Record<string, { exercise: { items: unknown[] } }> };
  payload.variants.A1.exercise.items = [structuredClone(item)];
  rows.exercices[0].contenu = contenu;
  return rows;
}

/** Exercice publié synthétique hors Louise, sans banque d’indices. */
export function publishedWithoutBankFixture(): Record<string, Record<string, unknown>[]> {
  const id = publishedSynthetic.id;
  const src = publishedSynthetic.source;
  const hash = publishedSynthetic.contentHash;
  const facts = publishedSynthetic.factsHash;
  const niveau = publishedSynthetic.level;
  const items = [{
    id: 'item_01',
    type: 'qcm',
    instruction: 'Lisez le document puis choisissez une réponse.',
    choices: [
      { id: 'a', text: 'OPTION_SECRETE_SYNTH', is_correct: true },
      { id: 'b', text: 'Autre proposition', is_correct: false },
    ],
    fact_refs: ['fact_synth_1'],
    justification: publishedSynthetic.explanation,
  }];
  return {
    devoirs: [{ id: devoir, eleve_id: learner, exercice_id: id, session_id: session, contexte: 'devoir', statut: 'en_attente' }],
    sessions: [{ id: session, group_id: 'group', titre: 'Séance synthétique', objectifs: 'Comprendre un texte court', training_session_id: 'training' }],
    group_members: [{ group_id: 'group', eleve_id: learner }],
    groups: [{ id: 'group', niveau }],
    profils_eleves: [{ eleve_id: learner, niveau_ce: niveau }],
    training_sessions: [{ id: 'training', code: 'S01' }],
    session_document_links: [{ session_code: 'S01', linked_id: id, linked_type: 'exercise', audience: 'apprenant', eleve_id: learner }],
    session_exercices: [{ session_id: session, exercice_id: id, eleve_id: learner, is_sent: true, bloc: 'core' }],
    test_sessions: [],
    exercices: [{
      id, consigne: 'Lisez le document.', competence: 'CE', niveau_vise: niveau, format: 'qcm',
      contenu: {
        items,
        metadata: {
          source_id: src, source_content_hash: hash, facts_hash: facts,
          level_contract: { audio_policy: { max_listens: 1 } },
        },
      },
    }],
    differentiation_families: [{
      published_exercise_id: id, source_id: src, source_content_hash: hash, review_status: 'published',
      payload: {
        facts: { facts_hash: facts },
        variants: { [niveau]: { exercise: { instruction: 'Lisez le document.', items: structuredClone(items) } } },
      },
    }],
    pedagogical_sources: [{ id: src, content_hash: hash, status: 'analyzed', review_status: 'valide' }],
    resultats: [{ id: 'resultat-1', devoir_id: devoir, eleve_id: learner, exercice_id: id, created_at: '2026-09-27', correction_released_at: '2026-09-27' }],
    exercise_attempts: [{ id: attempt, learner_id: learner, exercise_id: id, session_id: session, status: 'completed', completed_at: '2026-09-27', correction_released_at: '2026-09-27' }],
    routing_decisions: [],
    session_live_events: [],
  };
}
