// npm run curriculum:preflight
//
// Preflight lot 1 : verifie le manifeste content/curriculum/v2/manifest.json
// (37 seances + 4 evaluations, coherence horaire 80/100/120h, identifiants
// uniques) et l'absence de secrets cote client. N'effectue aucun appel API
// payant (section 0, etape 1 ; section 9.1). Sortie non-zero si un manifeste
// est incomplet ou incoherent.

import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { runPreflight } from './lib/preflight-checks.mjs';

function valueAfter(args, flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);

  console.log('CapTCF â€” curriculum:preflight');
  console.log(`Manifeste : ${manifestPath}`);

  let manifestJson;
  try {
    manifestJson = await loadManifest(manifestPath);
  } catch (error) {
    console.error(`Impossible de lire le manifeste (${manifestPath}) : ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const { valid, errors, manifestResult, secretViolations } = await runPreflight({ manifestJson });

  if (manifestResult.hourReport) {
    console.log('\nCoherence horaire par palier :');
    for (const [palier, detail] of Object.entries(manifestResult.hourReport.details)) {
      console.log(
        `  ${palier} : ${detail.heures_cumulees}h cumulees / ${detail.heures_attendues}h attendues (cours ${detail.cours_heures}h, evaluations ${detail.evaluations_heures}h)`,
      );
    }
  }

  console.log(`\nSecrets cote client detectes : ${secretViolations.length}`);

  if (errors.length > 0) {
    console.log(`\n${errors.length} probleme(s) detecte(s) :`);
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
  }

  if (!valid) {
    console.error('\nPreflight ECHOUE. Aucun appel API n\'a ete effectue.');
    process.exitCode = 1;
    return;
  }

  console.log('\nPreflight REUSSI : manifeste complet et coherent, aucun secret cote client, aucun appel API effectue.');
}

main().catch((error) => {
  console.error('Erreur inattendue pendant le preflight :', error);
  process.exitCode = 1;
});
