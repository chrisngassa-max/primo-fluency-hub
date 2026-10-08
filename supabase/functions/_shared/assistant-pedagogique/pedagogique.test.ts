import { describe, expect, it, vi } from 'vitest';
import { handlePedagogical, type DataStore } from './index';
import { fixture, learner, otherLearner, devoir, nextDevoir, foreignDevoir, session, attempt, pilot, explanation, louiseHintReadyFixture } from './fixtures';
import { PRESENTED_HINT_KIND } from './help-trace';

function setup(level = 0) {
  const rows = fixture(level);
  const store: DataStore = {
    async read(table, _columns, filters) {
      return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
    },
    insert: vi.fn(async (table, row) => { rows[table].push(row); }),
  };
  const body = { exerciseId: pilot[level][1], devoirId: devoir, itemIndex: 0, question: 'Explique la consigne plus simplement' };
  return { rows, store, body, ask: (patch = {}, uid = learner) => handlePedagogical({ authUserId: uid, body: { ...body, ...patch }, userStore: store, contentStore: store }) };
}

function linkAssignedHomework(
  rows: Record<string, Record<string, unknown>[]>,
  params: {
    devoirId: string;
    exerciceId: string;
    eleveId?: string;
    statut?: string;
    devoirGenere?: string;
    reasonStudent?: string;
    snapshot?: Record<string, unknown> | null;
  },
) {
  rows.devoirs.push({
    id: params.devoirId,
    eleve_id: params.eleveId ?? learner,
    exercice_id: params.exerciceId,
    session_id: session,
    contexte: 'devoir',
    statut: params.statut ?? 'en_attente',
  });
  rows.routing_decisions = [{
    eleve_id: learner,
    exercice_id: params.exerciceId,
    session_id: session,
    reason_student: params.reasonStudent ?? 'Continue avec ton prochain devoir.',
    reason_trainer: 'SECRET_TRAINER',
    rule_id: 'SECRET_RULE',
    devoir_genere: params.devoirGenere ?? 'exo_guide_meme_niveau_outils_aide_fournis',
    context_snapshot: params.snapshot === undefined ? { devoir_id: params.devoirId } : params.snapshot,
  }];
}

describe('Lot 2A : décisions serveur Louise sans modèle', () => {
  it('1 refuse un autre élève et une tentative de séance étrangère', async () => {
    const s = setup(); expect((await s.ask({}, 'other')).refused).toBe(true);
    const foreign = setup();
    expect((await foreign.ask({
      devoirId: undefined, sessionId: session, attemptId: attempt, question: 'Pourquoi ma réponse est-elle fausse ?',
    }, 'other')).refused).toBe(true);
    const noMembership = setup(); noMembership.rows.group_members = [];
    expect((await noMembership.ask({ devoirId: undefined, sessionId: session })).refused).toBe(true);
    expect(noMembership.store.insert).not.toHaveBeenCalled();
  });
  it('2 ignore les textes et compteurs falsifiés du navigateur', async () => {
    const s = setup(); const result = await s.ask({ instruction: 'FAUX', justification: 'FAUX', indices: 99, submitted: true });
    expect(result.text).toContain('Écoutez'); expect(JSON.stringify(result)).not.toContain('FAUX');
  });
  it('3 recharge le mode, notamment une évaluation active', async () => {
    const s = setup(); s.rows.test_sessions.push({ apprenant_id: learner, statut: 'en_cours' });
    const r = await s.ask({ mode: 'entrainement', question: 'Puis-je réécouter ?' });
    expect(r.refused).toBe(true); expect(r.externalContext?.mode).toBe('evaluation');
  });
  it('4 projection externe sans PII, UUID, question libre ou correction', async () => {
    const s = setup(); const r = await s.ask({ question: `Explique pour Alice alice@example.test ${learner}`, nom: 'Alice' });
    const payload = JSON.stringify(r.externalContext);
    for (const secret of [learner, devoir, session, attempt, 'Alice', '@', 'REPONSE_SECRETE', explanation]) expect(payload).not.toContain(secret);
  });
  it('5 consigne simplifiée sans bonne réponse sur les quatre variantes', async () => {
    for (let n = 0; n < 4; n++) { const r = await setup(n).ask(); expect(r.refused).toBe(false); expect(r.text).toContain('une réponse'); expect(JSON.stringify(r)).not.toContain('REPONSE_SECRETE'); }
  });
  it('6 restitue la compétence réelle', async () => {
    expect((await setup().ask({ question: 'Quelle compétence est travaillée ?', competence: 'EO' })).text).toContain('compréhension orale');
  });
  it('7 justification absente avant remise malgré déclaration client', async () => {
    const s = setup(); s.rows.resultats = [];
    const r = await s.ask({ question: 'Pourquoi ma réponse est-elle fausse ?', submitted: true });
    expect(r.refused).toBe(true); expect(JSON.stringify(r)).not.toContain(explanation);
  });
  it('8 justification absente si correction non libérée', async () => {
    const s = setup(); s.rows.resultats[0].correction_released_at = null;
    const r = await s.ask({ question: 'Pourquoi ma réponse est-elle fausse ?' });
    expect(r.refused).toBe(true); expect(JSON.stringify(r)).not.toContain(explanation);
  });
  it('9 explication après remise autorisée, sans exposer les autres items', async () => {
    const r = await setup().ask({ question: 'Pourquoi ma réponse est-elle fausse ?' });
    expect(r.refused).toBe(false); expect(r.text).toContain(explanation); expect(r.externalContext).not.toHaveProperty('justification');
    const changed = setup();
    (changed.rows.exercices[0].contenu as { items: { justification: string }[] }).items[0].justification = 'CORRECTION_NON_VALIDEE';
    const denied = await changed.ask({ question: 'Pourquoi ma réponse est-elle fausse ?' });
    expect(denied.refused).toBe(true); expect(JSON.stringify(denied)).not.toContain('CORRECTION_NON_VALIDEE');
  });
  it('10 explication refusée en évaluation', async () => {
    const s = setup(); s.rows.devoirs[0].contexte = 'evaluation';
    const r = await s.ask({ question: 'Pourquoi ma réponse est-elle fausse ?' }); expect(r.refused).toBe(true); expect(JSON.stringify(r)).not.toContain(explanation);
  });
  it('11 indice absent : message explicite et aucune écriture', async () => {
    const s = setup(); const r = await s.ask({ question: 'Donne-moi un indice' });
    expect(r.text).toBe('Aucun indice validé n’est disponible pour cet exercice.'); expect(s.store.insert).not.toHaveBeenCalled();
  });
  it('12 une justification libérée ne devient jamais un indice', async () => {
    const r = await setup().ask({ tool: { name: 'deliver_validated_hint', args: { level: 3 } } });
    expect(JSON.stringify(r)).not.toContain(explanation); expect(r.tool?.name).toBe('deliver_validated_hint');
  });
  it('13 replay refusé en évaluation, aucune écriture', async () => {
    const s = setup(); s.rows.devoirs[0].contexte = 'evaluation';
    const r = await s.ask({ tool: { name: 'replay_audio_segment' } }); expect(r.refused).toBe(true); expect(s.store.insert).not.toHaveBeenCalled();
  });
  it('14 replay entraînement/devoir décrit le contrat client_existing', async () => {
    for (let n = 0; n < 4; n++) {
      const s = setup(n); const r = await s.ask({ devoirId: undefined, sessionId: session, question: 'Puis-je réécouter ?' });
      expect(r.enforcement).toBe('client_existing'); expect(r.text).toContain(String(pilot[n][3])); expect(r).not.toHaveProperty('audio_url');
    }
  });
  it('15 recommandation venant du routage, après remise seulement en devoir', async () => {
    const s = setup();
    linkAssignedHomework(s.rows, {
      devoirId: nextDevoir,
      exerciceId: String(s.rows.devoirs[0].exercice_id),
      devoirGenere: 'exo_guide_meme_niveau_outils_aide_fournis',
      reasonStudent: 'Continue avec ton prochain devoir.',
    });
    const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.text).toContain('Continue avec ton prochain devoir.');
    expect(r.tool?.route).toBe(`/eleve/devoirs/${nextDevoir}`);
    s.rows.resultats = [];
    expect((await s.ask({ question: 'Que dois-je faire ensuite ?' })).refused).toBe(true);
  });
  it('16 aucune donnée interne du routage ou route arbitraire exposée', async () => {
    const s = setup(); const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(JSON.stringify(r)).not.toMatch(/SECRET|rule_id|seuil|context_snapshot/);
    expect((await s.ask({ tool: { name: 'open_route', args: { route: '/formateur' } } })).refused).toBe(true);
    expect((await s.ask({ devoirId: undefined, sessionId: session, tool: { name: 'open_route', args: { route: '/eleve/devoirs/null' } } })).refused).toBe(true);
  });
  it('17 signal Atelier autorisé, sans texte ni compteur client', async () => {
    const s = setup(); const r = await s.ask({ question: 'J’ai besoin du professeur', category: 'consigne', hintCount: 99, note: 'PII_PRIVEE' });
    expect(r.refused).toBe(false); expect(s.store.insert).toHaveBeenCalledOnce();
    const event = s.rows.session_live_events[0]; expect(event.event_type).toBe('aide_demandee'); expect(event.eleve_id).toBe(learner);
    expect(JSON.stringify(event)).not.toMatch(/PII_PRIVEE|99/);
    const evaluation = setup(); evaluation.rows.devoirs[0].contexte = 'evaluation';
    expect((await evaluation.ask({ question: 'J’ai besoin du professeur' })).refused).toBe(true);
    expect(evaluation.store.insert).not.toHaveBeenCalled();
    expect((await evaluation.ask({ question: 'J’ai besoin du professeur', category: 'technique' })).refused).toBe(false);
  });
  it('18 Gemini OFF : aucun réseau modèle pour les décisions et refus', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Réseau interdit'));
    try { for (const question of ['Explique la consigne', 'Donne-moi un indice', 'Question inconnue']) {
      const r = await setup().ask({ question, aiEnabled: true }); expect(r.aiInvoked).toBe(false); expect(r.realAiBlocked).toBe(true);
    } expect(fetchSpy).not.toHaveBeenCalled(); } finally { fetchSpy.mockRestore(); }
  });
  it('19 devoir : rattachement via resultats, sans exercise_assignments', async () => {
    const s = setup();
    const read = vi.spyOn(s.store, 'read');
    const before = await s.ask({ question: 'Pourquoi ma réponse est-elle fausse ?' });
    expect(before.refused).toBe(false);
    expect(read.mock.calls.some(([table]) => table === 'resultats')).toBe(true);
    expect(read.mock.calls.some(([table]) => table === 'exercise_assignments')).toBe(false);
    expect(JSON.stringify(read.mock.calls)).not.toContain('source_devoir_id');
  });
  it('20 devoir : résultat d’un autre élève ne libère pas la correction', async () => {
    const s = setup();
    s.rows.resultats[0].eleve_id = 'other';
    const r = await s.ask({ question: 'Pourquoi ma réponse est-elle fausse ?', submitted: true, correctionReleased: true });
    expect(r.refused).toBe(true);
    expect(JSON.stringify(r)).not.toContain(explanation);
  });
  it('21 Lot 1 : devoir actif + exercice + décision liée via snapshot.devoir_id', async () => {
    const s = setup();
    const exerciceId = String(s.rows.devoirs[0].exercice_id);
    linkAssignedHomework(s.rows, {
      devoirId: nextDevoir,
      exerciceId,
      devoirGenere: 'exo_guide_meme_niveau_outils_aide_fournis',
      reasonStudent: 'Reprends la compréhension orale avec un exercice guidé.',
    });
    const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.refused).toBe(false);
    expect(r.aiInvoked).toBe(false);
    expect(r.tool?.route).toBe(`/eleve/devoirs/${nextDevoir}`);
    expect(r.text).toContain('Reprends la compréhension orale avec un exercice guidé.');
    expect(r.text).not.toContain('exo_guide_meme_niveau_outils_aide_fournis');
  });
  it('22 Lot 1 : devoir_genere libellé n’est jamais traité comme UUID', async () => {
    const s = setup();
    const exerciceId = String(s.rows.devoirs[0].exercice_id);
    linkAssignedHomework(s.rows, {
      devoirId: nextDevoir,
      exerciceId,
      devoirGenere: devoir,
      snapshot: { devoir_id: nextDevoir },
      reasonStudent: 'Voici le devoir déjà attribué.',
    });
    const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.tool?.route).toBe(`/eleve/devoirs/${nextDevoir}`);
    expect(r.tool?.route).not.toBe(`/eleve/devoirs/${devoir}`);
    s.rows.routing_decisions[0].context_snapshot = {};
    s.rows.routing_decisions[0].devoir_genere = 'exo_guide_meme_niveau_outils_aide_fournis';
    const denied = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(denied.refused).toBe(true);
    expect(denied.tool?.route).toBeUndefined();
    expect(JSON.stringify(denied)).not.toContain(nextDevoir);
  });
  it('23 Lot 1 : devoir expiré exclu des propositions actives', async () => {
    const s = setup();
    linkAssignedHomework(s.rows, {
      devoirId: nextDevoir,
      exerciceId: String(s.rows.devoirs[0].exercice_id),
      statut: 'expire',
      reasonStudent: 'Ce devoir expiré ne doit pas être proposé.',
    });
    const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.refused).toBe(true);
    expect(JSON.stringify(r)).not.toContain(nextDevoir);
    expect(r.text).not.toContain('Ce devoir expiré ne doit pas être proposé.');
  });
  it('24 Lot 1 : sans snapshot.devoir_id, aucune justification inventée', async () => {
    const s = setup();
    s.rows.routing_decisions[0].devoir_genere = 'exo_guide_meme_niveau_outils_aide_fournis';
    s.rows.routing_decisions[0].context_snapshot = { seuil: 80 };
    s.rows.routing_decisions[0].reason_student = '';
    const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.refused).toBe(true);
    expect(r.text).toBe('Aucune prochaine activité autorisée n’est disponible pour le moment.');
    expect(r.text).not.toMatch(/personnalisee|personnalisée|parce que/i);
  });
  it('25 Lot 1 : devoir d’un autre élève non divulgué', async () => {
    const s = setup();
    linkAssignedHomework(s.rows, {
      devoirId: foreignDevoir,
      exerciceId: String(s.rows.devoirs[0].exercice_id),
      eleveId: otherLearner,
      reasonStudent: 'SECRET_AUTRE_ELEVE',
    });
    const asOwner = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(asOwner.refused).toBe(true);
    expect(JSON.stringify(asOwner)).not.toContain(foreignDevoir);
    expect(JSON.stringify(asOwner)).not.toContain('SECRET_AUTRE_ELEVE');
    const asOther = await s.ask({ question: 'Que dois-je faire ensuite ?' }, otherLearner);
    expect(asOther.refused).toBe(true);
    expect(JSON.stringify(asOther)).not.toContain(foreignDevoir);
    expect(JSON.stringify(asOther)).not.toContain(devoir);
  });
  it('26 Lot 1 : chemin déterministe, aucun appel Gemini sur la reco', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Réseau interdit'));
    try {
      const s = setup();
      linkAssignedHomework(s.rows, {
        devoirId: nextDevoir,
        exerciceId: String(s.rows.devoirs[0].exercice_id),
      });
      const r = await s.ask({ question: 'Que dois-je faire ensuite ?', aiEnabled: true });
      expect(r.aiInvoked).toBe(false);
      expect(r.realAiBlocked).toBe(true);
      expect(r.provider).toBe('server_context');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('27 Lot 1 : plusieurs décisions, created_at le plus récent gagne', async () => {
    const s = setup();
    const exerciceId = String(s.rows.devoirs[0].exercice_id);
    linkAssignedHomework(s.rows, {
      devoirId: nextDevoir,
      exerciceId,
      reasonStudent: 'Ancienne décision.',
    });
    s.rows.routing_decisions[0].created_at = '2026-10-01T10:00:00Z';
    s.rows.devoirs.push({
      id: foreignDevoir,
      eleve_id: learner,
      exercice_id: exerciceId,
      session_id: session,
      contexte: 'devoir',
      statut: 'en_attente',
    });
    s.rows.routing_decisions.push({
      eleve_id: learner,
      exercice_id: exerciceId,
      session_id: session,
      reason_student: 'Décision la plus récente.',
      reason_trainer: 'SECRET_TRAINER',
      rule_id: 'SECRET_RULE',
      devoir_genere: 'exo_guide_meme_niveau_outils_aide_fournis',
      context_snapshot: { devoir_id: foreignDevoir },
      created_at: '2026-10-06T12:00:00Z',
    });
    const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.tool?.route).toBe(`/eleve/devoirs/${foreignDevoir}`);
    expect(r.text).toContain('Décision la plus récente.');
    expect(r.text).not.toContain('Ancienne décision.');
  });
  it('28 Lot 3 : évaluation refuse l’indice sans écriture ni modèle', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Réseau interdit'));
    try {
      const rows = louiseHintReadyFixture();
      rows.devoirs[0].contexte = 'evaluation';
      const store: DataStore = {
        async read(table, _columns, filters) {
          return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
        },
        insert: vi.fn(async (table, row) => { rows[table].push(row); }),
      };
      const r = await handlePedagogical({
        authUserId: learner,
        body: {
          exerciseId: rows.exercices[0].id,
          devoirId: devoir,
          itemIndex: 0,
          tool: { name: 'deliver_validated_hint', args: { level: 1 } },
        },
        userStore: store,
        contentStore: store,
      });
      expect(r.refused).toBe(true);
      expect(r.text).toContain('évaluation');
      expect(r.text).not.toMatch(/musique|danse|thème/i);
      expect(r.aiInvoked).toBe(false);
      expect(store.insert).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('29 Lot 3 : indice présenté journalisé sans recopier le résultat', async () => {
    const rows = louiseHintReadyFixture();
    const store: DataStore = {
      async read(table, _columns, filters) {
        return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      },
      insert: vi.fn(async (table, row) => { rows[table].push(row); }),
    };
    const r = await handlePedagogical({
      authUserId: learner,
      body: {
        exerciseId: rows.exercices[0].id,
        devoirId: devoir,
        attemptId: attempt,
        itemIndex: 0,
        tool: { name: 'deliver_validated_hint', args: { level: 1 } },
      },
      userStore: store,
      contentStore: store,
    });
    expect(r.refused).toBe(false);
    expect(store.insert).toHaveBeenCalledOnce();
    const event = rows.session_live_events[0];
    expect(event.event_type).toBe('aide_demandee');
    expect(event.eleve_id).toBe(learner);
    expect((event.payload as { kind: string; tentative_id: string; niveau_aide: number; origine: string }).kind).toBe(PRESENTED_HINT_KIND);
    expect((event.payload as { tentative_id: string }).tentative_id).toBe(attempt);
    expect((event.payload as { niveau_aide: number }).niveau_aide).toBe(1);
    expect((event.payload as { origine: string }).origine).toBe('banque');
    expect(JSON.stringify(event.payload)).not.toMatch(/answer_correct|score_normalized|bonne_reponse/);
  });
  it('30 Lot 4 : échec de journalisation → aucun indice renvoyé', async () => {
    const rows = louiseHintReadyFixture();
    const store: DataStore = {
      async read(table, _columns, filters) {
        return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      },
      insert: vi.fn(async () => { throw new Error('help_write_failed'); }),
    };
    const r = await handlePedagogical({
      authUserId: learner,
      body: {
        exerciseId: rows.exercices[0].id,
        devoirId: devoir,
        attemptId: attempt,
        itemIndex: 0,
        tool: { name: 'deliver_validated_hint', args: { level: 1 } },
      },
      userStore: store,
      contentStore: store,
    });
    expect(r.refused).toBe(true);
    expect(r.text).toContain('journalisation');
    expect(r.text).not.toMatch(/thème|musique|Écoute/i);
    expect(rows.session_live_events).toHaveLength(0);
  });
  it('31 Lot 4 : relance réseau ne double pas le même événement', async () => {
    const rows = louiseHintReadyFixture();
    const store: DataStore = {
      async read(table, _columns, filters) {
        return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      },
      insert: vi.fn(async (table, row) => { rows[table].push(row); }),
    };
    const body = {
      exerciseId: rows.exercices[0].id,
      devoirId: devoir,
      attemptId: attempt,
      itemIndex: 0,
      tool: { name: 'deliver_validated_hint', args: { level: 1 } },
    };
    const first = await handlePedagogical({ authUserId: learner, body, userStore: store, contentStore: store });
    const second = await handlePedagogical({ authUserId: learner, body, userStore: store, contentStore: store });
    expect(first.refused).toBe(false);
    expect(second.refused).toBe(false);
    expect(first.text).toBe(second.text);
    expect(store.insert).toHaveBeenCalledOnce();
    expect(rows.session_live_events).toHaveLength(1);
    expect((rows.session_live_events[0].payload as { tentative_id: string }).tentative_id).toBe(attempt);
    expect(rows.session_live_events[0].eleve_id).toBe(learner);
  });
  it('32 Lot 4 : session absente → refus clair, aucun événement', async () => {
    const rows = louiseHintReadyFixture();
    rows.devoirs[0].session_id = null;
    const store: DataStore = {
      async read(table, _columns, filters) {
        return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      },
      insert: vi.fn(async (table, row) => { rows[table].push(row); }),
    };
    const r = await handlePedagogical({
      authUserId: learner,
      body: {
        exerciseId: rows.exercices[0].id,
        devoirId: devoir,
        itemIndex: 0,
        tool: { name: 'deliver_validated_hint', args: { level: 1 } },
      },
      userStore: store,
      contentStore: store,
    });
    expect(r.refused).toBe(true);
    expect(r.text).toMatch(/session/i);
    expect(store.insert).not.toHaveBeenCalled();
    expect(r.text).not.toMatch(/thème|musique|Écoute/i);
  });
  it('33 Lot 4 : nouvel niveau d’aide reste traçable (pas un doublon)', async () => {
    const rows = louiseHintReadyFixture();
    rows.devoirs[0].contexte = 'entrainement';
    const store: DataStore = {
      async read(table, _columns, filters) {
        return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
      },
      insert: vi.fn(async (table, row) => { rows[table].push(row); }),
    };
    const base = {
      exerciseId: rows.exercices[0].id,
      devoirId: devoir,
      attemptId: attempt,
      itemIndex: 0,
    };
    await handlePedagogical({
      authUserId: learner,
      body: { ...base, tool: { name: 'deliver_validated_hint', args: { level: 1 } } },
      userStore: store,
      contentStore: store,
    });
    const second = await handlePedagogical({
      authUserId: learner,
      body: { ...base, tool: { name: 'deliver_validated_hint', args: { level: 2 } } },
      userStore: store,
      contentStore: store,
    });
    expect(second.refused).toBe(false);
    expect(rows.session_live_events).toHaveLength(2);
    expect((rows.session_live_events[0].payload as { niveau_aide: number }).niveau_aide).toBe(1);
    expect((rows.session_live_events[1].payload as { niveau_aide: number }).niveau_aide).toBe(2);
  });
});
