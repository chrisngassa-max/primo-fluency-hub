const LEVELS = ['A1', 'A2', 'B1', 'B2'];

const QUESTION_SECONDS = {
  qcm: 45,
  vrai_faux: 45,
  appariement: 60,
  texte_lacunaire: 60,
  reponse_courte: 90,
  transformation: 120,
  reponse_longue: 240,
  argumentation: 330,
  production_ecrite: 300,
  production_orale: 180,
};

const LEVEL_MULTIPLIER = { A1: 1.15, A2: 1, B1: 1, B2: 1.05 };

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function roundMinutes(seconds) {
  return Math.round((seconds / 60) * 10) / 10;
}

export function findDifferentiatedWorkshopMinutes(phases) {
  if (!Array.isArray(phases)) return null;
  const phase = phases.find((entry) => {
    const label = String(entry?.phase ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return label.includes('atelier') && label.includes('differ');
  });
  return finitePositive(phase?.duree_min);
}

export function resolveDifferentiatedDurationPolicy(rules, announcedMinutes) {
  const policies = rules?.minimums_par_niveau_differencie;
  if (!policies || !finitePositive(announcedMinutes)) return null;
  const key = announcedMinutes >= 120 ? '120_min' : announcedMinutes >= 90 ? '90_min' : announcedMinutes >= 60 ? '60_min' : '45_min';
  const policy = policies[key];
  if (!policy) return null;
  return {
    key,
    mode: policies.mode ?? 'warning',
    calibration_status: policies.calibration_status ?? 'uncalibrated',
    ...policy,
  };
}

function estimateQuestionSetSeconds(questions, level) {
  const multiplier = LEVEL_MULTIPLIER[level] ?? 1;
  return (Array.isArray(questions) ? questions : []).reduce((total, question) => {
    const base = QUESTION_SECONDS[question?.type] ?? 60;
    return total + base * multiplier;
  }, 0);
}

export function estimateVariantActiveSeconds(variant) {
  const level = String(variant?.niveau ?? 'A2').toUpperCase();
  const multiplier = LEVEL_MULTIPLIER[level] ?? 1;
  const path = variant?.learning_path;
  const hasLearningPath = Array.isArray(path?.steps) && path.steps.length > 0;
  const questions = hasLearningPath
    ? path.steps.flatMap((step) => Array.isArray(step?.questions) ? step.questions : [])
    : (Array.isArray(variant?.questions) ? variant.questions : []);
  const questionSeconds = hasLearningPath
    ? path.steps.reduce((total, step) => total + estimateQuestionSetSeconds(step?.questions, level), 0)
    : estimateQuestionSetSeconds(questions, level);
  const instructionCount = hasLearningPath ? path.steps.length : (String(variant?.consigne ?? '').trim() ? 1 : 0);
  const instructionSeconds = instructionCount * 30 * multiplier;
  const scaffoldSeconds = Math.min(
    120,
    (Array.isArray(variant?.aides) ? variant.aides.length : 0) * 20,
  );
  const lessonDeclaredMinutes = finitePositive(path?.lesson?.estimated_minutes) ?? 0;
  const stepsDeclaredMinutes = hasLearningPath
    ? path.steps.reduce((total, step) => total + (finitePositive(step?.estimated_minutes) ?? 0), 0)
    : 0;
  const pathDeclaredMinutes = lessonDeclaredMinutes + stepsDeclaredMinutes;
  const calculatedSeconds = Math.round(
    questionSeconds + instructionSeconds + scaffoldSeconds + lessonDeclaredMinutes * 60,
  );
  const contractDeclaredMinutes = finitePositive(variant?.differentiation_contract?.estimated_minutes);
  const declaredMinutes = Math.max(contractDeclaredMinutes ?? 0, pathDeclaredMinutes);
  const declaredSeconds = declaredMinutes > 0 ? Math.round(declaredMinutes * 60) : null;
  const estimatedSeconds = Math.max(calculatedSeconds, declaredSeconds ?? 0);

  return {
    level,
    item_count: questions.length,
    step_count: hasLearningPath ? path.steps.length : 1,
    lesson_minutes: lessonDeclaredMinutes,
    estimated_seconds: estimatedSeconds,
    estimated_minutes: roundMinutes(estimatedSeconds),
    declared_seconds: declaredSeconds,
    declared_minutes: declaredSeconds == null ? null : roundMinutes(declaredSeconds),
    calculated_seconds: calculatedSeconds,
    calculated_minutes: roundMinutes(calculatedSeconds),
    basis: declaredSeconds == null
      ? 'question_type_heuristic'
      : hasLearningPath
        ? 'max_learning_path_and_question_type_heuristic'
        : 'max_declared_and_question_type_heuristic',
    confidence: 'low_uncalibrated',
  };
}
export function evaluateDifferentiatedDurationCoverage({
  variants,
  announcedMinutes,
  rules,
}) {
  const policy = resolveDifferentiatedDurationPolicy(rules, announcedMinutes);
  if (!policy) {
    return {
      status: 'unavailable',
      mode: 'warning',
      blocking: false,
      announced_minutes: finitePositive(announcedMinutes),
      calibration_status: 'uncalibrated',
      coverage_by_level: {},
      warnings: [{ code: 'DIFF_DURATION_POLICY_UNAVAILABLE' }],
    };
  }

  const list = Array.isArray(variants) ? variants : [];
  const warnings = [];
  const coverageByLevel = {};

  for (const level of LEVELS) {
    const estimates = list
      .filter((variant) => String(variant?.niveau ?? '').toUpperCase() === level)
      .map(estimateVariantActiveSeconds);
    const estimatedSeconds = estimates.reduce((sum, estimate) => sum + estimate.estimated_seconds, 0);
    const declaredSeconds = estimates.reduce((sum, estimate) => sum + (estimate.declared_seconds ?? 0), 0);
    const calculatedSeconds = estimates.reduce((sum, estimate) => sum + estimate.calculated_seconds, 0);
    const itemCount = estimates.reduce((sum, estimate) => sum + estimate.item_count, 0);
    const minimumItems = Number(policy.minimum_items_by_level?.[level] ?? 0);
    const estimatedMinutes = roundMinutes(estimatedSeconds);

    const levelWarnings = [];
    if (estimatedMinutes < policy.minimum_coverage_minutes) {
      levelWarnings.push({
        code: 'DIFF_DURATION_BELOW_MINIMUM',
        level,
        actual_minutes: estimatedMinutes,
        minimum_minutes: policy.minimum_coverage_minutes,
      });
    } else if (estimatedMinutes > policy.maximum_coverage_minutes) {
      levelWarnings.push({
        code: 'DIFF_DURATION_ABOVE_MAXIMUM',
        level,
        actual_minutes: estimatedMinutes,
        maximum_minutes: policy.maximum_coverage_minutes,
      });
    }
    if (itemCount < minimumItems) {
      levelWarnings.push({
        code: 'DIFF_ITEM_COUNT_BELOW_MINIMUM',
        level,
        actual_items: itemCount,
        minimum_items: minimumItems,
      });
    }

    warnings.push(...levelWarnings);
    coverageByLevel[level] = {
      estimated_minutes: estimatedMinutes,
      declared_minutes: roundMinutes(declaredSeconds),
      calculated_minutes: roundMinutes(calculatedSeconds),
      item_count: itemCount,
      minimum_items: minimumItems,
      minimum_coverage_minutes: policy.minimum_coverage_minutes,
      maximum_coverage_minutes: policy.maximum_coverage_minutes,
      status: levelWarnings.length ? 'warning' : 'pass',
      warnings: levelWarnings,
      estimates,
    };
  }

  return {
    status: warnings.length ? 'warning' : 'pass',
    mode: policy.mode,
    blocking: policy.mode === 'blocking' && warnings.length > 0,
    announced_minutes: finitePositive(announcedMinutes),
    policy_key: policy.key,
    calibration_status: policy.calibration_status,
    coverage_by_level: coverageByLevel,
    warnings,
  };
}