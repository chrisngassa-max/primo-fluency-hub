/**
 * Règles de visibilité du parcours de séance apprenant — extraites en
 * fonctions PURES (pas d'import Deno/esm.sh) pour être testables sous
 * Vitest, à la demande de la 2e relecture indépendante (2026-07-13, point
 * 10 : "filtrage A1/A2/B1/B2 réellement testé", "activities technical_review
 * invisibles").
 */

export interface ActivityRow {
  pedagogical_status: string;
}

/** Une activité n'est visible côté apprenant qu'aux paliers terminaux. */
export function isActivityVisible(activity: ActivityRow): boolean {
  return activity.pedagogical_status === "publishable" || activity.pedagogical_status === "published";
}

export interface LinkRow {
  eleve_id: string | null;
}

export interface ExerciceRow {
  niveau_vise: string;
}

/**
 * Un exercice COMMUN (lien.eleve_id NULL) n'est visible que s'il correspond
 * au niveau CECRL du groupe de l'apprenant : un A1 ne doit jamais recevoir
 * automatiquement les variantes B1/B2 de la même famille. Un exercice
 * INDIVIDUEL (bonus/remédiation, lien.eleve_id = learnerId) reste visible
 * quel que soit le niveau — c'est un choix délibéré du formateur.
 */
export function isExerciseLinkVisible(
  link: LinkRow,
  exercice: ExerciceRow,
  learnerId: string,
  learnerNiveau: string | null,
): boolean {
  const isIndividual = link.eleve_id === learnerId;
  if (isIndividual) return true;
  if (link.eleve_id !== null) return false; // assigné à un AUTRE élève : jamais visible
  if (!learnerNiveau) return true; // pas de niveau de groupe connu : ne bloque pas (dégradé, pas de faux négatif)
  return exercice.niveau_vise === learnerNiveau;
}
