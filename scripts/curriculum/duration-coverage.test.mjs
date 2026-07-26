import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  estimateVariantActiveSeconds,
  evaluateDifferentiatedDurationCoverage,
  findDifferentiatedWorkshopMinutes,
  resolveDifferentiatedDurationPolicy,
} from '../../supabase/functions/_shared/duration-coverage.mjs';

const RULES = {
  minimums_par_niveau_differencie: {
    calibration_status: 'uncalibrated',
    mode: 'warning',
    '45_min': { minimum_coverage_minutes: 40, maximum_coverage_minutes: 55, minimum_items_by_level: { A1: 6, A2: 5, B1: 3, B2: 3 } },
    '60_min': { minimum_coverage_minutes: 55, maximum_coverage_minutes: 70, minimum_items_by_level: { A1: 8, A2: 7, B1: 4, B2: 4 } },
    '90_min': { minimum_coverage_minutes: 80, maximum_coverage_minutes: 100, minimum_items_by_level: { A1: 12, A2: 10, B1: 6, B2: 6 } },
  },
};

function variant(niveau, types, estimatedMinutes = null) {
  return {
    niveau,
    consigne: 'Travaillez.',
    aides: niveau === 'A1' ? ['Lexique', 'Exemple'] : [],
    questions: types.map((type, index) => ({ id: `q${index + 1}`, type })),
    differentiation_contract: estimatedMinutes == null ? {} : { estimated_minutes: estimatedMinutes },
  };
}

describe('duration coverage — ateliers differencies', () => {
  it('retrouve la duree annoncee dans le deroule formateur', () => {
    expect(findDifferentiatedWorkshopMinutes([
      { phase: 'Support commun', duree_min: 50 },
      { phase: 'Ateliers différenciés', duree_min: 60 },
    ])).toBe(60);
  });

  it('selectionne la politique 60 minutes en mode warning', () => {
    expect(resolveDifferentiatedDurationPolicy(RULES, 60)).toEqual(expect.objectContaining({
      key: '60_min',
      mode: 'warning',
      minimum_coverage_minutes: 55,
    }));
  });

  it('ne confond pas nombre de questions et temps de production', () => {
    const a1 = estimateVariantActiveSeconds(variant('A1', Array(5).fill('qcm')));
    const b2 = estimateVariantActiveSeconds(variant('B2', Array(4).fill('argumentation')));
    expect(b2.item_count).toBeLessThan(a1.item_count);
    expect(b2.calculated_seconds).toBeGreaterThan(a1.calculated_seconds);
  });

  it('signale S01 quand chaque niveau ne declare que 25 minutes pour un atelier de 60 minutes', () => {
    const variants = [
      variant('A1', Array(5).fill('qcm'), 25),
      variant('A2', Array(5).fill('qcm'), 25),
      variant('B1', Array(4).fill('reponse_longue'), 25),
      variant('B2', Array(4).fill('argumentation'), 25),
    ];
    const result = evaluateDifferentiatedDurationCoverage({ variants, announcedMinutes: 60, rules: RULES });

    expect(result.status).toBe('warning');
    expect(result.blocking).toBe(false);
    expect(result.coverage_by_level.B2.estimated_minutes).toBe(25);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DIFF_DURATION_BELOW_MINIMUM', level: 'A1' }),
      expect.objectContaining({ code: 'DIFF_DURATION_BELOW_MINIMUM', level: 'B2' }),
    ]));
  });

  it('confirme que S01 couvre deux heures et conserve vingt minutes de reserve', async () => {
    const sessionDir = path.join(process.cwd(), 'content/curriculum/v2/S01');
    const [variants, deroule, rules] = await Promise.all([
      readFile(path.join(sessionDir, 'exercices/variantes-A1-A2-B1-B2.json'), 'utf8').then(JSON.parse),
      readFile(path.join(sessionDir, 'formateur/deroule-180min.json'), 'utf8').then(JSON.parse),
      readFile(path.join(process.cwd(), 'supabase/functions/_shared/referential/session_block_rules.json'), 'utf8').then(JSON.parse),
    ]);
    const result = evaluateDifferentiatedDurationCoverage({
      variants,
      announcedMinutes: findDifferentiatedWorkshopMinutes(deroule),
      rules,
    });

    expect(result.announced_minutes).toBe(120);
    expect(result.status).toBe('pass');
    expect(result.warnings).toEqual([]);
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      expect(result.coverage_by_level[level].estimated_minutes).toBe(140);
      expect(result.coverage_by_level[level].warnings).toEqual([]);
      expect(result.coverage_by_level[level].estimates[0].step_count).toBe(7);
      expect(result.coverage_by_level[level].estimates[0].lesson_minutes).toBe(10);
    }
  });
  it('additionne plusieurs familles pour mesurer le parcours complet du niveau', () => {
    const variants = ['A1', 'A2', 'B1', 'B2'].flatMap((level) => [
      variant(level, Array(4).fill('qcm'), 30),
      variant(level, Array(4).fill('qcm'), 30),
    ]);
    const result = evaluateDifferentiatedDurationCoverage({ variants, announcedMinutes: 60, rules: RULES });

    expect(result.status).toBe('pass');
    expect(result.warnings).toEqual([]);
    expect(result.coverage_by_level.A1.estimated_minutes).toBe(60);
  });
});