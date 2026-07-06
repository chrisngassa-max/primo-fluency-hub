import { createHash } from 'node:crypto';

/** Hash stable (sha256) d'une chaine, d'un Buffer ou d'un objet JSON-serialisable. */
export function hashContent(content) {
  const hash = createHash('sha256');
  if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
    hash.update(content);
  } else if (typeof content === 'string') {
    hash.update(content, 'utf8');
  } else {
    hash.update(JSON.stringify(sortKeysDeep(content)), 'utf8');
  }
  return hash.digest('hex');
}

/** Trie recursivement les cles d'un objet pour un hash stable independant de l'ordre. */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysDeep(value[key])]),
    );
  }
  return value;
}
