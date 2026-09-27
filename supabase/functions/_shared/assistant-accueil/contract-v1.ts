/**
 * Contrat exécutable — assistant d'accueil et de navigation.
 * Version : accueil-navigation-v1
 * Le serveur applique cette matrice avant tout appel de modèle.
 */

export const CONTRACT_VERSION = "accueil-navigation-v1" as const;

export const ASSISTANT_TOOLS = [
  "open_route",
  "deliver_validated_hint",
  "replay_audio_segment",
  "recommend_next_activity",
  "flag_help_needed",
] as const;

export type AssistantTool = (typeof ASSISTANT_TOOLS)[number];

export type ActivityMode = "entrainement" | "devoir" | "evaluation";

export const MODE_TOOL_MATRIX = {
  entrainement: {
    open_route: { allowed: true as const, scope: "whitelist_entrainement" as const },
    deliver_validated_hint: { allowed: true as const, maxLevel: 3 as const },
    replay_audio_segment: { allowed: "conditional" as const, rule: "exercice" as const },
    recommend_next_activity: { allowed: true as const },
    flag_help_needed: { allowed: true as const, kind: "pedagogique" as const },
  },
  devoir: {
    open_route: { allowed: true as const, scope: "devoir_courant" as const },
    deliver_validated_hint: { allowed: true as const, maxLevel: 1 as const },
    replay_audio_segment: { allowed: "conditional" as const, rule: "contrat_devoir" as const },
    recommend_next_activity: { allowed: "conditional" as const, rule: "apres_remise" as const },
    flag_help_needed: { allowed: true as const, kind: "pedagogique" as const },
  },
  evaluation: {
    open_route: { allowed: true as const, scope: "ecrans_evaluation" as const },
    deliver_validated_hint: { allowed: false as const },
    replay_audio_segment: { allowed: false as const },
    recommend_next_activity: { allowed: false as const },
    flag_help_needed: { allowed: true as const, kind: "technique" as const },
  },
} as const;

/** Conservation : décision uniquement. Aucune nouvelle table dans ce lot. */
export const RETENTION_POLICY = {
  conversation_ordinaire: { storeText: false as const },
  flag_help_needed: { storeText: "excerpt_and_summary" as const, days: 30 as const },
  error: { storeText: "redacted_payload" as const, days: 7 as const },
  metrics: { storeText: false as const },
  faq_fallback: {
    provider: "faq_fallback" as const,
    storeText: false as const,
    visible: true as const,
  },
} as const;
