import { hashContent } from '../lib/hash.mjs';
import { isAllowlistedSource } from './source-collector.mjs';

/**
 * SourceCollector de test : aucun appel reseau. Sert des extraits fournis
 * en fixture (ou un texte generique deterministe) pour les URL de la liste
 * blanche uniquement — une URL hors liste est refusee comme en production.
 */
export class FakeSourceCollector {
  constructor({ fixtures = {} } = {}) {
    this.fixtures = fixtures;
  }

  async collect(url) {
    if (!isAllowlistedSource(url)) {
      throw new Error(`fake-source-collector: URL hors liste blanche refusee -> ${url}`);
    }

    const text = this.fixtures[url] ?? `Extrait factice pour ${url} (aucun acces reseau).`;
    return {
      url,
      title: url,
      fetched_at: '2026-01-01T00:00:00.000Z',
      hash: hashContent(text),
      referential_version: 'fake',
      cache_path: null,
      text,
    };
  }

  async readCached() {
    throw new Error('fake-source-collector: pas de cache disque en mode test.');
  }
}
