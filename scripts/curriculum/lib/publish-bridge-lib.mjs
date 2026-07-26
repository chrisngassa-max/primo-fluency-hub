/** Pure helpers — curriculum publish → exercices / exercise_variants bridge. */

export const CURRICULUM_SOURCE = 'curriculum_v2';
export const NIVEAUX = ['A1', 'A2', 'B1', 'B2'];

export function curriculumMetadataCode(sessionCode, kind, key) {
  return `cv2:${sessionCode}:${kind}:${key}`;
}

/** Type de question curriculum non reconnu par le pont — bloque la publication de la variante. */
export class UnknownQuestionTypeError extends Error {
  constructor(questionType) {
    super(`Type de question curriculum inconnu : "${questionType}". Publication bloquee.`);
    this.name = 'UnknownQuestionTypeError';
    this.questionType = questionType;
  }
}

/**
 * Type de question RECONNU par le pont mais que le frontend actuel ne sait
 * pas restituer/corriger fidelement. Distinct de UnknownQuestionTypeError :
 * ici on sait ce que le type veut dire, on sait juste que la chaine
 * bout-en-bout (rendu + saisie + correction) ne le supporte pas encore.
 */
export class UnsupportedFrontendFormatError extends Error {
  constructor(questionType, reason) {
    super(`Type de question "${questionType}" reconnu mais non restituable par le frontend : ${reason}`);
    this.name = 'UnsupportedFrontendFormatError';
    this.questionType = questionType;
    this.reason = reason;
  }
}

// La colonne `exercices.format` est un ENUM Postgres fige a 7 valeurs
// (qcm, vrai_faux, appariement, production_ecrite, production_orale,
// texte_lacunaire, transformation — voir migration 20260317202832). Les
// types curriculum ci-dessous n'ont donc pas tous une correspondance 1:1 en
// stockage ; le mapping choisit la valeur d'enum la plus proche et la
// distinction fine reste portee par `contenu.items` / `metadata`, pas par
// `format`. Un type absent de cette liste doit BLOQUER la publication
// (DIFF_TRANSFORMATION_NOT_SUPPORTED-like), jamais retomber silencieusement
// sur 'qcm'.
//
// VERIFICATION BOUT-EN-BOUT (src/lib/correctionExercice.ts, supabase/functions/
// _shared/correction-server.ts, src/pages/eleve/DevoirPassation.tsx) :
// - qcm/vrai_faux/appariement/texte_lacunaire/transformation sont tous
//   corriges par EGALITE DE CHAINE NORMALISEE sur une reponse UNIQUE
//   (`answers[idx]` est une string, jamais un tableau). `appariement` ne
//   rend PAS une UI d'appariement dediee : c'est la meme liste a choix
//   unique que qcm (limite produit preexistante, pas introduite ici).
// - production_ecrite/production_orale passent par l'IA (tcf-evaluate-answer).
// - Le lecteur audio CO (`DevoirPassation.tsx`) affiche `contenu.script_audio`
//   au niveau de l'exercice ; `buildVariantExerciceDraft` ne propage
//   aujourd'hui AUCUN champ audio depuis une question vers `contenu.script_audio`.
//
// Consequence : 5 des 15 types demandes sont RECONNUS mais NE PEUVENT PAS
// etre restitues fidelement aujourd'hui et doivent donc BLOQUER la
// publication (pas etre traites comme supportes) :
//   - qcm_multiple   : plusieurs bonnes reponses -> aucune UI/donnee multi-select,
//                      la 2e selection ecrase la 1re, la correction ne peut
//                      pas noter "plusieurs reponses correctes".
//   - ordonnancement : remettre dans l'ordre -> retomberait sur le meme
//                      choix unique qu'un qcm, perd totalement la semantique.
//   - classement     : classer par categorie -> idem, aucune UI de classement.
//   - audio_qcm      : QCM avec audio -> `contenu.script_audio` n'est pas
//                      propage par le pont, l'audio serait silencieusement absent.
//   - dictee         : ecrire ce qui est entendu -> meme dependance audio non
//                      cablee, plus une correction qui devrait etre tolerante
//                      (IA) et non une simple egalite de chaine.
export function mapQuestionTypeToFormat(type) {
  switch (type) {
    case 'qcm':
      return 'qcm';
    case 'vrai_faux':
      return 'vrai_faux';
    case 'appariement':
      return 'appariement';
    case 'texte_lacunaire':
      return 'texte_lacunaire';
    case 'transformation':
      return 'transformation';
    case 'reponse_courte':
    case 'reponse_longue':
    case 'argumentation':
    case 'production_ecrite':
      return 'production_ecrite';
    case 'production_orale':
      return 'production_orale';
    case 'qcm_multiple':
      throw new UnsupportedFrontendFormatError(type, 'reponse multiple non supportee par le renderer (answers[idx] est une valeur unique) ni par la correction (egalite de chaine simple).');
    case 'ordonnancement':
      throw new UnsupportedFrontendFormatError(type, 'aucune UI de remise en ordre ; retomberait sur un choix unique et perdrait la semantique de sequence.');
    case 'classement':
      throw new UnsupportedFrontendFormatError(type, 'aucune UI de classement par categorie ; retomberait sur un choix unique.');
    case 'audio_qcm':
      throw new UnsupportedFrontendFormatError(type, 'le pont ne propage pas encore de champ audio vers contenu.script_audio ; le lecteur CO resterait vide.');
    case 'dictee':
      throw new UnsupportedFrontendFormatError(type, 'meme dependance audio non cablee que audio_qcm, et necessite une correction tolerante (IA) plutot qu\'une egalite de chaine.');
    default:
      throw new UnknownQuestionTypeError(type);
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
  durationObservation = null,
  learningStep = null,
  stepIndex = 0,
  stepCount = null,
}) {
  const questions = learningStep?.questions ?? variant.questions ?? [];
  const corrige = learningStep?.corrige ?? variant.corrige ?? {};
  const items = questions.map((q) => mapQuestionToItem(q, corrige));
  const format = dominantFormat(questions);
  const competence = resolveVariantCompetence(variant, format);
  const hasLearningPath = Array.isArray(variant.learning_path?.steps) && variant.learning_path.steps.length > 0;
  const resolvedStepCount = stepCount ?? (hasLearningPath ? variant.learning_path.steps.length : 1);
  const stepId = learningStep?.step_id ?? 'activity';
  const metadataKey = stepIndex === 0
    ? variant.niveau
    : `${variant.niveau}:${stepId}`;
  const metadataCode = curriculumMetadataCode(sessionCode, 'variant', metadataKey);
  const lesson = stepIndex === 0 ? variant.learning_path?.lesson ?? null : null;

  return {
    metadata_code: metadataCode,
    titre: learningStep?.title
      ? `${sessionCode} · ${variant.niveau} · ${learningStep.title}`
      : `${sessionCode} · variante ${variant.niveau}`,
    consigne: learningStep?.instruction ?? variant.consigne,
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
      lesson,
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
        duration_observation: durationObservation,
        learning_path: hasLearningPath
          ? {
              step_id: stepId,
              step_order: stepIndex + 1,
              step_count: resolvedStepCount,
              kind: learningStep?.kind ?? 'practice',
              estimated_minutes: learningStep?.estimated_minutes ?? null,
              adaptive_policy: variant.learning_path.adaptive_policy ?? null,
            }
          : null,
      },
    },
    animation_guide: {
      source: CURRICULUM_SOURCE,
      variant_niveau: variant.niveau,
      aides: variant.aides ?? [],
      learning_path_step: hasLearningPath ? stepIndex + 1 : null,
    },
  };
}

export function buildVariantExerciceDrafts(args) {
  const steps = args.variant?.learning_path?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return [buildVariantExerciceDraft(args)];
  }
  return steps.map((learningStep, stepIndex) => buildVariantExerciceDraft({
    ...args,
    learningStep,
    stepIndex,
    stepCount: steps.length,
  }));
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
