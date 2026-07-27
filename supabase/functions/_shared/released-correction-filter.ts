/**
 * Lot 2.1, point 6 — liste blanche DÉDIÉE pour la restitution d'une
 * correction après libération formateur. Module PUR (pas d'import
 * Deno/esm.sh), testable sous Vitest/Node.
 *
 * `exercise_attempts.item_results` (stocké par submit-seance-answer) porte
 * des champs riches dérivés des corrections générées (preuve_support,
 * explication_distracteurs, erreur_diagnostiquee, remediation,
 * justification_ouverte.*). Cette liste blanche est le SEUL point qui
 * décide ce qui sort vers le client, indépendamment de ce qui est stocké —
 * défense en profondeur : même si le stockage évoluait pour inclure un
 * champ interne supplémentaire, get-attempt-correction ne le laisserait pas
 * fuiter sans mise à jour explicite de cette liste.
 *
 * get-attempt-correction n'appelle cette fonction QUE lorsque
 * correction_released_at est posé (déjà vérifié par l'appelant) : avant
 * libération, aucun champ ci-dessous n'atteint jamais le client.
 */

export interface StoredItemResult {
  question?: string;
  reponse_donnee?: string;
  bonne_reponse?: string;
  correct?: boolean;
  answer_correct?: boolean;
  explication?: string | null;
  learner_justification?: string | null;
  hint_used?: boolean;
  justification_status?: string;
  justification_score?: number | null;
  justification_feedback?: string;
  overall_status?: string;
  score_provisional?: boolean;
  preuve_support?: string | null;
  explication_distracteurs?: string[];
  erreur_diagnostiquee?: string | null;
  remediation?: string | null;
  justification_ouverte?: { elements_attendus?: string[]; criteres_evaluation?: string[] } | null;
  [key: string]: unknown;
}

const ALLOWED_RELEASED_KEYS = [
  "question",
  "reponse_donnee",
  "bonne_reponse",
  "correct",
  "answer_correct",
  "explication",
  "learner_justification",
  "hint_used",
  "justification_status",
  "justification_score",
  "justification_feedback",
  "overall_status",
  "score_provisional",
  "preuve_support",
  "explication_distracteurs",
  "erreur_diagnostiquee",
  "remediation",
] as const;

export function filterReleasedItemResult(stored: StoredItemResult | null | undefined): Record<string, unknown> {
  if (!stored || typeof stored !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_RELEASED_KEYS) {
    if (stored[key] !== undefined) out[key] = stored[key];
  }
  const justificationOuverte = stored.justification_ouverte;
  if (justificationOuverte && typeof justificationOuverte === "object") {
    out.justification_ouverte = {
      elements_attendus: Array.isArray(justificationOuverte.elements_attendus) ? justificationOuverte.elements_attendus : [],
      criteres_evaluation: Array.isArray(justificationOuverte.criteres_evaluation) ? justificationOuverte.criteres_evaluation : [],
    };
  }
  return out;
}

export function filterReleasedItemResults(
  stored: Record<string, StoredItemResult> | null | undefined,
): Record<string, unknown> {
  if (!stored || typeof stored !== "object") return {};
  return Object.fromEntries(
    Object.entries(stored).map(([index, item]) => [index, filterReleasedItemResult(item)]),
  );
}
