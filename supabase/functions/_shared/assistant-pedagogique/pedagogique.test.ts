import { describe, expect, it, vi } from 'vitest';
import { handlePedagogical, type DataStore } from './index';
import { fixture, learner, devoir, session, attempt, pilot, explanation } from './fixtures';

function setup(level = 0) {
  const rows = fixture(level);
  const store: DataStore = {
    async read(table, _columns, filters) {
      return (rows[table] ?? []).filter(row => Object.entries(filters).every(([k, v]) => row[k] === v));
    },
    insert: vi.fn(async (table, row) => { rows[table].push(row); }),
  };
  const body = { exerciseId: pilot[level][1], devoirId: devoir, itemIndex: 0, attemptId: attempt, question: 'Explique la consigne plus simplement' };
  return { rows, store, body, ask: (patch = {}, uid = learner) => handlePedagogical({ authUserId: uid, body: { ...body, ...patch }, userStore: store, contentStore: store }) };
}

describe('Lot 2A : décisions serveur Louise sans modèle', () => {
  it('1 refuse un autre élève et une tentative étrangère', async () => {
    const s = setup(); expect((await s.ask({}, 'other')).refused).toBe(true);
    s.rows.exercise_attempts[0].learner_id = 'other'; expect((await s.ask()).refused).toBe(true);
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
    const s = setup(); s.rows.exercise_attempts[0].status = 'in_progress';
    const r = await s.ask({ question: 'Pourquoi ma réponse est-elle fausse ?', submitted: true });
    expect(r.refused).toBe(true); expect(JSON.stringify(r)).not.toContain(explanation);
  });
  it('8 justification absente si correction non libérée', async () => {
    const s = setup(); s.rows.exercise_attempts[0].correction_released_at = null;
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
    const s = setup(); const r = await s.ask({ question: 'Que dois-je faire ensuite ?' });
    expect(r.text).toContain('Continue avec ton prochain devoir.'); expect(r.tool?.route).toBe(`/eleve/devoirs/${devoir}`);
    s.rows.exercise_attempts[0].status = 'in_progress'; expect((await s.ask({ question: 'Que dois-je faire ensuite ?' })).refused).toBe(true);
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
});
