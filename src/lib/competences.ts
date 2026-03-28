/**
 * Shared helper for TCF competence resolution across the formateur space.
 * Single source of truth for canonical ordering, deduplication, and
 * the priority-based resolution of session competences.
 */

/** Canonical ordering of TCF competences */
export const COMPETENCES_ORDER = ["CO", "CE", "EE", "EO", "Structures"] as const;

/** Competence badge colors — reusable across all formateur views */
export const COMPETENCE_COLORS: Record<string, string> = {
  CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Structures: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

/**
 * Sort & deduplicate competences according to canonical TCF order.
 */
export function sortCompetences(comps: string[]): string[] {
  const unique = [...new Set(comps)];
  return unique.sort(
    (a, b) => COMPETENCES_ORDER.indexOf(a as any) - COMPETENCES_ORDER.indexOf(b as any)
  );
}

/**
 * Resolve the effective competences for a session.
 *
 * Priority:
 * 1. `session.competences_cibles` if present and non-empty
 * 2. Competences deduced from attached exercises
 * 3. Empty array
 */
export function resolveSessionCompetences(
  sessionCompetencesCibles: string[] | null | undefined,
  exerciseCompetences: string[]
): string[] {
  if (sessionCompetencesCibles && sessionCompetencesCibles.length > 0) {
    return sortCompetences(sessionCompetencesCibles);
  }
  if (exerciseCompetences.length > 0) {
    return sortCompetences(exerciseCompetences);
  }
  return [];
}
