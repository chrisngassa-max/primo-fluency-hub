export const ORAL_CRITERIA = [
  "realisation_consigne",
  "lexique",
  "grammaire",
  "prononciation",
  "fluidite",
  "coherence",
] as const;

export type OralCriterionKey = typeof ORAL_CRITERIA[number];
export type OralCriterion = { score: number; commentaire: string };
export type OralCriteria = Record<OralCriterionKey, OralCriterion>;

export function normalizeOralCriteria(value: unknown, maxScore: number): OralCriteria {
  const source = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(ORAL_CRITERIA.map((key) => {
    const item = source[key] && typeof source[key] === "object"
      ? source[key] as Record<string, unknown>
      : {};
    const numericScore = Number(item.score ?? 0);
    const score = Number.isFinite(numericScore)
      ? Math.min(maxScore, Math.max(0, Math.round(numericScore)))
      : 0;
    const commentaire = typeof item.commentaire === "string" ? item.commentaire.trim() : "";
    return [key, { score, commentaire }];
  })) as OralCriteria;
}

export function emptyOralCriteria(): OralCriteria {
  return normalizeOralCriteria({}, 10);
}
