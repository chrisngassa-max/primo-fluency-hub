import { isPublishableReport } from '../schemas/validation-report.schema.mjs';

// Controle 2, IA de revue (section 9.4). Utilise un ContentProvider
// (Anthropic reel ou fake en test) pour un appel *separe* de celui qui a
// produit le contenu, conformement a la section 9.3, point 5 : "faire
// relire le contenu par un appel separe de celui qui l'a produit."

const REVIEW_JSON_SCHEMA = {
  type: 'object',
  properties: {
    quality_score: { type: 'integer' },
    pedagogical_relevance_score: { type: 'integer' },
    single_defensible_answer: { type: 'boolean' },
    image_reveals_answer: { type: 'boolean' },
    contains_stereotype_or_noise: { type: 'boolean' },
    facts_consistent_across_media: { type: 'boolean' },
    bloquants: { type: 'array', items: { type: 'string' } },
    commentaire: { type: 'string' },
  },
  required: [
    'quality_score',
    'pedagogical_relevance_score',
    'single_defensible_answer',
    'image_reveals_answer',
    'contains_stereotype_or_noise',
    'facts_consistent_across_media',
    'bloquants',
  ],
};

const DEFAULT_RUBRIC = [
  'Coherence entre support, consigne, options et corrige.',
  'Une seule reponse defendable par question.',
  'Aucune image ne doit reveler la reponse.',
  'Absence de detail parasite et de stereotype.',
  'Lisibilite adaptee au niveau A1-B2, accessibilite, neutralite.',
  'Faits identiques entre texte, audio, image et variantes.',
].join('\n- ');

/**
 * @param {import('../providers/content-provider.mjs').AnthropicContentProvider} contentProvider
 * @param {{ resourceId: string, content: unknown, promptVersion?: string, rubric?: string }} request
 */
export async function runAiReview(
  contentProvider,
  {
    resourceId,
    content,
    promptVersion = 'review-v1',
    rubric = DEFAULT_RUBRIC,
    allowFakeReviewerForTest = false,
  },
) {
  const { data, model } = await contentProvider.review({
    promptVersion,
    content,
    rubric,
    jsonSchema: REVIEW_JSON_SCHEMA,
    toolName: 'emit_review',
  });

  const bloquants = [...(data.bloquants ?? [])];
  const fakeReviewerAllowed = allowFakeReviewerForTest && process.env.NODE_ENV === 'test';
  if (model === 'fake-content-model' && !fakeReviewerAllowed) {
    bloquants.push('DIFF_FAKE_REVIEW_NOT_ADMISSIBLE : une revue factice ne peut pas autoriser la publication.');
  }
  if (data.single_defensible_answer === false) bloquants.push('Plus d\'une reponse defendable detectee.');
  if (data.image_reveals_answer === true) bloquants.push('L\'image revele la reponse.');
  if (data.contains_stereotype_or_noise === true) bloquants.push('Stereotype ou detail parasite detecte.');
  if (data.facts_consistent_across_media === false) bloquants.push('Faits incoherents entre texte/audio/image/variantes.');

  const report = {
    validateur: 'ai_review',
    modele: model,
    regles: [
      'coherence_support_consigne_corrige',
      'reponse_unique_defendable',
      'image_ne_revele_pas_reponse',
      'absence_stereotype',
      'lisibilite_a1_b2',
      'faits_identiques_multi_media',
    ],
    scores: {
      quality_score: data.quality_score ?? null,
      pedagogical_relevance_score: data.pedagogical_relevance_score ?? null,
    },
    bloquants: [...new Set(bloquants)],
    rapport: { resource_id: resourceId, commentaire: data.commentaire ?? null, raw: data },
  };

  return { report, publishable: isPublishableReport(report) };
}
