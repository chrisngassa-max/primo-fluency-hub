import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Petits helpers d'arguments CLI partages par generate/validate/publish/
// resume/report-batch.mjs (section 10).
export function valueAfter(args, flag, fallback = undefined) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

export function listAfter(args, flag) {
  const raw = valueAfter(args, flag, null);
  if (!raw) return null;
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

export function hasFlag(args, flag) {
  return args.includes(flag);
}

/** Detection cross-platform (Windows inclus) du "ce fichier est le point d'entree CLI". */
export function isMainModule(importMetaUrl) {
  return Boolean(process.argv[1]) && fileURLToPath(importMetaUrl) === resolve(process.argv[1]);
}
