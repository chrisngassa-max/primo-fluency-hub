import { curriculumManifestSchema } from '../schemas/curriculum-manifest.schema.mjs';
import { validateCumulativeHours } from './hours.mjs';
import { scanForClientSecrets } from './no-client-secrets.mjs';

/**
 * Valide la structure du manifeste racine (section 0, etape 1-2 ; section
 * 9.1). Purement statique : aucun appel reseau, aucune ecriture disque.
 * Retourne { valid, errors, hourReport } pour permettre a la fois un usage
 * CLI (preflight.mjs) et des tests unitaires (section 12.1).
 */
export function validateManifest(manifestJson) {
  const result = curriculumManifestSchema.safeParse(manifestJson);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.length ? `[${issue.path.join('.')}] ` : '';
      return `${path}${issue.message}`;
    });
    return { valid: false, errors, hourReport: null };
  }

  const hourReport = validateCumulativeHours(result.data.entries);
  return {
    valid: hourReport.valid,
    errors: hourReport.errors,
    hourReport,
    data: result.data,
  };
}

/**
 * Preflight complet du lot 1 : coherence du manifeste + garde-fou "pas de
 * secret cote client" (section 1.3/13). Les verifications reseau/budget/
 * stockage (section 9.1) rejoignent cette fonction a partir du lot 2, quand
 * un batch de generation existe reellement.
 */
export async function runPreflight({ manifestJson, srcDir = 'src' } = {}) {
  const manifestResult = validateManifest(manifestJson);
  const secretViolations = await scanForClientSecrets(srcDir);

  const errors = [...manifestResult.errors];
  for (const violation of secretViolations) {
    errors.push(
      `Secret expose cote client : ${violation.varName} referencee dans ${violation.file}:${violation.line}.`,
    );
  }

  return {
    valid: manifestResult.valid && secretViolations.length === 0,
    errors,
    manifestResult,
    secretViolations,
  };
}
