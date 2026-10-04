import { describe, expect, it } from 'vitest';
import { homeworkContentErrors } from '@/lib/homeworkExecutable';
import cases from '../../supabase/tests/homework_executable_cases.json';

describe('P0 structural contract, same fixtures as PostgreSQL', () => {
  it.each(cases)('$name', ({ exercise, valid }) => {
    expect(homeworkContentErrors(exercise).length === 0).toBe(valid);
  });
  it('refuses cloning original audio even with a structurally valid reference', () => {
    const fixture = cases.find(c => c.name === 'CO original with script')!;
    expect(homeworkContentErrors(fixture.exercise, true)).toEqual([expect.stringContaining('chemin manuel')]);
  });
});
