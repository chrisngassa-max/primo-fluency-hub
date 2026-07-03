/**
 * Moteur IPE (Indicateur de Préparation à l'Examen) — algo_version 1.
 *
 * Fonction PURE : aucun I/O, aucune IA. Configurable via readiness_config_v1.json
 * ou objet passé en paramètre (tests, edge function).
 */
import configJson from "./readiness_config_v1.json" with { type: "json" };

export type Objectif = "A2" | "B1";
export type CompetenceEpreuve = "CO" | "CE" | "EE" | "EO";
export type CompetenceIPE = CompetenceEpreuve | "ST" | "GLOBAL";
export type Confiance = "haute" | "moyenne" | "insuffisante";
export type Bande = "fragile" | "construction" | "proche_seuil" | "pret";

export interface ReadinessConfig {
  algo_version: number;
  objectifs: Record<
    Objectif,
    { libelle: string; niveau_requis_scale: number }
  >;
  bands: Record<
    Bande,
    { min: number; max: number; message_formateur: string; recommandation: string }
  >;
  competency_weights: Record<CompetenceEpreuve, number>;
  structural_moderator: {
    enabled: boolean;
    applies_to: CompetenceEpreuve[];
    cap_value: number;
    fragile_threshold_by_objectif: Record<Objectif, number>;
  };
  component_weights: {
    maitrise_periode: number;
    preuve_examen: number;
    niveau_valide: number;
    penalite_erreurs: number;
    fallback_if_no_exam: {
      maitrise_periode: number;
      niveau_valide: number;
      penalite_erreurs: number;
    };
  };
  maitrise_periode: {
    window_days: number;
    min_success_rate_by_objectif: Record<Objectif, number>;
  };
  penalite_erreurs: {
    normalisation: number;
    window_days: number;
    cap: number;
  };
  structures_socle: {
    min_success_rate_by_objectif: Record<Objectif, number>;
  };
  confidence_rules: {
    min_items_evaluated_28d: number;
    message_insuffisant: string;
    staleness_days: number;
  };
}

export interface MaitrisePeriodeStats {
  itemsEvaluated: number;
  successCount: number;
  successRate: number;
}

export interface PreuveExamen {
  hasExam: boolean;
  scorePct: number | null;
}

export interface ErrorEventInput {
  typeCode: string;
  graviteBase: number;
  createdAt: string;
  isNonResolue: boolean;
}

export interface CompetenceIPEInput {
  competence: CompetenceIPE;
  objectif: Objectif;
  niveauValide: number;
  maitrisePeriode: MaitrisePeriodeStats;
  preuveExamen: PreuveExamen;
  errorEvents: ErrorEventInput[];
  daysSinceLastActivity?: number | null;
}

export interface ComposantesIPE {
  maitrise_periode: number;
  preuve_examen: number | null;
  niveau_valide: number;
  penalite_erreurs: number;
  penalite_raw: number;
  weights_used: Record<string, number>;
  structural_cap_applied?: boolean;
}

export interface CompetenceIPEResult {
  score: number;
  bande: Bande;
  confiance: Confiance;
  composantes: ComposantesIPE;
}

export interface GlobalIPEInput {
  objectif: Objectif;
  competencies: Record<CompetenceEpreuve, CompetenceIPEResult>;
  st: CompetenceIPEResult;
}

const SUCCESS_THRESHOLD_PCT = 60;

export function loadConfig(override?: ReadinessConfig): ReadinessConfig {
  return override ?? (configJson as unknown as ReadinessConfig);
}

export function getNiveauRequisScale(
  objectif: Objectif,
  config: ReadinessConfig = loadConfig(),
): number {
  return config.objectifs[objectif].niveau_requis_scale;
}

export function getMinSuccessRate(
  competence: CompetenceIPE,
  objectif: Objectif,
  config: ReadinessConfig = loadConfig(),
): number {
  if (competence === "ST") {
    return config.structures_socle.min_success_rate_by_objectif[objectif];
  }
  return config.maitrise_periode.min_success_rate_by_objectif[objectif];
}

export function scoreToBande(
  score: number,
  config: ReadinessConfig = loadConfig(),
): Bande {
  const { bands } = config;
  if (score <= bands.fragile.max) return "fragile";
  if (score <= bands.construction.max) return "construction";
  if (score <= bands.proche_seuil.max) return "proche_seuil";
  return "pret";
}

function roundScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

function computeMaitriseComponent(
  stats: MaitrisePeriodeStats,
  minSuccessRate: number,
): number {
  if (stats.itemsEvaluated === 0) return 0;
  return roundScore((stats.successRate / minSuccessRate) * 100);
}

function computeNiveauValideComponent(
  niveauValide: number,
  niveauRequis: number,
): number {
  if (niveauRequis <= 0) return 0;
  return roundScore((niveauValide / niveauRequis) * 100);
}

function computePenaliteRaw(
  events: ErrorEventInput[],
  config: ReadinessConfig,
): number {
  const sum = events
    .filter((e) => e.isNonResolue)
    .reduce((acc, e) => acc + e.graviteBase / 5, 0);
  return Math.min(
    config.penalite_erreurs.cap,
    sum / config.penalite_erreurs.normalisation,
  );
}

function computePenaliteComponent(penaliteRaw: number): number {
  return roundScore((1 - penaliteRaw) * 100);
}

function computeConfiance(
  itemsEvaluated: number,
  hasExam: boolean,
  daysSinceLastActivity: number | null | undefined,
  config: ReadinessConfig,
): Confiance {
  if (itemsEvaluated < config.confidence_rules.min_items_evaluated_28d) {
    return "insuffisante";
  }
  if (
    daysSinceLastActivity != null &&
    daysSinceLastActivity > config.confidence_rules.staleness_days
  ) {
    return "insuffisante";
  }
  if (!hasExam) return "moyenne";
  return "haute";
}

function mergeConfianceLevels(levels: Confiance[]): Confiance {
  if (levels.includes("insuffisante")) return "insuffisante";
  if (levels.includes("moyenne")) return "moyenne";
  return "haute";
}

export function computeWeightedScore(
  components: {
    maitrise_periode: number;
    niveau_valide: number;
    penalite_erreurs: number;
    preuve_examen?: number | null;
  },
  hasExam: boolean,
  config: ReadinessConfig = loadConfig(),
): { score: number; weights_used: Record<string, number> } {
  const weights = hasExam
    ? {
        maitrise_periode: config.component_weights.maitrise_periode,
        preuve_examen: config.component_weights.preuve_examen,
        niveau_valide: config.component_weights.niveau_valide,
        penalite_erreurs: config.component_weights.penalite_erreurs,
      }
    : {
        maitrise_periode:
          config.component_weights.fallback_if_no_exam.maitrise_periode,
        niveau_valide:
          config.component_weights.fallback_if_no_exam.niveau_valide,
        penalite_erreurs:
          config.component_weights.fallback_if_no_exam.penalite_erreurs,
      };

  let score = 0;
  score += weights.maitrise_periode * components.maitrise_periode;
  score += weights.niveau_valide * components.niveau_valide;
  score += weights.penalite_erreurs * components.penalite_erreurs;
  if (hasExam && components.preuve_examen != null && "preuve_examen" in weights) {
    score += (weights as Record<string, number>).preuve_examen *
      components.preuve_examen;
  }

  return { score: roundScore(score), weights_used: weights };
}

export function computeCompetenceIPE(
  input: CompetenceIPEInput,
  config: ReadinessConfig = loadConfig(),
): CompetenceIPEResult {
  const { competence, objectif } = input;
  if (competence === "GLOBAL") {
    throw new Error("Use computeGlobalIPE for GLOBAL competence");
  }

  const minSuccessRate = getMinSuccessRate(competence, objectif, config);
  const niveauRequis = getNiveauRequisScale(objectif, config);
  const penaliteRaw = computePenaliteRaw(input.errorEvents, config);

  const componentValues = {
    maitrise_periode: computeMaitriseComponent(
      input.maitrisePeriode,
      minSuccessRate,
    ),
    niveau_valide: computeNiveauValideComponent(
      input.niveauValide,
      niveauRequis,
    ),
    penalite_erreurs: computePenaliteComponent(penaliteRaw),
    preuve_examen: input.preuveExamen.hasExam
      ? roundScore(input.preuveExamen.scorePct ?? 0)
      : null,
  };

  const { score, weights_used } = computeWeightedScore(
    componentValues,
    input.preuveExamen.hasExam,
    config,
  );

  const confiance = computeConfiance(
    input.maitrisePeriode.itemsEvaluated,
    input.preuveExamen.hasExam,
    input.daysSinceLastActivity,
    config,
  );

  return {
    score,
    bande: scoreToBande(score, config),
    confiance,
    composantes: {
      ...componentValues,
      penalite_raw: penaliteRaw,
      weights_used,
    },
  };
}

export function applyStructuralModerator(
  scores: Record<CompetenceEpreuve, number>,
  stScore: number,
  objectif: Objectif,
  config: ReadinessConfig = loadConfig(),
): { scores: Record<CompetenceEpreuve, number>; capApplied: boolean } {
  const mod = config.structural_moderator;
  if (!mod.enabled) return { scores, capApplied: false };

  const threshold = mod.fragile_threshold_by_objectif[objectif];
  if (stScore >= threshold) return { scores, capApplied: false };

  const capped = { ...scores };
  let capApplied = false;
  for (const comp of mod.applies_to) {
    if (capped[comp] > mod.cap_value) {
      capped[comp] = mod.cap_value;
      capApplied = true;
    }
  }
  return { scores: capped, capApplied };
}

export function computeGlobalIPE(
  input: GlobalIPEInput,
  config: ReadinessConfig = loadConfig(),
): CompetenceIPEResult {
  const rawScores: Record<CompetenceEpreuve, number> = {
    CO: input.competencies.CO.score,
    CE: input.competencies.CE.score,
    EE: input.competencies.EE.score,
    EO: input.competencies.EO.score,
  };

  const { scores: moderated, capApplied } = applyStructuralModerator(
    rawScores,
    input.st.score,
    input.objectif,
    config,
  );

  const w = config.competency_weights;
  const score = roundScore(
    w.CO * moderated.CO +
      w.CE * moderated.CE +
      w.EE * moderated.EE +
      w.EO * moderated.EO,
  );

  const confiance = mergeConfianceLevels([
    input.competencies.CO.confiance,
    input.competencies.CE.confiance,
    input.competencies.EE.confiance,
    input.competencies.EO.confiance,
    input.st.confiance,
  ]);

  return {
    score,
    bande: scoreToBande(score, config),
    confiance,
    composantes: {
      maitrise_periode: roundScore(
        (moderated.CO + moderated.CE + moderated.EE + moderated.EO) / 4,
      ),
      preuve_examen: null,
      niveau_valide: roundScore(
        (input.competencies.CO.composantes.niveau_valide +
          input.competencies.CE.composantes.niveau_valide +
          input.competencies.EE.composantes.niveau_valide +
          input.competencies.EO.composantes.niveau_valide) / 4,
      ),
      penalite_erreurs: roundScore(
        (input.competencies.CO.composantes.penalite_erreurs +
          input.competencies.CE.composantes.penalite_erreurs +
          input.competencies.EE.composantes.penalite_erreurs +
          input.competencies.EO.composantes.penalite_erreurs) / 4,
      ),
      penalite_raw: roundScore(
        (input.competencies.CO.composantes.penalite_raw +
          input.competencies.CE.composantes.penalite_raw +
          input.competencies.EE.composantes.penalite_raw +
          input.competencies.EO.composantes.penalite_raw) / 4,
      ),
      weights_used: config.competency_weights as unknown as Record<string, number>,
      structural_cap_applied: capApplied,
    },
  };
}

export function isResultSuccess(score: number): boolean {
  return score >= SUCCESS_THRESHOLD_PCT;
}

export function markNonResolvedErrors<
  T extends { typeCode: string; createdAt: string; isNonResolue?: boolean },
>(
  errorEvents: T[],
  interventions: Array<{ typeCode: string | null; createdAt: string }>,
): Array<T & { isNonResolue: boolean }> {
  const sortedInterventions = [...interventions].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );

  return errorEvents.map((ev) => {
    const priorIntervention = sortedInterventions
      .filter(
        (i) =>
          i.typeCode === ev.typeCode &&
          i.createdAt < ev.createdAt,
      )
      .pop();
    return {
      ...ev,
      isNonResolue: !!priorIntervention,
    };
  });
}

export function buildMaitriseStats(
  results: Array<{ score: number }>,
): MaitrisePeriodeStats {
  const itemsEvaluated = results.length;
  const successCount = results.filter((r) => isResultSuccess(r.score)).length;
  const successRate = itemsEvaluated > 0
    ? (successCount / itemsEvaluated) * 100
    : 0;
  return { itemsEvaluated, successCount, successRate };
}

export function buildUniformCompetenceInput(
  competence: CompetenceIPE,
  objectif: Objectif,
  targetScorePct: number,
  opts: {
    itemsEvaluated?: number;
    hasExam?: boolean;
    niveauValide?: number;
  } = {},
): CompetenceIPEInput {
  const niveauRequis = getNiveauRequisScale(objectif);
  const items = opts.itemsEvaluated ?? 20;
  const hasExam = opts.hasExam ?? true;
  const niveauValide = opts.niveauValide ??
    (targetScorePct / 100) * niveauRequis;

  return {
    competence,
    objectif,
    niveauValide,
    maitrisePeriode: {
      itemsEvaluated: items,
      successCount: Math.round(items * (targetScorePct / 100)),
      successRate: targetScorePct,
    },
    preuveExamen: {
      hasExam,
      scorePct: hasExam ? targetScorePct : null,
    },
    errorEvents: [],
    daysSinceLastActivity: 1,
  };
}
