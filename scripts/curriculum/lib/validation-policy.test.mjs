import { describe, expect, it } from 'vitest';
import { shouldRunAiReview } from '../validate-batch.mjs';

describe('curriculum validation policy', () => {
  it('desactive toute revue IA lorsque le manifeste la refuse', () => {
    expect(shouldRunAiReview({ validation_policy: { ai_review: false } }, 'variantes_json')).toBe(false);
  });

  it('conserve la revue des contenus eligibles lorsque la politique l’autorise', () => {
    expect(shouldRunAiReview({ validation_policy: { ai_review: true } }, 'variantes_json')).toBe(true);
    expect(shouldRunAiReview({ validation_policy: { ai_review: true } }, 'co_script')).toBe(false);
  });
});
