export function clampExerciseCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(30, Math.max(1, Math.round(parsed)));
}

export function buildGenerationBatchSizes(value: unknown, batchSize = 5): number[] {
  const count = clampExerciseCount(value);
  const safeBatchSize = Math.max(1, Math.round(batchSize));
  const batches: number[] = [];
  for (let remaining = count; remaining > 0; remaining -= safeBatchSize) {
    batches.push(Math.min(safeBatchSize, remaining));
  }
  return batches;
}
