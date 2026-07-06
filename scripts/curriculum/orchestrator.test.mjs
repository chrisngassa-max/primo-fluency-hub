import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeContentProvider } from './providers/fake-content.mjs';
import { SvgImageProvider } from './providers/svg-image.mjs';
import { FakeTtsProvider } from './providers/fake-tts.mjs';
import { FakeRenderer } from './providers/fake-renderer.mjs';
import { FakeStoragePublisher } from './providers/fake-storage-publisher.mjs';
import { FakeSourceCollector } from './providers/fake-source-collector.mjs';
import { OFFICIAL_SOURCE_ALLOWLIST } from './providers/source-collector.mjs';
import { runDeterministicChecks } from './validators/deterministic.mjs';
import { runAiReview } from './validators/anthropic-review.mjs';
import { hashContent } from './lib/hash.mjs';

// Preuve concrete du critere de sortie du lot 2 : "les doubles de test
// produisent un lot complet sans acces reseau." On remplace fetch global
// par une fonction qui echoue immediatement ; si un seul provider tentait
// un appel reseau, le test echouerait.
describe('Lot 2 — orchestrateur avec doubles de test (aucun acces reseau)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => {
      throw new Error('Acces reseau interdit dans ce test (uniquement des doubles de test attendus).');
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('genere, valide et publie le paquet complet d\'une seance fictive via des doubles de test uniquement', async () => {
    const contentProvider = new FakeContentProvider();
    const imageProvider = new SvgImageProvider();
    const ttsProvider = new FakeTtsProvider();
    const renderer = new FakeRenderer();
    const storagePublisher = new FakeStoragePublisher();
    const sourceCollector = new FakeSourceCollector({
      fixtures: { [OFFICIAL_SOURCE_ALLOWLIST[0]]: 'Extrait de reference fige sur le TCF IRN.' },
    });

    // 1. Collecte de source officielle (liste blanche, hors reseau ici).
    const source = await sourceCollector.collect(OFFICIAL_SOURCE_ALLOWLIST[0]);
    expect(source.text).toContain('TCF IRN');

    // 2. Support-master structure (section 9.2, etape 1-2).
    const { data: support } = await contentProvider.generateStructured({
      promptVersion: 'support-master-v1',
      systemPrompt: 'Redige un support-master pour S01.',
      userPrompt: 'Accueil, objectifs et cinq themes.',
      sourceExtracts: [{ url: source.url, text: source.text }],
    });
    expect(support.generated).toBe(true);

    // 3. Visuel maitre SVG deterministe (voie prioritaire, section 4.2).
    const scene = {
      title: 'Cinq themes civiques — S01',
      width: 400,
      height: 200,
      elements: [{ type: 'rect', x: 20, y: 20, width: 360, height: 160, fill: '#e0f2fe' }],
    };
    const image = await imageProvider.generate({ brief: { resource_id: 'S01-vis-master' }, scene });

    // 4. Derives rendus (SVG -> PNG, HTML -> PDF), section 9.2 etapes 4-5.
    const rasterResult = await renderer.renderSvgToRaster({ svg: image.svg, format: 'png' });
    const pdfResult = await renderer.renderHtmlToPdf({
      html: '<h1>Fiche formateur S01</h1><p>Deroule et adaptations.</p>',
      title: 'Fiche formateur S01',
    });

    // 5. Audio maitre CO (section 9.2 etape 6).
    const audio = await ttsProvider.synthesize({
      script: 'Bonjour, je m\'appelle Awa, je viens pour mon premier rendez-vous.',
      voice: 'fr-FR-Wavenet-C',
    });

    // 6. Controle 1 (deterministe) sur chaque ressource produite.
    const visualReport = runDeterministicChecks(
      { resource_id: 'S01-vis-master', kind: 'vis-master', mimeType: rasterResult.mimeType, altText: scene.title },
      rasterResult.buffer,
    );
    const pdfReport = runDeterministicChecks(
      { resource_id: 'S01-formateur-fiche', kind: 'fiche-formateur', mimeType: pdfResult.mimeType },
      pdfResult.buffer,
    );
    const audioReport = runDeterministicChecks(
      {
        resource_id: 'S01-co-master',
        kind: 'co-master',
        mimeType: audio.mimeType,
        transcript: audio.metadata.transcript,
      },
      audio.buffer,
    );

    for (const report of [visualReport, pdfReport, audioReport]) {
      expect(report.bloquants).toEqual([]);
    }

    // 7. Controle 2 (revue IA independante) sur le support genere.
    const { publishable, report: aiReport } = await runAiReview(contentProvider, {
      resourceId: 'S01-support-master',
      content: support,
    });
    expect(publishable).toBe(true);
    expect(aiReport.scores.quality_score).toBeGreaterThanOrEqual(4);

    // 8. Publication atomique-par-etape des 3 ressources (section 9.6).
    const resources = [
      { id: 'S01-vis-master', bucket: 'pedagogical-images', path: 'S01/vis-master.png', buffer: rasterResult.buffer, contentType: rasterResult.mimeType },
      { id: 'S01-formateur-fiche', bucket: 'curriculum-documents', path: 'S01/fiche-formateur.pdf', buffer: pdfResult.buffer, contentType: pdfResult.mimeType },
      { id: 'S01-co-master', bucket: 'curriculum-audio', path: 'S01/co-master.mp3', buffer: audio.buffer, contentType: audio.mimeType },
    ];

    const publications = [];
    for (const resource of resources) {
      await storagePublisher.upload({ bucket: resource.bucket, path: resource.path, buffer: resource.buffer, contentType: resource.contentType });
      await storagePublisher.upsertRow({
        table: 'session_resources',
        row: { resource_id: resource.id, hash: hashContent(resource.buffer), statut: 'published' },
        onConflict: 'resource_id',
      });
      const publication = await storagePublisher.recordPublication({
        planVersionId: 'plan-v2',
        sessionResourceId: resource.id,
        version: 1,
      });
      publications.push(publication);
    }

    expect(publications).toHaveLength(3);
    expect(storagePublisher.uploads.size).toBe(3);
    expect(storagePublisher.rows.get('session_resources').size).toBe(3);

    // Preuve finale : aucun des providers/valideurs utilises n'a jamais
    // appele fetch (le mock aurait leve une exception sinon, faisant
    // echouer ce test avant d'arriver ici).
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
