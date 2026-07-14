// Lot 2 — logique partagée entre SeanceApprenant.tsx (rendu réel) et les
// tests (composant + correction serveur "testés ensemble") : même code en
// production et en test, jamais une réimplémentation parallèle.

export type LearnerAnswerValue = string | { reponse: string; justification?: string };

/**
 * Fusionne réponse principale + justification en la forme envoyée au
 * serveur : une chaîne simple (comportement historique, tous les formats
 * sans justification) si aucune justification n'est saisie, sinon
 * { reponse, justification }.
 */
export function buildStructuredAnswer(mainValue: string, justificationValue: string): LearnerAnswerValue {
  const trimmedJustification = justificationValue.trim();
  return trimmedJustification ? { reponse: mainValue, justification: trimmedJustification } : mainValue;
}

/** Miroir client de findMissingRequiredJustifications (garde-fou serveur). */
export function isJustificationMissing(
  item: { justification_required?: boolean },
  justificationValue: string,
): boolean {
  return Boolean(item.justification_required) && justificationValue.trim().length === 0;
}
