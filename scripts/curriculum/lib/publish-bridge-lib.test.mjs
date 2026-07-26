import { describe, expect, it } from 'vitest';
import {
  buildCivicExerciceDraft,
  buildVariantExerciceDraft,
  buildVariantExerciceDrafts,
  competenceForFormat,
  curriculumMetadataCode,
  dominantFormat,
  mapQuestionToItem,
  mapQuestionTypeToFormat,
  orderExercicesForPilot,
  resolveVariantCompetence,
  selectNiveauxForPalier,
  UnknownQuestionTypeError,
  UnsupportedFrontendFormatError,
} from './publish-bridge-lib.mjs';

// Seules ces 7 valeurs existent dans l'ENUM Postgres `exercice_format`
// (migration 20260317202832) — toute valeur retournee par le mapping DOIT
// en faire partie, sous peine d'echec d'insertion en base.
const VALID_EXERCICE_FORMATS = new Set([
  'qcm',
  'vrai_faux',
  'appariement',
  'production_ecrite',
  'production_orale',
  'texte_lacunaire',
  'transformation',
]);

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

  it('publie chaque etape du parcours comme un exercice ordonne et affiche la lecon au debut', () => {
    const learningVariant = {
      ...variant,
      learning_path: {
        lesson: {
          title: 'Lecon test',
          objective: 'Comprendre le support commun.',
          explanation: 'Une explication suffisamment complete pour guider le travail.',
          key_points: ['Point cle'],
          examples: ['Exemple'],
          estimated_minutes: 10,
        },
        steps: [
          { step_id: 'guide', title: 'Guide', instruction: 'Etape guidee', kind: 'guided', estimated_minutes: 15, questions: [variant.questions[0]], corrige: { q1: '80' } },
          { step_id: 'transfert', title: 'Transfert', instruction: 'Etape autonome', kind: 'transfer', estimated_minutes: 20, questions: [variant.questions[1]], corrige: { q2: true } },
        ],
        adaptive_policy: { remediation_below: 60, consolidation_from: 60, extension_from: 80 },
      },
    };
    const drafts = buildVariantExerciceDrafts({
      variant: learningVariant,
      sessionCode: 'S01',
      trainingSessionId: 'ts-uuid',
      supportId: variant.support_id,
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0].metadata_code).toBe('cv2:S01:variant:A1');
    expect(drafts[1].metadata_code).toBe('cv2:S01:variant:A1:transfert');
    expect(drafts[0].contenu.lesson.title).toBe('Lecon test');
    expect(drafts[1].contenu.lesson).toBeNull();
    expect(drafts.map((draft) => draft.contenu.metadata.learning_path.step_order)).toEqual([1, 2]);
    expect(drafts[0].contenu.metadata.learning_path.adaptive_policy.extension_from).toBe(80);
  });
  it('propage l observation temporelle dans les metadata publiees', () => {
    const durationObservation = {
      estimated_minutes: 25,
      minimum_coverage_minutes: 55,
      status: 'warning',
      warnings: [{ code: 'DIFF_DURATION_BELOW_MINIMUM', level: 'A1' }],
    };
    const draft = buildVariantExerciceDraft({
      variant,
      sessionCode: 'S01',
      trainingSessionId: 'ts-uuid',
      supportId: variant.support_id,
      durationObservation,
    });

    expect(draft.contenu.metadata.duration_observation).toEqual(durationObservation);
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

  describe('mapQuestionTypeToFormat — couverture des 15 types de la mission', () => {
    // Ces 10 types sont verifies bout-en-bout comme reellement restituables
    // (src/lib/correctionExercice.ts, correction-server.ts, DevoirPassation.tsx) :
    // rendu (options -> choix unique, ou input texte libre), saisie, correction.
    const EXPECTED_MAPPING = {
      qcm: 'qcm',
      vrai_faux: 'vrai_faux',
      appariement: 'appariement',
      texte_lacunaire: 'texte_lacunaire',
      reponse_courte: 'production_ecrite',
      reponse_longue: 'production_ecrite',
      argumentation: 'production_ecrite',
      transformation: 'transformation',
      production_ecrite: 'production_ecrite',
      production_orale: 'production_orale',
    };

    // Ces 5 types sont RECONNUS (pas "inconnus") mais le frontend actuel ne
    // sait pas les restituer fidelement — ils doivent BLOQUER la publication
    // plutot que d'etre traites comme supportes (voir le mapping commente
    // dans publish-bridge-lib.mjs pour le detail de chaque preuve).
    const EXPECTED_UNSUPPORTED = [
      'qcm_multiple',
      'ordonnancement',
      'classement',
      'audio_qcm',
      'dictee',
    ];

    it.each(Object.entries(EXPECTED_MAPPING))(
      'mappe "%s" vers un format valide de l\'enum exercice_format ("%s")',
      (type, expectedFormat) => {
        const format = mapQuestionTypeToFormat(type);
        expect(format).toBe(expectedFormat);
        expect(VALID_EXERCICE_FORMATS.has(format)).toBe(true);
      },
    );

    it.each(EXPECTED_UNSUPPORTED)(
      'bloque "%s" (reconnu mais non restituable par le frontend aujourd\'hui)',
      (type) => {
        expect(() => mapQuestionTypeToFormat(type)).toThrow(UnsupportedFrontendFormatError);
        try {
          mapQuestionTypeToFormat(type);
        } catch (error) {
          expect(error.questionType).toBe(type);
          expect(typeof error.reason).toBe('string');
          expect(error.reason.length).toBeGreaterThan(0);
        }
      },
    );

    it('bloque un type de question inconnu au lieu de retomber silencieusement sur qcm', () => {
      expect(() => mapQuestionTypeToFormat('type_totalement_inconnu')).toThrow(UnknownQuestionTypeError);
      try {
        mapQuestionTypeToFormat('type_totalement_inconnu');
      } catch (error) {
        expect(error.questionType).toBe('type_totalement_inconnu');
      }
    });

    it('dominantFormat bloque des qu\'une question du lot a un type inconnu', () => {
      const questions = [
        { id: 'q1', type: 'qcm', enonce: 'Ok' },
        { id: 'q2', type: 'format_mystere', enonce: 'Casse' },
      ];
      expect(() => dominantFormat(questions)).toThrow(UnknownQuestionTypeError);
    });

    it('buildVariantExerciceDraft bloque la construction du brouillon sur un type inconnu', () => {
      const variant = {
        support_id: 'S02-support-x',
        version: 1,
        niveau: 'A1',
        consigne: 'Test',
        questions: [{ id: 'q1', type: 'format_mystere', enonce: 'Casse' }],
        corrige: {},
        invariants_hash: 'x',
      };
      expect(() =>
        buildVariantExerciceDraft({
          variant,
          sessionCode: 'S02',
          trainingSessionId: 'ts-uuid',
          supportId: variant.support_id,
        }),
      ).toThrow(UnknownQuestionTypeError);
    });
  });
});
