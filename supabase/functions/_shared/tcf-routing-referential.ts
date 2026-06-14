export type CompetenceTCF = "CO" | "CE" | "EE" | "EO";

export type RouterDecision =
  | "upgrade_support_phase2"
  | "remediation_prioritaire"
  | "consolidation"
  | "exercice_equivalent_ou_superieur"
  | "reproposition_automatique"
  | "maintien_parcours";

export type ScoreScale = "percent" | "tcf_699" | "tcf_13" | "evaluate_0_10";
export type NiveauCECRL = "A0" | "A1" | "A2" | "B1" | "B2";

export interface TcfRoutingRuleRow {
  rule_id: string;
  niveau: string;
  epreuve: string;
  score_min: number;
  score_max: number;
  score_scale: string;
  variante_exercice: string;
  type_remediation: string;
  message_apprenant: string;
  contre_indication?: string | null;
  erreur_type?: string | null;
  signal_qualitatif?: string | null;
  profil_entree_specifique?: string;
  plafond_tcf_irn?: boolean;
  actif?: boolean;
  router_decision?: string | null;
}

export interface TcfScoreThresholdRow {
  niveau: string;
  epreuve: string;
  score_min: number;
  score_max: number;
  score_scale: string;
  niveau_cecrl: string;
}

export interface ProfileRoutingSignals {
  niveau_co?: string | null;
  niveau_ce?: string | null;
  niveau_ee?: string | null;
  niveau_eo?: string | null;
  niveau_source?: string | null;
  has_baseline?: boolean;
}

export interface TcfRoutingResolution {
  rule: TcfRoutingRuleRow | null;
  niveau: NiveauCECRL | null;
  tcfScore: number | null;
  scoreScale: ScoreScale | null;
}

const CECRL_LEVELS: NiveauCECRL[] = ["A0", "A1", "A2", "B1", "B2"];

export function isValidCecrlLevel(value: unknown): value is NiveauCECRL {
  return typeof value === "string" && CECRL_LEVELS.includes(value as NiveauCECRL);
}

export function scoreScaleForCompetence(competence: CompetenceTCF): "tcf_699" | "tcf_13" {
  return competence === "CO" || competence === "CE" ? "tcf_699" : "tcf_13";
}

/** Fallback interne : pourcentage 0-100 → niveau CECRL (aligné studentProfileV4). */
export function percentToCecrlLevel(score: number): NiveauCECRL {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s < 40) return "A0";
  if (s < 60) return "A1";
  if (s < 70) return "A2";
  if (s < 80) return "B1";
  return "B2";
}

/** Approximation % interne → score TCF /699 pour CO/CE. */
export function percentToTcf699(percent: number): number {
  const p = Math.max(0, Math.min(100, percent));
  return Math.round(100 + (p / 100) * 599);
}

/** Approximation % interne → bande TCF 1-13 pour EE/EO. */
export function percentToTcf13(percent: number): number {
  return evaluateScoreToTcf13(percent / 10);
}

/**
 * tcf-evaluate-answer (0-10) → bande TCF 1-13 pour routage EE/EO.
 * Mapping linéaire 0→1, 10→13 ; paliers bas conservateurs (0-2→1).
 */
export function evaluateScoreToTcf13(score: number): number {
  const s = Math.max(0, Math.min(10, Math.round(score)));
  if (s <= 2) return 1;
  return Math.max(1, Math.min(13, Math.round(1 + (s / 10) * 12)));
}

export function normalizeScoreForScale(
  score: number,
  scale: ScoreScale,
  competence: CompetenceTCF,
): { value: number; scale: "tcf_699" | "tcf_13" } {
  const targetScale = scoreScaleForCompetence(competence);
  if (scale === "tcf_699" || scale === "tcf_13") {
    return { value: score, scale: scale as "tcf_699" | "tcf_13" };
  }
  if (scale === "evaluate_0_10") {
    return { value: evaluateScoreToTcf13(score), scale: "tcf_13" };
  }
  // percent
  return targetScale === "tcf_699"
    ? { value: percentToTcf699(score), scale: "tcf_699" }
    : { value: percentToTcf13(score), scale: "tcf_13" };
}

export function tcfScoreToNiveau(
  score: number,
  epreuve: CompetenceTCF,
  scoreScale: "tcf_699" | "tcf_13",
  thresholds: TcfScoreThresholdRow[],
): NiveauCECRL | null {
  const match = thresholds.find((row) =>
    row.epreuve === epreuve
    && row.score_scale === scoreScale
    && score >= row.score_min
    && score <= row.score_max
  );
  return match && isValidCecrlLevel(match.niveau_cecrl) ? match.niveau_cecrl : null;
}

export function getNiveauForCompetence(
  profile: ProfileRoutingSignals,
  competence: CompetenceTCF,
): NiveauCECRL | null {
  const key = {
    CO: profile.niveau_co,
    CE: profile.niveau_ce,
    EE: profile.niveau_ee,
    EO: profile.niveau_eo,
  }[competence];
  return isValidCecrlLevel(key) ? key : null;
}

export function hasTcfRoutingProfile(profile: ProfileRoutingSignals): boolean {
  if (profile.has_baseline) return true;
  if (profile.niveau_source === "tcf_irn_officiel") return true;
  return COMPETENCES.some((c) => getNiveauForCompetence(profile, c) != null);
}

const COMPETENCES: CompetenceTCF[] = ["CO", "CE", "EE", "EO"];

export function findRoutingRule(
  niveau: string,
  epreuve: CompetenceTCF,
  score: number,
  scoreScale: "tcf_699" | "tcf_13",
  rules: TcfRoutingRuleRow[],
): TcfRoutingRuleRow | null {
  const candidates = rules.filter((rule) =>
    (rule.actif !== false)
    && rule.niveau === niveau
    && rule.epreuve === epreuve
    && rule.score_scale === scoreScale
    && score >= rule.score_min
    && score <= rule.score_max
  );

  if (candidates.length === 0) {
    // Sans score dans la bande : une seule règle par niveau×épreuve en V3
    const byNiveau = rules.filter((rule) =>
      (rule.actif !== false)
      && rule.niveau === niveau
      && rule.epreuve === epreuve
      && rule.score_scale === scoreScale
    );
    return byNiveau.length === 1 ? byNiveau[0] : null;
  }

  return candidates[0];
}

const ROUTER_DECISION_VALUES = new Set<RouterDecision>([
  "upgrade_support_phase2",
  "remediation_prioritaire",
  "consolidation",
  "exercice_equivalent_ou_superieur",
  "reproposition_automatique",
  "maintien_parcours",
]);

function isRouterDecision(value: unknown): value is RouterDecision {
  return typeof value === "string" && ROUTER_DECISION_VALUES.has(value as RouterDecision);
}

/** Mappe router_decision explicite ou position dans la bande TCF / équivalent %. */
export function mapTcfRuleToRouterDecision(
  rule: TcfRoutingRuleRow,
  score: number | null,
  scoreScale: ScoreScale | null,
): RouterDecision {
  if (rule.router_decision && isRouterDecision(rule.router_decision)) {
    return rule.router_decision;
  }

  if (score != null && scoreScale === "percent") {
    if (score < 60) return "remediation_prioritaire";
    if (score <= 79) return "consolidation";
    return "exercice_equivalent_ou_superieur";
  }

  if (score != null) {
    const range = rule.score_max - rule.score_min;
    const position = range > 0 ? (score - rule.score_min) / range : 0.5;
    if (position < 0.33) return "remediation_prioritaire";
    if (position < 0.66) return "consolidation";
    return "exercice_equivalent_ou_superieur";
  }

  return "consolidation";
}

export function resolveRoutingFromProfile(
  profile: ProfileRoutingSignals,
  competence: CompetenceTCF,
  rules: TcfRoutingRuleRow[],
  thresholds: TcfScoreThresholdRow[],
  score?: number,
  scoreScale: ScoreScale = "percent",
): TcfRoutingResolution {
  if (!hasTcfRoutingProfile(profile)) {
    return { rule: null, niveau: null, tcfScore: null, scoreScale: null };
  }

  let niveau = getNiveauForCompetence(profile, competence);
  let tcfScore: number | null = null;
  let resolvedScale: "tcf_699" | "tcf_13" | null = null;

  if (score != null && Number.isFinite(score)) {
    const normalized = normalizeScoreForScale(score, scoreScale, competence);
    tcfScore = normalized.value;
    resolvedScale = normalized.scale;
    if (!niveau) {
      niveau = tcfScoreToNiveau(tcfScore, competence, resolvedScale, thresholds);
    }
  }

  if (!niveau || niveau === "A0") {
    return { rule: null, niveau, tcfScore, scoreScale: resolvedScale };
  }

  if (tcfScore == null || resolvedScale == null) {
    resolvedScale = scoreScaleForCompetence(competence);
    const fallback = rules.find((r) =>
      r.niveau === niveau && r.epreuve === competence && r.score_scale === resolvedScale
    );
    if (fallback) {
      tcfScore = Math.round((fallback.score_min + fallback.score_max) / 2);
    }
  }

  if (tcfScore == null || resolvedScale == null) {
    return { rule: null, niveau, tcfScore: null, scoreScale: null };
  }

  const rule = findRoutingRule(niveau, competence, tcfScore, resolvedScale, rules);
  return { rule, niveau, tcfScore, scoreScale: resolvedScale };
}

export function buildTcfRoutingResult(
  rule: TcfRoutingRuleRow,
  competence: CompetenceTCF,
  niveau: string,
  tcfScore: number | null,
  scoreScale: ScoreScale | null,
  percentScore?: number,
): {
  ruleId: string;
  conditionLabel: string;
  decision: RouterDecision;
  devoirGenere: string;
  reasonStudent: string;
  reasonTrainer: string;
  tcfRule: {
    rule_id: string;
    variante_exercice: string;
    type_remediation: string;
    message_apprenant: string;
    niveau: string;
    epreuve: string;
    score_min: number;
    score_max: number;
    score_scale: string;
  };
  routingSource: "tcf_referential";
} {
  const decision = mapTcfRuleToRouterDecision(rule, percentScore ?? tcfScore, scoreScale);
  const scoreLabel = tcfScore != null && scoreScale
    ? `score TCF ${tcfScore} (${scoreScale})`
    : "niveau TCF";

  return {
    ruleId: rule.rule_id,
    conditionLabel: `${niveau}_${competence} | ${rule.score_min}-${rule.score_max} ${rule.score_scale}`,
    decision,
    devoirGenere: rule.variante_exercice.slice(0, 120),
    reasonStudent: rule.message_apprenant,
    reasonTrainer: `Regle V3 ${rule.rule_id} : ${scoreLabel}, remediation=${rule.type_remediation.slice(0, 80)}.`,
    tcfRule: {
      rule_id: rule.rule_id,
      variante_exercice: rule.variante_exercice,
      type_remediation: rule.type_remediation,
      message_apprenant: rule.message_apprenant,
      niveau,
      epreuve: competence,
      score_min: rule.score_min,
      score_max: rule.score_max,
      score_scale: rule.score_scale,
    },
    routingSource: "tcf_referential",
  };
}
