import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const DEFAULT_MANIFEST_PATH = 'content/curriculum/v2/manifest.json';

export async function loadManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  const absolutePath = resolve(manifestPath);
  const raw = await readFile(absolutePath, 'utf8');
  return JSON.parse(raw);
}
