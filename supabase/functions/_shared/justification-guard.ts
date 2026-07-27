/**
 * Garde-fou pur (pas d'import Deno/esm.sh — testable sous Vitest/Node) pour
 * la justification obligatoire (Lot 2, B1/B2). Utilisé côté serveur
 * (submit-seance-answer, défense en profondeur) ET peut être réutilisé côté
 * client pour la même règle avant envoi.
 *
 * Un item porte `justification_required: true` uniquement quand son contrat
 * de niveau (B1/B2) l'exige (posé par le générateur, jamais par le client).
 * La réponse principale n'est jamais perdue par ce contrôle : il rejette la
 * soumission entière (rien n'est inséré) plutôt que de tronquer une partie
 * de la réponse — l'apprenant garde sa saisie côté client et peut la
 * compléter.
 */

export interface JustificationGuardItem {
  justification_required?: boolean;
  [key: string]: unknown;
}

export function isStructuredAnswer(
  value: unknown,
): value is { reponse?: unknown; justification?: unknown } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function extractJustificationText(value: unknown): string {
  if (!isStructuredAnswer(value)) return "";
  const justification = (value as Record<string, unknown>).justification;
  return typeof justification === "string" ? justification.trim() : "";
}

export function hasNonEmptyJustification(value: unknown): boolean {
  return extractJustificationText(value).length > 0;
}

/**
 * Lot 2.1, point 2 : indique si l'apprenant a révélé l'indice pour cet
 * item (bouton "Voir un indice", jamais affiché automatiquement). Doit
 * être conservé dans la tentative/le reporting — jamais traité comme un
 * résultat autonome.
 */
export function extractHintUsed(value: unknown): boolean {
  if (!isStructuredAnswer(value)) return false;
  return (value as Record<string, unknown>).hint_used === true;
}

/**
 * Retourne les index d'items pour lesquels justification_required est vrai
 * mais dont la réponse soumise ne porte aucune justification non vide.
 * Tableau vide = soumission acceptable du point de vue justification.
 */
export function findMissingRequiredJustifications(
  items: JustificationGuardItem[],
  answers: Record<string | number, unknown>,
): number[] {
  const missing: number[] = [];
  items.forEach((item, idx) => {
    if (!item.justification_required) return;
    const answer = answers[idx] ?? answers[String(idx)];
    if (!hasNonEmptyJustification(answer)) missing.push(idx);
  });
  return missing;
}
