import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Traduit les resource_id produits par session-pipeline.mjs vers
// l'arborescence obligatoire de la section 5 (SXX/support/..., audio/...,
// visual/..., lexique/..., formateur/..., apprenant/..., exercices/...,
// devoirs/...). Table unique = source de verite pour l'ecriture (lot 3) et
// la lecture (validate/publish) des paquets de seance.
export const RESOURCE_RELATIVE_PATHS = {
  'support-master-json': 'support/support-master.json',
  'support-master-html': 'support/support-master.html',
  'support-master-pdf': 'support/support-master.pdf',
  'variantes-a1-a2-b1-b2': 'exercices/variantes-A1-A2-B1-B2.json',
  'vis-brief-json': 'visual/VIS-brief.json',
  'vis-master-svg': 'visual/VIS-master.svg',
  'vis-master-png': 'visual/VIS-master.png',
  'vis-master-webp': 'visual/VIS-master.webp',
  'co-script-md': 'audio/CO-script.md',
  'co-transcript-pdf': 'audio/CO-transcript.pdf',
  'co-master-mp3': 'audio/CO-master.mp3',
  'co-metadata-json': 'audio/CO-metadata.json',
  'lexique-a1-b2-json': 'lexique/lexique-A1-B2.json',
  'lexique-a1-b2-pdf': 'lexique/lexique-A1-B2.pdf',
  'exercices-json': 'exercices/exercices.json',
  'corrige-json': 'exercices/corrige.json',
  'qcm-civique-json': 'exercices/qcm-civique.json',
  'devoir-a1-pdf': 'devoirs/devoir-A1.pdf',
  'devoir-a2-pdf': 'devoirs/devoir-A2.pdf',
  'devoir-b1-pdf': 'devoirs/devoir-B1.pdf',
  'devoir-b2-pdf': 'devoirs/devoir-B2.pdf',
  'fiche-a1-pdf': 'apprenant/fiche-A1.pdf',
  'fiche-a2-pdf': 'apprenant/fiche-A2.pdf',
  'fiche-b1-pdf': 'apprenant/fiche-B1.pdf',
  'fiche-b2-pdf': 'apprenant/fiche-B2.pdf',
  'fiche-formateur-pdf': 'formateur/fiche-formateur.pdf',
  'deroule-180min-json': 'formateur/deroule-180min.json',
  'adaptation-rules-json': 'formateur/adaptation-rules.json',
  'sources-json': 'sources.json',
  'session-yaml': 'session.yaml',
};

export function sessionDir(sessionCode, baseDir = path.resolve(process.cwd(), 'content', 'curriculum', 'v2')) {
  return path.join(baseDir, sessionCode);
}

export function relativePathForResource(resourceId) {
  const relativePath = RESOURCE_RELATIVE_PATHS[resourceId];
  if (!relativePath) throw new Error(`session-fs: aucun chemin connu pour la ressource "${resourceId}".`);
  return relativePath;
}

/** Ecrit tous les artefacts d'un paquet de seance (resources + manifest) sous SXX/. */
export async function writeSessionPackageToDisk({ sessionCode, resources, manifest, baseDir }) {
  const dir = sessionDir(sessionCode, baseDir);

  for (const resource of resources) {
    const relativePath = relativePathForResource(resource.resource_id);
    const absolutePath = path.join(dir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, resource.buffer);
  }

  const manifestPath = path.join(dir, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { dir, manifestPath };
}

export async function readSessionManifest(sessionCode, baseDir) {
  const manifestPath = path.join(sessionDir(sessionCode, baseDir), 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return raw ? JSON.parse(raw) : null;
}

/** Relit les octets d'une ressource deja generee sur disque (pour validate/publish sans regenerer). */
export async function readResourceBuffer(sessionCode, resourceId, baseDir) {
  const absolutePath = path.join(sessionDir(sessionCode, baseDir), relativePathForResource(resourceId));
  return readFile(absolutePath);
}

export async function readSessionBrief(sessionCode, baseDir = path.resolve(process.cwd(), 'content', 'curriculum', 'v2')) {
  const briefPath = path.join(baseDir, sessionCode, 'brief.json');
  const raw = await readFile(briefPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return raw ? JSON.parse(raw) : null;
}

export async function readSessionJsonSibling(sessionCode, filename, baseDir) {
  const filePath = path.join(sessionDir(sessionCode, baseDir), filename);
  const raw = await readFile(filePath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return raw ? JSON.parse(raw) : null;
}

export async function listSessionCodesWithBrief(baseDir = path.resolve(process.cwd(), 'content', 'curriculum', 'v2')) {
  const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
  const codes = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const brief = await readSessionBrief(entry.name, baseDir);
    if (brief) codes.push(entry.name);
  }
  return codes.sort();
}
