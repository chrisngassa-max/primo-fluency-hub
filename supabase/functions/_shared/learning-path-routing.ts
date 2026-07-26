export interface LearningPathAdaptivePolicy {
  remediation_below: number;
  consolidation_from: number;
  extension_from: number;
}

export type LearningPathDecision = "remediation" | "consolidation" | "extension";

export interface LearningPathOutcome {
  decision: LearningPathDecision;
  learnerMessage: string;
  nextKind: "remediation" | "practice" | "extension";
  nextStepOrder: number | null;
}

export function resolveLearningPathOutcome(
  score: number,
  policy?: Partial<LearningPathAdaptivePolicy> | null,
  currentStepOrder = 1,
  stepCount = 1,
): LearningPathOutcome {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const remediationBelow = Number(policy?.remediation_below ?? 60);
  const extensionFrom = Number(policy?.extension_from ?? 80);
  const safeCurrent = Math.max(1, Math.round(currentStepOrder));
  const safeCount = Math.max(1, Math.round(stepCount));

  if (safeScore < remediationBelow) {
    return {
      decision: "remediation",
      nextKind: "remediation",
      nextStepOrder: 1,
      learnerMessage: "Reprends l’objectif avec davantage d’aides et un exemple guidé.",
    };
  }
  if (safeScore >= extensionFrom) {
    const candidate = safeCurrent + 2;
    return {
      decision: "extension",
      nextKind: "extension",
      nextStepOrder: candidate <= safeCount ? candidate : null,
      learnerMessage: "Tu peux poursuivre avec une activité plus autonome et plus exigeante.",
    };
  }
  const candidate = safeCurrent + 1;
  return {
    decision: "consolidation",
    nextKind: "practice",
    nextStepOrder: candidate <= safeCount ? candidate : null,
    learnerMessage: "Poursuis avec une activité de consolidation au même niveau.",
  };
}