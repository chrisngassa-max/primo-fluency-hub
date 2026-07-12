/** Pure helpers — curriculum publish → exercices / exercise_variants bridge. */

export const CURRICULUM_SOURCE = 'curriculum_v2';
export const NIVEAUX = ['A1', 'A2', 'B1', 'B2'];

export function curriculumMetadataCode(sessionCode, kind, key) {
  return `cv2:${sessionCode}:${kind}:${key}`;
}

export function mapQuestionTypeToFormat(type) {
  switch (type) {
    case 'qcm':
      return 'qcm';
    case 'vrai_faux':
      return 'vrai_faux';
    case 'reponse_courte':
    case 'reponse_longue':
    case 'argumentation':
      return 'production_ecrite';
    default:
      return 'qcm';
  }
}

export function dominantFormat(questions) {
  const counts = new Map();
  for (const q of questions ?? []) {
    const fmt = mapQuestionTypeToFormat(q.type);
    counts.set(fmt, (counts.get(fmt) ?? 0) + 1);
  }
  let best = 'qcm';
  let max = 0;
  for (const [fmt, n] of counts) {
    if (n > max) {
      max = n;
      best = fmt;
    }
  }
  return best;
}

export function competenceForFormat(format) {
  switch (format) {
    case 'production_ecrite':
      return 'EE';
    case 'production_orale':
      return 'EO';
    default:
      return 'CE';
  }
}

export function resolveVariantCompetence(variant, format) {
  const declared = String(variant?.competence ?? '').toUpperCase();
  if (['CE', 'CO', 'EE', 'EO', 'STRUCTURES'].includes(declared)) return declared;
  return competenceForFormat(format);
}

export function normalizeCorrigeValue(value) {
  if (typeof value === 'boolean') return value ? 'Vrai' : 'Faux';
  if (value == null) return '';
  return String(value);
}

export function mapQuestionToItem(question, corrige) {
  const answer = corrige?.[question.id];
  const format = mapQuestionTypeToFormat(question.type);
  const item = {
    question: question.enonce,
    bonne_reponse: normalizeCorrigeValue(answer),
    explication: '',
    curriculum_question_id: question.id,
    curriculum_question_type: question.type,
  };
  if (format === 'qcm' && Array.isArray(question.options)) {
    item.options = question.options;
  }
  if (format === 'vrai_faux') {
    item.options = ['Vrai', 'Faux'];
  }
  return item;
}

export function buildVariantExerciceDraft({
  variant,
  sessionCode,
  trainingSessionId,
  supportId,
  exerciseVariantId = null,
  sessionResourceId = null,
}) {
  const items = (variant.questions ?? []).map((q) => mapQuestionToItem(q, variant.corrige ?? {}));
  const format = dominantFormat(variant.questions);
  const competence = resolveVariantCompetence(variant, format);
  const metadataCode = curriculumMetadataCode(sessionCode, 'variant', variant.niveau);

  return {
    metadata_code: metadataCode,
    titre: `${sessionCode} · variante ${variant.niveau}`,
    consigne: variant.consigne,
    competence,
    format,
    niveau_vise: variant.niveau,
    difficulte: niveauToDifficulte(variant.niveau),
    source: CURRICULUM_SOURCE,
    is_ai_generated: false,
    is_template: false,
    is_devoir: false,
    collectif: true,
    contenu: {
      items,
      metadata: {
        source: CURRICULUM_SOURCE,
        session_code: sessionCode,
        training_session_id: trainingSessionId,
        niveau: variant.niveau,
        support_id: supportId,
        exercise_variant_id: exerciseVariantId,
        session_resource_id: sessionResourceId,
        curriculum_key: metadataCode,
        aides: variant.aides ?? [],
        invariants_hash: variant.invariants_hash ?? null,
        family_id: variant.family_id ?? null,
        source_level: variant.differentiation_contract?.source_level ?? null,
        target_level: variant.differentiation_contract?.target_level ?? variant.niveau,
        transformation_id: variant.differentiation_contract?.transformation_id ?? null,
        differentiation_contract: variant.differentiation_contract ?? null,
        validation_report: variant.validation_report ?? null,
      },
    },
    animation_guide: {
      source: CURRICULUM_SOURCE,
      variant_niveau: variant.niveau,
      aides: variant.aides ?? [],
    },
  };
}

export function buildCivicExerciceDraft({
  question,
  index,
  sessionCode,
  trainingSessionId,
  civicMeta,
  sessionResourceId = null,
}) {
  const metadataCode = curriculumMetadataCode(sessionCode, 'civic', String(index));
  const options = Array.isArray(question.options) ? question.options : [];

  return {
    metadata_code: metadataCode,
    titre: `${sessionCode} · civique ${index + 1}`,
    consigne: question.enonce,
    competence: 'CE',
    format: 'qcm',
    niveau_vise: 'A2',
    difficulte: 3,
    source: CURRICULUM_SOURCE,
    is_ai_generated: false,
    is_template: false,
    is_devoir: false,
    collectif: true,
    theme: mapCivicTheme(civicMeta?.theme),
    contenu: {
      items: [
        {
          question: question.enonce,
          options,
          bonne_reponse: question.reponse ?? '',
          explication: '',
        },
      ],
      metadata: {
        source: CURRICULUM_SOURCE,
        session_code: sessionCode,
        training_session_id: trainingSessionId,
        civic_mention: civicMeta?.mention ?? null,
        civic_theme: civicMeta?.theme ?? null,
        civic_notion: question.notion ?? null,
        session_resource_id: sessionResourceId,
        curriculum_key: metadataCode,
      },
    },
  };
}

function niveauToDifficulte(niveau) {
  switch (niveau) {
    case 'A1':
      return 2;
    case 'A2':
      return 3;
    case 'B1':
      return 4;
    case 'B2':
      return 5;
    default:
      return 3;
  }
}

function mapCivicTheme(theme) {
  if (!theme) return null;
  const norm = String(theme).toLowerCase();
  if (norm.includes('citoyen') || norm.includes('république') || norm.includes('republique')) {
    return 'vie_citoyenne';
  }
  if (norm.includes('travail')) return 'travail';
  if (norm.includes('sant')) return 'sante';
  if (norm.includes('école') || norm.includes('ecole')) return 'ecole';
  return 'vie_citoyenne';
}

export function selectNiveauxForPalier(palierCible, includeHeterogeneous = true) {
  const primary = palierCible && NIVEAUX.includes(palierCible) ? palierCible : 'A2';
  if (!includeHeterogeneous) return [primary];
  return NIVEAUX;
}

export function orderExercicesForPilot(exercices, palierCible) {
  const niveauRank = Object.fromEntries(NIVEAUX.map((n, i) => [n, i]));
  const primary = palierCible && NIVEAUX.includes(palierCible) ? palierCible : 'A2';

  return [...exercices].sort((a, b) => {
    const aMeta = a.contenu?.metadata ?? {};
    const bMeta = b.contenu?.metadata ?? {};
    const aVariant = aMeta.niveau ? 0 : 1;
    const bVariant = bMeta.niveau ? 0 : 1;
    if (aVariant !== bVariant) return aVariant - bVariant;

    const aPri = a.niveau_vise === primary ? 0 : 1;
    const bPri = b.niveau_vise === primary ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;

    return (niveauRank[a.niveau_vise] ?? 99) - (niveauRank[b.niveau_vise] ?? 99);
  });
}
