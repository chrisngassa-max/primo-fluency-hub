import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hashContent } from '../lib/hash.mjs';
import { withExponentialBackoff } from '../lib/retry.mjs';

// SourceCollector reel (section 2, 9.3) : recuperation, snapshot, hash et
// liste blanche. "Anthropic ne navigue pas librement depuis le navigateur
// de l'eleve. Les sources sont collectees cote serveur, mises en cache et
// versionnees." Toute URL hors liste blanche est refusee avant meme la
// requete reseau.

export const OFFICIAL_SOURCE_ALLOWLIST = [
  'https://www.france-education-international.fr/test/tcf-irn?langue=fr',
  'https://formation-civique.interieur.gouv.fr/examen-civique/informations-g%C3%A9n%C3%A9rales-sur-lexamen-civique/',
  'https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-csp/',
  'https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-cr/',
  'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620',
  'https://www.service-public.fr/particuliers/vosdroits/F34708',
];

const ALLOWLIST_HOSTS = new Set(OFFICIAL_SOURCE_ALLOWLIST.map((url) => new URL(url).hostname));

export function isAllowlistedSource(url) {
  try {
    return ALLOWLIST_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export class SourceCollector {
  constructor({ cacheDir = '.cache/curriculum-sources', referentialVersion = 'unversioned', fetchImpl = fetch } = {}) {
    this.cacheDir = resolve(cacheDir);
    this.referentialVersion = referentialVersion;
    this.fetchImpl = fetchImpl;
  }

  /**
   * @param {string} url doit appartenir a la liste blanche officielle (section 2).
   * @returns {Promise<{url:string, title:string, fetched_at:string, hash:string, referential_version:string, cache_path:string, text:string}>}
   */
  async collect(url) {
    if (!isAllowlistedSource(url)) {
      throw new Error(`source-collector: URL hors liste blanche refusee -> ${url}`);
    }

    const response = await withExponentialBackoff(() => this.fetchImpl(url));
    if (!response.ok) {
      throw new Error(`source-collector: echec de recuperation (${response.status}) pour ${url}`);
    }

    const text = await response.text();
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    const snapshot = {
      url,
      title: titleMatch ? titleMatch[1].trim() : url,
      fetched_at: new Date().toISOString(),
      hash: hashContent(text),
      referential_version: this.referentialVersion,
    };

    await mkdir(this.cacheDir, { recursive: true });
    const cachePath = join(this.cacheDir, `${snapshot.hash}.json`);
    await writeFile(cachePath, JSON.stringify({ ...snapshot, text }, null, 2), 'utf8');

    return { ...snapshot, cache_path: cachePath, text };
  }

  async readCached(hash) {
    const cachePath = join(this.cacheDir, `${hash}.json`);
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }
}

// Selection : SOURCE_COLLECTOR=real (defaut) | fake.
export async function createSourceCollector(env = process.env) {
  const providerName = (env.SOURCE_COLLECTOR ?? 'real').toLowerCase();

  if (providerName === 'fake') {
    const { FakeSourceCollector } = await import('./fake-source-collector.mjs');
    return new FakeSourceCollector();
  }
  if (providerName === 'real') {
    return new SourceCollector({ referentialVersion: env.CIVIC_REFERENTIAL_VERSION ?? 'unversioned' });
  }

  throw new Error(`SOURCE_COLLECTOR inconnu : "${providerName}". Valeurs supportees : real, fake.`);
}
