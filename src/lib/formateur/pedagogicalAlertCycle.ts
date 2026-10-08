/**
 * Cycle de signalements pédagogiques (Lots 5 / 5B) — logique pure, seuils explicites.
 * Persistance SQL : `public.pedagogical_alerts` (migration locale lot5b).
 * Transitions DB strictes : nouveau → confirme → classe (pas de saut).
 */

export const PEDAGOGICAL_ALERT_STATUSES = ["nouveau", "confirme", "classe"] as const;
export type PedagogicalAlertStatus = (typeof PEDAGOGICAL_ALERT_STATUSES)[number];

/** Règle documentée Lot 5 — jamais décidée par l’IA. */
export const REPEATED_DIFFICULTY_RULE = {
  id: "repeated_failure_or_max_help_7d",
  windowDays: 7,
  minFailures: 3,
  /** Recours répétés à l’aide la plus forte (niveau 3) sur la même sous-compétence. */
  minMaxHelpUses: 2,
  maxHelpLevel: 3,
} as const;

export type DifficultyEvidence = {
  eleveId: string;
  sousCompetence: string;
  failuresInWindow: number;
  maxHelpUsesInWindow: number;
  at: string; // ISO
};

export function evaluateRepeatedDifficultyAlert(
  evidence: DifficultyEvidence,
  now: Date = new Date(),
  rule = REPEATED_DIFFICULTY_RULE,
): { triggered: boolean; ruleId: typeof rule.id; reason: string | null } {
  const at = new Date(evidence.at);
  const ageMs = now.getTime() - at.getTime();
  const windowMs = rule.windowDays * 24 * 60 * 60 * 1000;
  if (Number.isNaN(at.getTime()) || ageMs > windowMs || ageMs < 0) {
    return { triggered: false, ruleId: rule.id, reason: null };
  }
  if (evidence.failuresInWindow >= rule.minFailures) {
    return {
      triggered: true,
      ruleId: rule.id,
      reason: `${evidence.failuresInWindow} échecs sur « ${evidence.sousCompetence} » en ${rule.windowDays} jours`,
    };
  }
  if (evidence.maxHelpUsesInWindow >= rule.minMaxHelpUses) {
    return {
      triggered: true,
      ruleId: rule.id,
      reason: `${evidence.maxHelpUsesInWindow} recours à l’aide niveau ${rule.maxHelpLevel} sur « ${evidence.sousCompetence} » en ${rule.windowDays} jours`,
    };
  }
  return { triggered: false, ruleId: rule.id, reason: null };
}

export type AlertTransitionResult =
  | { ok: true; status: PedagogicalAlertStatus; motifClassement: string | null }
  | { ok: false; reason: string };

/**
 * Transitions autorisées uniquement : nouveau → confirme → classe.
 * Motif de classement obligatoire pour `classe`. Pas de saut nouveau → classe.
 */
export function transitionPedagogicalAlert(input: {
  from: PedagogicalAlertStatus;
  to: PedagogicalAlertStatus;
  motifClassement?: string | null;
}): AlertTransitionResult {
  const { from, to } = input;
  const motif = typeof input.motifClassement === "string" ? input.motifClassement.trim() : "";

  if (from === to) {
    return { ok: true, status: from, motifClassement: from === "classe" ? motif || null : null };
  }
  if (from === "nouveau" && to === "confirme") {
    return { ok: true, status: "confirme", motifClassement: null };
  }
  if (from === "confirme" && to === "classe") {
    if (!motif) return { ok: false, reason: "motif_classement_requis" };
    return { ok: true, status: "classe", motifClassement: motif };
  }
  return { ok: false, reason: "transition_interdite" };
}
