import { describe, expect, it } from 'vitest';
import { createContentProvider } from './providers/content-provider.mjs';
import { FakeContentProvider } from './providers/fake-content.mjs';
import { createImageProvider } from './providers/image-provider.mjs';
import { SvgImageProvider } from './providers/svg-image.mjs';
import { DisabledImageProvider } from './providers/disabled-image.mjs';
import { createTtsProvider } from './providers/tts-provider.mjs';
import { FakeTtsProvider } from './providers/fake-tts.mjs';
import { createRenderer } from './providers/renderer.mjs';
import { FakeRenderer } from './providers/fake-renderer.mjs';
import { createStoragePublisher } from './providers/storage-publisher.mjs';
import { FakeStoragePublisher } from './providers/fake-storage-publisher.mjs';
import { isAllowlistedSource, OFFICIAL_SOURCE_ALLOWLIST } from './providers/source-collector.mjs';
import { FakeSourceCollector } from './providers/fake-source-collector.mjs';
import { renderTextToMinimalPdf } from './lib/minimal-pdf.mjs';
import { renderSolidColorPng } from './lib/minimal-png.mjs';

describe('provider factories (selection explicite, jamais de repli silencieux)', () => {
  it('createContentProvider returns FakeContentProvider when CONTENT_PROVIDER=fake', () => {
    const provider = createContentProvider({ CONTENT_PROVIDER: 'fake' });
    expect(provider).toBeInstanceOf(FakeContentProvider);
  });

  it('createContentProvider throws without ANTHROPIC_API_KEY when anthropic is selected', () => {
    expect(() => createContentProvider({ CONTENT_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('createImageProvider defaults to SvgImageProvider (voie prioritaire)', () => {
    const provider = createImageProvider({});
    expect(provider).toBeInstanceOf(SvgImageProvider);
  });

  it('createImageProvider returns DisabledImageProvider for IMAGE_PROVIDER=disabled', () => {
    const provider = createImageProvider({ IMAGE_PROVIDER: 'disabled' });
    expect(provider).toBeInstanceOf(DisabledImageProvider);
  });

  it('createImageProvider throws without GEMINI_API_KEY when gemini is selected', () => {
    expect(() => createImageProvider({ IMAGE_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY/);
  });

  it('createTtsProvider returns FakeTtsProvider when TTS_PROVIDER=fake', () => {
    expect(createTtsProvider({ TTS_PROVIDER: 'fake' })).toBeInstanceOf(FakeTtsProvider);
  });

  it('createTtsProvider throws without GOOGLE_TTS_API_KEY when google is selected', () => {
    expect(() => createTtsProvider({ TTS_PROVIDER: 'google' })).toThrow(/GOOGLE_TTS_API_KEY/);
  });

  it('createRenderer returns FakeRenderer when RENDERER=fake', () => {
    expect(createRenderer({ RENDERER: 'fake' })).toBeInstanceOf(FakeRenderer);
  });

  it('createStoragePublisher returns FakeStoragePublisher when STORAGE_PUBLISHER=fake', () => {
    expect(createStoragePublisher({ STORAGE_PUBLISHER: 'fake' })).toBeInstanceOf(FakeStoragePublisher);
  });

  it('createStoragePublisher throws without Supabase credentials', () => {
    expect(() => createStoragePublisher({ STORAGE_PUBLISHER: 'supabase' })).toThrow(/SUPABASE/);
  });
});

describe('SvgImageProvider (voie deterministe prioritaire)', () => {
  it('produces the exact same SVG for the same scene (determinisme)', async () => {
    const provider = new SvgImageProvider();
    const scene = {
      title: 'Cinq themes civiques',
      width: 400,
      height: 200,
      elements: [{ type: 'rect', x: 10, y: 10, width: 100, height: 50, fill: '#fca5a5' }],
    };

    const first = await provider.generate({ brief: { resource_id: 'S01-vis-panneaux' }, scene });
    const second = await provider.generate({ brief: { resource_id: 'S01-vis-panneaux' }, scene });
    expect(first.svg).toBe(second.svg);
    expect(first.svg).toContain('<svg');
  });

  it('refuses a scene containing a forbidden element type (logos, cartes...)', async () => {
    const provider = new SvgImageProvider();
    await expect(
      provider.generate({
        brief: { resource_id: 'S02-vis-logo' },
        scene: { title: 'Interdit', elements: [{ type: 'logo' }] },
      }),
    ).rejects.toThrow(/interdit/);
  });
});

describe('SourceCollector — liste blanche (section 2)', () => {
  it('accepts every officially listed source URL', () => {
    for (const url of OFFICIAL_SOURCE_ALLOWLIST) {
      expect(isAllowlistedSource(url)).toBe(true);
    }
  });

  it('rejects a URL outside the allowlist', () => {
    expect(isAllowlistedSource('https://example.com/fake-source')).toBe(false);
  });

  it('FakeSourceCollector refuses non-whitelisted URLs exactly like production', async () => {
    const collector = new FakeSourceCollector();
    await expect(collector.collect('https://example.com/not-allowed')).rejects.toThrow(/liste blanche/);
  });

  it('FakeSourceCollector returns deterministic fixtures for allowlisted URLs without network', async () => {
    const url = OFFICIAL_SOURCE_ALLOWLIST[0];
    const collector = new FakeSourceCollector({ fixtures: { [url]: 'Texte de reference fige.' } });
    const result = await collector.collect(url);
    expect(result.text).toBe('Texte de reference fige.');
    expect(result.hash).toHaveLength(64);
  });
});

describe('encodeurs deterministes hors-ligne (minimal-pdf / minimal-png)', () => {
  it('produces a valid PDF signature and trailer', () => {
    const pdf = renderTextToMinimalPdf('<p>Bonjour le monde</p>', { title: 'Test' });
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('%%EOF');
  });

  it('is deterministic (same text -> same bytes)', () => {
    const a = renderTextToMinimalPdf('Contenu identique', { title: 'T' });
    const b = renderTextToMinimalPdf('Contenu identique', { title: 'T' });
    expect(a.equals(b)).toBe(true);
  });

  it('produces a valid PNG signature with correct declared dimensions', () => {
    const png = renderSolidColorPng(64, 32, '#336699');
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(64); // IHDR width
    expect(png.readUInt32BE(20)).toBe(32); // IHDR height
  });
});

describe('FakeRenderer (RENDERER=fake, hors-ligne)', () => {
  it('renders an HTML fragment to a real, non-empty PDF buffer', async () => {
    const renderer = new FakeRenderer();
    const { buffer, mimeType } = await renderer.renderHtmlToPdf({ html: '<h1>Fiche formateur</h1><p>Contenu.</p>', title: 'Fiche' });
    expect(mimeType).toBe('application/pdf');
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('renders an SVG fragment to a real PNG buffer honoring declared dimensions', async () => {
    const renderer = new FakeRenderer();
    const svg = '<svg width="120" height="60"><rect width="120" height="60" fill="#112233"/></svg>';
    const { buffer, mimeType, format } = await renderer.renderSvgToRaster({ svg, format: 'png' });
    expect(mimeType).toBe('image/png');
    expect(format).toBe('png');
    expect(buffer.readUInt32BE(16)).toBe(120);
    expect(buffer.readUInt32BE(20)).toBe(60);
  });
});

describe('FakeStoragePublisher (chainage des publications)', () => {
  it('chains previous_publication_id across successive publications of the same resource', async () => {
    const publisher = new FakeStoragePublisher();
    const first = await publisher.recordPublication({ planVersionId: 'plan-1', sessionResourceId: 'res-1', version: 1 });
    const second = await publisher.recordPublication({
      planVersionId: 'plan-1',
      sessionResourceId: 'res-1',
      version: 2,
      previousPublicationId: first.id,
    });

    expect(second.previous_publication_id).toBe(first.id);
    const latest = await publisher.latestPublication({ sessionResourceId: 'res-1' });
    expect(latest.id).toBe(second.id);
  });
});
