import { describe, expect, it } from 'vitest';
import { runDeterministicChecks } from './validators/deterministic.mjs';
import { runAiReview } from './validators/anthropic-review.mjs';
import { FakeContentProvider } from './providers/fake-content.mjs';
import { renderSolidColorPng } from './lib/minimal-png.mjs';
import { hashContent } from './lib/hash.mjs';

describe('Controle 1 — deterministic validator (section 9.4)', () => {
  it('blocks an empty resource', () => {
    const report = runDeterministicChecks({ resource_id: 'r1', kind: 'devoir', mimeType: 'application/pdf' }, Buffer.alloc(0));
    expect(report.bloquants).toContain('Ressource vide (0 octet) : aucune ressource obligatoire ne peut etre vide.');
  });

  it('blocks an image resource missing alt_text', () => {
    const png = renderSolidColorPng(10, 10);
    const report = runDeterministicChecks(
      { resource_id: 'vis-1', kind: 'vis-master', mimeType: 'image/png', altText: '' },
      png,
    );
    expect(report.bloquants.some((b) => b.includes('alt_text'))).toBe(true);
  });

  it('passes a well-formed image resource with alt_text and correct signature', () => {
    const png = renderSolidColorPng(16, 9);
    const report = runDeterministicChecks(
      { resource_id: 'vis-1', kind: 'vis-master', mimeType: 'image/png', altText: 'Cinq panneaux thematiques.' },
      png,
    );
    expect(report.bloquants).toEqual([]);
  });

  it('detects a duplicate via known hashes', () => {
    const buffer = Buffer.from('contenu-identique');
    const report = runDeterministicChecks(
      { resource_id: 'r2', kind: 'devoir', mimeType: 'application/json' },
      buffer,
      { knownHashes: new Set([hashContent(buffer)]) },
    );
    expect(report.bloquants.some((b) => b.includes('Doublon'))).toBe(true);
  });

  it('rejects a file whose declared MIME does not match its magic bytes', () => {
    const report = runDeterministicChecks(
      { resource_id: 'r3', kind: 'support', mimeType: 'application/pdf' },
      Buffer.from('this is not a pdf'),
    );
    expect(report.bloquants.some((b) => b.includes('non decodable'))).toBe(true);
  });

  it('flags a French phone number leaking into alt_text (donnee personnelle)', () => {
    const png = renderSolidColorPng(10, 10);
    const report = runDeterministicChecks(
      { resource_id: 'vis-2', kind: 'vis-master', mimeType: 'image/png', altText: 'Appelez le 06 12 34 56 78.' },
      png,
    );
    expect(report.bloquants.some((b) => b.includes('interdit'))).toBe(true);
  });
});

describe('Controle 2 — ai review validator (section 9.4)', () => {
  it('is publishable by default with FakeContentProvider (aucun bloquant)', async () => {
    const contentProvider = new FakeContentProvider();
    const { publishable, report } = await runAiReview(contentProvider, {
      resourceId: 'exo-1',
      content: { consigne: 'Repondez aux questions.' },
    });
    expect(publishable).toBe(true);
    expect(report.bloquants).toEqual([]);
  });

  it('is not publishable when the reviewer flags a revealed answer in the image', async () => {
    const contentProvider = new FakeContentProvider({
      responder: () => ({
        quality_score: 5,
        pedagogical_relevance_score: 5,
        single_defensible_answer: true,
        image_reveals_answer: true,
        contains_stereotype_or_noise: false,
        facts_consistent_across_media: true,
        bloquants: [],
      }),
    });

    const { publishable, report } = await runAiReview(contentProvider, {
      resourceId: 'exo-2',
      content: { consigne: 'Question a risque.' },
    });

    expect(publishable).toBe(false);
    expect(report.bloquants.some((b) => b.includes('revele'))).toBe(true);
  });

  it('is not publishable when quality_score is below 4/5', async () => {
    const contentProvider = new FakeContentProvider({
      responder: () => ({
        quality_score: 3,
        pedagogical_relevance_score: 5,
        single_defensible_answer: true,
        image_reveals_answer: false,
        contains_stereotype_or_noise: false,
        facts_consistent_across_media: true,
        bloquants: [],
      }),
    });

    const { publishable } = await runAiReview(contentProvider, { resourceId: 'exo-3', content: {} });
    expect(publishable).toBe(false);
  });
});
