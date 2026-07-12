import { describe, expect, it } from 'vitest';
import {
  buildCivicExerciceDraft,
  buildVariantExerciceDraft,
  competenceForFormat,
  curriculumMetadataCode,
  dominantFormat,
  mapQuestionToItem,
  orderExercicesForPilot,
  resolveVariantCompetence,
  selectNiveauxForPalier,
} from './publish-bridge-lib.mjs';

describe('publish-bridge-lib', () => {
  const variant = {
    support_id: 'S01-support-accueil',
    version: 1,
    niveau: 'A1',
    consigne: 'Ecoutez le dialogue.',
    aides: ['Aide 1'],
    questions: [
      { id: 'q1', type: 'qcm', enonce: 'Combien ?', options: ['25', '80'] },
      { id: 'q2', type: 'vrai_faux', enonce: 'Awa veut la CSP.' },
    ],
    corrige: { q1: '80', q2: true },
    invariants_hash: 'abc123',
  };

  it('genere un metadata_code stable pour deduplication', () => {
    expect(curriculumMetadataCode('S01', 'variant', 'A1')).toBe('cv2:S01:variant:A1');
  });

  it('mappe les questions curriculum vers items exercices', () => {
    const items = variant.questions.map((q) => mapQuestionToItem(q, variant.corrige));
    expect(items[0].bonne_reponse).toBe('80');
    expect(items[0].options).toEqual(['25', '80']);
    expect(items[1].bonne_reponse).toBe('Vrai');
    expect(items[1].options).toEqual(['Vrai', 'Faux']);
  });

  it('construit un brouillon exercice variante avec metadata curriculum_v2', () => {
    const draft = buildVariantExerciceDraft({
      variant,
      sessionCode: 'S01',
      trainingSessionId: 'ts-uuid',
      supportId: variant.support_id,
    });
    expect(draft.source).toBe('curriculum_v2');
    expect(draft.metadata_code).toBe('cv2:S01:variant:A1');
    expect(draft.contenu.metadata.session_code).toBe('S01');
    expect(draft.contenu.items).toHaveLength(2);
    expect(draft.competence).toBe('CE');
    expect(dominantFormat(variant.questions)).toBe('qcm');
  });

  it('derive la competence depuis le format dominant', () => {
    expect(competenceForFormat('qcm')).toBe('CE');
    expect(competenceForFormat('vrai_faux')).toBe('CE');
    expect(competenceForFormat('production_ecrite')).toBe('EE');
    expect(competenceForFormat('production_orale')).toBe('EO');
  });

  it('classe une variante de production longue en EE', () => {
    const draft = buildVariantExerciceDraft({
      variant: {
        ...variant,
        niveau: 'B1',
        questions: [
          { id: 'q1', type: 'reponse_longue', enonce: 'Justifiez votre réponse.' },
          { id: 'q2', type: 'argumentation', enonce: 'Développez votre point de vue.' },
        ],
      },
      sessionCode: 'S01',
      trainingSessionId: 'ts-uuid',
      supportId: variant.support_id,
    });

    expect(draft.format).toBe('production_ecrite');
    expect(draft.competence).toBe('EE');
  });

  it('preserve la competence explicite de la famille quel que soit le format de reponse', () => {
    const draft = buildVariantExerciceDraft({
      variant: {
        ...variant,
        niveau: 'B2',
        competence: 'CE',
        family_id: 'S01_CE_ACCUEIL_01',
        differentiation_contract: {
          source_level: 'A2',
          target_level: 'B2',
          transformation_id: 'A2_TO_B2',
        },
        questions: [{ id: 'q1', type: 'argumentation', enonce: 'Analysez le support.' }],
      },
      sessionCode: 'S01',
      trainingSessionId: 'ts-uuid',
      supportId: variant.support_id,
    });

    expect(resolveVariantCompetence({ competence: 'CE' }, 'production_ecrite')).toBe('CE');
    expect(draft.format).toBe('production_ecrite');
    expect(draft.competence).toBe('CE');
    expect(draft.contenu.metadata.transformation_id).toBe('A2_TO_B2');
  });

  it('construit un QCM civique reutilisable', () => {
    const draft = buildCivicExerciceDraft({
      question: {
        enonce: 'Le parcours dure :',
        options: ['50 h', '80 h'],
        reponse: '80 h',
        notion: 'duree',
      },
      index: 0,
      sessionCode: 'S01',
      trainingSessionId: 'ts-uuid',
      civicMeta: { mention: 'CSP', theme: 'Droits et devoirs' },
    });
    expect(draft.metadata_code).toBe('cv2:S01:civic:0');
    expect(draft.competence).toBe('CE');
    expect(draft.contenu.items[0].bonne_reponse).toBe('80 h');
  });

  it('ordonne les exercices pilote : palier cible puis heterogene', () => {
    const rows = [
      { id: '1', niveau_vise: 'B2', contenu: { metadata: { niveau: 'B2' } } },
      { id: '2', niveau_vise: 'A2', contenu: { metadata: { niveau: 'A2' } } },
      { id: '3', niveau_vise: 'A2', contenu: { metadata: {} } },
    ];
    const ordered = orderExercicesForPilot(rows, 'A2');
    expect(ordered.map((r) => r.id)).toEqual(['2', '1', '3']);
  });

  it('selectNiveauxForPalier inclut A1-B2 en heterogene', () => {
    expect(selectNiveauxForPalier('B1', true)).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(selectNiveauxForPalier('B1', false)).toEqual(['B1']);
  });
});
