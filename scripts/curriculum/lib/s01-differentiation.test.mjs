import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const supportPath = 'content/curriculum/v2/S01/support/support-master.json';
const variantsPath = 'content/curriculum/v2/S01/exercices/variantes-A1-A2-B1-B2.json';
const support = JSON.parse(readFileSync(supportPath, 'utf8'));
const variants = JSON.parse(readFileSync(variantsPath, 'utf8'));
const expectedTransformations = { A1: 'A2_TO_A1', A2: 'IDENTITY', B1: 'A2_TO_B1', B2: 'A2_TO_B2' };

describe('S01 — famille de référence A2 pivot', () => {
  it('publie exactement quatre variantes A1 à B2', () => {
    expect(variants.map((variant) => variant.niveau)).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('conserve CE dans toute la famille', () => {
    expect(new Set(variants.map((variant) => variant.competence))).toEqual(new Set(['CE']));
    expect(variants.every((variant) => variant.differentiation_contract.competence_invariante === 'CE')).toBe(true);
  });

  it('déclare A2 comme source et la transformation attendue', () => {
    for (const variant of variants) {
      expect(variant.family_id).toBe('S01_CE_ACCUEIL_01');
      expect(variant.differentiation_contract.source_level).toBe('A2');
      expect(variant.differentiation_contract.target_level).toBe(variant.niveau);
      expect(variant.differentiation_contract.transformation_id).toBe(expectedTransformations[variant.niveau]);
    }
  });

  it('lie chaque variante au support immuable par son hash', () => {
    expect(support.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(variants.every((variant) => variant.invariants_hash === support.hash)).toBe(true);
  });

  it('fournit des preuves structurées et aucune erreur bloquante', () => {
    for (const variant of variants) {
      expect(variant.validation_report.rules.length).toBeGreaterThanOrEqual(3);
      expect(variant.validation_report.rules.every((rule) => rule.status === 'pass')).toBe(true);
      expect(variant.validation_report.errors).toEqual([]);
    }
  });

  it('ne réduit pas B2 à un simple allongement', () => {
    const b1 = variants.find((variant) => variant.niveau === 'B1');
    const b2 = variants.find((variant) => variant.niveau === 'B2');
    expect(b2.questions).toHaveLength(b1.questions.length);
    expect(b2.differentiation_contract.cognitive_operations).toContain('nuancer');
    expect(b2.differentiation_contract.cognitive_operations).toContain('distinguer_explicite_implicite');
  });
});