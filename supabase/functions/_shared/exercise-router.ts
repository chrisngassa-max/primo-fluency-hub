export type { CompetenceTCF, RouterDecision } from "./tcf-routing-referential.ts";
import type { CompetenceTCF, RouterDecision, ScoreScale } from "./tcf-routing-referential.ts";
import {
  buildTcfRoutingResult,
  resolveRoutingFromProfile,
  type ProfileRoutingSignals,
  type TcfRoutingRuleRow,
  type TcfScoreThresholdRow,
} from "./tcf-routing-referential.ts";

export type RoutingPhase = "phase2_tronc_commun" | "phase3_atelier" | "phase5_devoir";

export type {
  ProfileRoutingSignals,
  ScoreScale,
  TcfRoutingRuleRow,
  TcfScoreThresholdRow,
} from "./tcf-routing-referential.ts";

export interface StudentProfileRouterSignals extends ProfileRoutingSignals {
  fragilite_principale: CompetenceTCF;
}

export interface RouterContext {
  profil: StudentProfileRouterSignals;
  phase: RoutingPhase;
  competenceCible?: CompetenceTCF;
  scorePhase2?: number;
  scorePhase3?: number;
  scoreDernierExercice?: number;
  scoreScale?: ScoreScale;
  nbReussitesConsecutives?: number;
  nbEchecsConsecutifs?: number;
  exerciceNonFait?: boolean;
  exerciceNonTermine?: boolean;
  tempsTropLong?: boolean;
  stagnationMemeCompetence?: boolean;
  tcfRules?: TcfRoutingRuleRow[];
  tcfThresholds?: TcfScoreThresholdRow[];
}

export interface TcfRuleSnapshot {
  rule_id: string;
  variante_exercice: string;
  type_remediation: string;
  message_apprenant: string;
  niveau: string;
  epreuve: string;
  score_min: number;
  score_max: number;
  score_scale: string;
}

export interface RoutingResult {
  ruleId: string;
  conditionLabel: string;
  decision: RouterDecision;
  devoirGenere: string;
  reasonStudent: string;
  reasonTrainer: string;
  tcfRule?: TcfRuleSnapshot;
  routingSource?: "tcf_referential" | "legacy_percent";
}

interface RouterRule {
  id: string;
  priority: number;
  conditionLabel: string;
  decision: RouterDecision;
  devoirGenere: string;
  applies: (context: RouterContext) => boolean;
  explain: (context: RouterContext) => Pick<RoutingResult, "reasonStudent" | "reasonTrainer">;
}

function scoreForContext(context: RouterContext): number | null {
  const score = context.phase === "phase2_tronc_commun"
    ? context.scorePhase2 ?? context.scoreDernierExercice
    : context.phase === "phase3_atelier"
      ? context.scorePhase3 ?? context.scoreDernierExercice
      : context.scoreDernierExercice ?? context.scorePhase3 ?? context.scorePhase2;

  return typeof score === "number" && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;
}

function competenceLabel(context: RouterContext): string {
  return context.competenceCible ?? context.profil.fragilite_principale;
}

function tryTcfReferentialRouting(context: RouterContext): RoutingResult | null {
  const rules = context.tcfRules;
  if (!rules?.length) return null;

  const competence = context.competenceCible ?? context.profil.fragilite_principale;
  const percentScore = scoreForContext(context) ?? undefined;
  const scoreScale = context.scoreScale ?? "percent";

  const resolution = resolveRoutingFromProfile(
    context.profil,
    competence,
    rules,
    context.tcfThresholds ?? [],
    percentScore,
    scoreScale,
  );

  if (!resolution.rule || !resolution.niveau) return null;

  return buildTcfRoutingResult(
    resolution.rule,
    competence,
    resolution.niveau,
    resolution.tcfScore,
    resolution.scoreScale,
    percentScore,
  );
}

export const REGLES_MOTEUR: RouterRule[] = [
  {
    id: "R1",
    priority: 1,
    conditionLabel: "score_phase2 >= 80 AND seances_consecutives_80 >= 2",
    decision: "upgrade_support_phase2",
    devoirGenere: "niveau_superieur_autonomie_complete",
    applies: (context) =>
      context.phase === "phase2_tronc_commun"
      && (context.scorePhase2 ?? -1) >= 80
      && (context.nbReussitesConsecutives ?? 0) >= 2,
    explain: (context) => ({
      reasonStudent: "Activite personnalisee : continuer avec un support plus autonome.",
      reasonTrainer: `R1 declenchee : ${context.scorePhase2}% en phase 2 avec ${context.nbReussitesConsecutives ?? 0} reussites consecutives.`,
    }),
  },
  {
    id: "R2",
    priority: 2,
    conditionLabel: "score < 60",
    decision: "remediation_prioritaire",
    devoirGenere: "exo_guide_meme_niveau_outils_aide_fournis",
    applies: (context) => {
      const score = scoreForContext(context);
      return score != null && score < 60;
    },
    explain: (context) => ({
      reasonStudent: `Activite personnalisee : reprendre ${competenceLabel(context)} avec plus d'aides.`,
      reasonTrainer: `R2 declenchee : score ${scoreForContext(context)}% inferieur a 60%.`,
    }),
  },
  {
    id: "R3",
    priority: 3,
    conditionLabel: "score >= 60 AND score <= 79",
    decision: "consolidation",
    devoirGenere: "exo_semi_guide_meme_niveau_plus_exigeant",
    applies: (context) => {
      const score = scoreForContext(context);
      return score != null && score >= 60 && score <= 79;
    },
    explain: (context) => ({
      reasonStudent: `Activite personnalisee : consolider ${competenceLabel(context)} avec un exercice guide.`,
      reasonTrainer: `R3 declenchee : score ${scoreForContext(context)}% entre 60% et 79%.`,
    }),
  },
  {
    id: "R4",
    priority: 4,
    conditionLabel: "score >= 80 AND seances_consecutives_80 < 2",
    decision: "exercice_equivalent_ou_superieur",
    devoirGenere: "meme_competence_niveau_plus_05_moins_aides",
    applies: (context) => {
      const score = scoreForContext(context);
      return score != null && score >= 80 && (context.nbReussitesConsecutives ?? 0) < 2;
    },
    explain: (context) => ({
      reasonStudent: `Activite personnalisee : poursuivre ${competenceLabel(context)} avec un peu plus d'autonomie.`,
      reasonTrainer: `R4 declenchee : score ${scoreForContext(context)}% mais moins de deux reussites consecutives.`,
    }),
  },
  {
    id: "R10",
    priority: 10,
    conditionLabel: "exercice_non_fait",
    decision: "reproposition_automatique",
    devoirGenere: "meme_exercice_ou_version_simplifiee",
    applies: (context) => context.exerciceNonFait === true,
    explain: () => ({
      reasonStudent: "Activite personnalisee : terminer l'objectif commence avec une version adaptee.",
      reasonTrainer: "R10 declenchee : exercice non fait, reproposition automatique.",
    }),
  },
];

function routeLegacyPercent(context: RouterContext): RoutingResult {
  const rule = [...REGLES_MOTEUR]
    .sort((a, b) => a.priority - b.priority)
    .find((candidate) => candidate.applies(context));

  if (!rule) {
    return {
      ruleId: "R0",
      conditionLabel: "aucune_regle_prioritaire",
      decision: "maintien_parcours",
      devoirGenere: "exercice_meme_niveau",
      reasonStudent: `Activite personnalisee : continuer le travail sur ${competenceLabel(context)}.`,
      reasonTrainer: "Aucune regle prioritaire declenchee : maintien du parcours actuel.",
      routingSource: "legacy_percent",
    };
  }

  return {
    ruleId: rule.id,
    conditionLabel: rule.conditionLabel,
    decision: rule.decision,
    devoirGenere: rule.devoirGenere,
    ...rule.explain(context),
    routingSource: "legacy_percent",
  };
}

export function routeExercise(context: RouterContext): RoutingResult {
  // Regles comportementales prioritaires (R1, R10) avant le referentiel TCF
  const behavioralRule = [...REGLES_MOTEUR]
    .filter((r) => r.id === "R1" || r.id === "R10")
    .sort((a, b) => a.priority - b.priority)
    .find((candidate) => candidate.applies(context));

  if (behavioralRule) {
    return {
      ruleId: behavioralRule.id,
      conditionLabel: behavioralRule.conditionLabel,
      decision: behavioralRule.decision,
      devoirGenere: behavioralRule.devoirGenere,
      ...behavioralRule.explain(context),
      routingSource: "legacy_percent",
    };
  }

  const tcfResult = tryTcfReferentialRouting(context);
  if (tcfResult) return tcfResult;

  return routeLegacyPercent(context);
}
