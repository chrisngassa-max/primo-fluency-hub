import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Section 1.3/13 : "Protéger les secrets dans les fonctions serveur ; aucune
// clé dans VITE_ ni dans le navigateur." Ces variables sont volontairement
// publiques (Supabase les documente comme telles pour un client anon-key) ;
// tout le reste sous VITE_* qui ressemble a un secret est bloquant.
const ALLOWED_VITE_PUBLIC_VARS = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PROJECT_ID',
]);

const SENSITIVE_NAME_PATTERN = /(API_KEY|SECRET|TOKEN|PRIVATE_KEY|SERVICE_ROLE)/i;
const VITE_ENV_REFERENCE = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g;
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.lovable']);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (IGNORED_DIRS.has(entry.name)) return [];
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }
      if (SCAN_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
        return [fullPath];
      }
      return [];
    }),
  );

  return nested.flat();
}

/**
 * Scanne un repertoire (par defaut `src/`) a la recherche de references a des
 * variables VITE_* qui ressemblent a des secrets (cle API, jeton, service
 * role...). Retourne la liste des violations trouvees ; un tableau vide
 * signifie que le garde-fou "aucune cle cote client" est respecte.
 */
export async function scanForClientSecrets(rootDir = 'src') {
  const absoluteRoot = resolve(rootDir);
  const violations = [];

  let files = [];
  try {
    files = await collectFiles(absoluteRoot);
  } catch (error) {
    if (error?.code === 'ENOENT') return violations;
    throw error;
  }

  const fileContents = await Promise.all(files.map((file) => readFile(file, 'utf8')));

  files.forEach((file, index) => {
    const content = fileContents[index];
    for (const match of content.matchAll(VITE_ENV_REFERENCE)) {
      const varName = match[1];
      if (ALLOWED_VITE_PUBLIC_VARS.has(varName)) continue;
      if (!SENSITIVE_NAME_PATTERN.test(varName)) continue;

      const line = content.slice(0, match.index).split('\n').length;
      violations.push({ file, line, varName });
    }
  });

  return violations;
}
