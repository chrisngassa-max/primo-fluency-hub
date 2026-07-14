// Lot 2 — logique partagée entre SeanceApprenant.tsx (rendu réel) et les
// tests (composant + correction serveur "testés ensemble") : même code en
// production et en test, jamais une réimplémentation parallèle.

export type LearnerAnswerValue = string | { reponse: string; justification?: string; hint_used?: boolean };

/**
 * Fusionne réponse principale + justification + usage de l'indice en la
 * forme envoyée au serveur : une chaîne simple (comportement historique,
 * inchangé) si ni justification ni indice n'ont été utilisés, sinon un
 * objet structuré. Lot 2.1, point 2 : `hint_used` doit être conservé dans
 * la tentative et le reporting — jamais traité comme un résultat autonome.
 */
export function buildStructuredAnswer(mainValue: string, justificationValue: string, hintUsed = false): LearnerAnswerValue {
  const trimmedJustification = justificationValue.trim();
  if (!trimmedJustification && !hintUsed) return mainValue;
  const structured: { reponse: string; justification?: string; hint_used?: boolean } = { reponse: mainValue };
  if (trimmedJustification) structured.justification = trimmedJustification;
  if (hintUsed) structured.hint_used = true;
  return structured;
}

/** Miroir client de findMissingRequiredJustifications (garde-fou serveur). */
export function isJustificationMissing(
  item: { justification_required?: boolean },
  justificationValue: string,
): boolean {
  return Boolean(item.justification_required) && justificationValue.trim().length === 0;
}
