export const CEFR_LEVELS = ["A0", "A1", "A2", "B1", "B2"] as const;

export type CEFLevel = (typeof CEFR_LEVELS)[number];

export type StudentBaselineLevels = {
  co: CEFLevel;
  ce: CEFLevel;
  ee: CEFLevel;
  eo: CEFLevel;
};

export function lowestBaselineLevel(levels: StudentBaselineLevels): CEFLevel {
  return Object.values(levels).reduce((lowest, level) =>
    CEFR_LEVELS.indexOf(level) < CEFR_LEVELS.indexOf(lowest) ? level : lowest
  );
}

export function resultsSinceBaseline<T extends { createdAt?: string | null }>(
  results: T[],
  baselineAt?: string | null,
): T[] {
  if (!baselineAt) return results;
  const threshold = new Date(baselineAt).getTime();
  if (!Number.isFinite(threshold)) return results;
  return results.filter((result) => {
    const createdAt = result.createdAt ? new Date(result.createdAt).getTime() : Number.NaN;
    return Number.isFinite(createdAt) && createdAt >= threshold;
  });
}
