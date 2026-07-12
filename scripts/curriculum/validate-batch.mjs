// npm run curriculum:validate -- --only S01
// npm run curriculum:validate -- --from S01 --to S05 [--batch-id <id>]
//
// Lot 3, section 9.4 : double controle sur les ressources deja generees sur
// disque (content/curriculum/v2/SXX/manifest.json) â€” controle 1 deterministe
// (toujours) puis controle 2 IA de revue (uniquement pour les ressources a
// contenu pedagogique : support-master, variantes, exercices, qcm civique,
// visuel maitre). Ecrit content/curriculum/v2/SXX/validation-report.json et
// visual/VIS-validation.json (section 5).

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { resolveSessionCodes } from './lib/session-order.mjs';
import { valueAfter, listAfter, hasFlag, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { createContentProvider } from './providers/content-provider.mjs';
import { readSessionManifest, readResourceBuffer, sessionDir } from './lib/session-fs.mjs';
import { runDeterministicChecks } from './validators/deterministic.mjs';
import { runAiReview } from './validators/anthropic-review.mjs';
import { isPublishableReport } from './schemas/validation-report.schema.mjs';

const REVIEWABLE_KINDS = new Set(['support_master_json', 'variantes_json', 'exercices_json', 'qcm_civique_json', 'vis_master_svg']);

// PNG et WebP sont deux rendus derives du meme SVG maitre : ils peuvent
// legitimement partager les memes octets sous RENDERER=fake (qui ne sait
// produire qu'un vrai PNG hors-ligne, section 4.3). La detection de doublon
// (qui vise a reperer une VRAIE collision accidentelle entre deux
// ressources distinctes) ne doit donc pas les comparer entre eux.
const DEDUP_EXEMPT_KINDS = new Set(['vis_master_png', 'vis_master_webp']);

export function shouldRunAiReview(manifest, resourceKind) {
  return manifest.validation_policy?.ai_review !== false && REVIEWABLE_KINDS.has(resourceKind);
}

function reviewContentFor(resourceEntry, buffer) {
  if (resourceEntry.kind === 'vis_master_svg') {
    return { svg: buffer.toString('utf8'), alt_text: resourceEntry.alt_text };
  }
  return JSON.parse(buffer.toString('utf8'));
}

/** Valide une seance deja generee sur disque. Retourne le rapport complet + le verdict publiable. */
export async function validateOneSession({ sessionCode, contentProvider, baseDir }) {
  const manifest = await readSessionManifest(sessionCode, baseDir);
  if (!manifest) {
    return { sessionCode, generated: false };
  }

  const knownHashes = new Set();
  const resourceReports = {};
  const blockingResources = [];

  // Le script figÃ© (CO-script.md) est la transcription de reference pour
  // les ressources audio de la seance (section 5) ; resourceSchema ne
  // porte pas de champ `transcript` dedie (section 8.3), on la relit donc
  // depuis le fichier source plutot que de la dupliquer dans le manifeste.
  const scriptResource = manifest.resources.find((r) => r.kind === 'co_script');
  const transcript = scriptResource ? (await readResourceBuffer(sessionCode, scriptResource.resource_id, baseDir)).toString('utf8') : null;

  for (const resourceEntry of manifest.resources) {
    const buffer = await readResourceBuffer(sessionCode, resourceEntry.resource_id, baseDir);
    const isAudioResource = resourceEntry.kind === 'co_transcript' || resourceEntry.output_spec?.mime_type === 'audio/mpeg';

    const deterministic = runDeterministicChecks(
      {
        resource_id: resourceEntry.resource_id,
        kind: resourceEntry.kind,
        mimeType: resourceEntry.output_spec?.mime_type,
        altText: resourceEntry.alt_text,
        transcript: isAudioResource ? transcript : null,
        sourceIds: resourceEntry.source_ids,
        rightsStatus: resourceEntry.rights_status,
        expectedHash: resourceEntry.expected_hash,
      },
      buffer,
      { knownHashes: DEDUP_EXEMPT_KINDS.has(resourceEntry.kind) ? new Set() : knownHashes },
    );
    if (!DEDUP_EXEMPT_KINDS.has(resourceEntry.kind)) knownHashes.add(deterministic.rapport.checks.hash);

    let aiReview = null;
    if (shouldRunAiReview(manifest, resourceEntry.kind)) {
      const content = reviewContentFor(resourceEntry, buffer);
      const result = await runAiReview(contentProvider, { resourceId: resourceEntry.resource_id, content });
      aiReview = result.report;
    }

    const publishable = isPublishableReport(deterministic) && (!aiReview || isPublishableReport(aiReview));
    resourceReports[resourceEntry.resource_id] = { deterministic, ai_review: aiReview, publishable };

    if (!publishable) {
      blockingResources.push({
        resource_id: resourceEntry.resource_id,
        bloquants: [...deterministic.bloquants, ...(aiReview?.bloquants ?? [])],
      });
    }
  }

  const sessionPublishable = blockingResources.length === 0;
  const report = {
    session_code: sessionCode,
    validated_at: new Date().toISOString(),
    publishable: sessionPublishable,
    blocking_resources: blockingResources,
    resources: resourceReports,
  };

  const dir = sessionDir(sessionCode, baseDir);
  await writeFile(path.join(dir, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (resourceReports['vis-master-svg']) {
    await mkdir(path.join(dir, 'visual'), { recursive: true });
    await writeFile(
      path.join(dir, 'visual', 'VIS-validation.json'),
      `${JSON.stringify(resourceReports['vis-master-svg'], null, 2)}\n`,
      'utf8',
    );
  }

  return { sessionCode, generated: true, report };
}

async function main() {
  const args = process.argv.slice(2);
  const only = listAfter(args, '--only');
  const from = valueAfter(args, '--from');
  const to = valueAfter(args, '--to');
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);
  const batchId = valueAfter(args, '--batch-id');

  console.log('CapTCF â€” curriculum:validate');

  const manifestJson = await loadManifest(manifestPath);
  const sessionCodes = resolveSessionCodes({ manifest: manifestJson, only, from, to });
  console.log(`SÃ©ance(s) ciblÃ©e(s) : ${sessionCodes.join(', ')}`);

  const contentProvider = createContentProvider();
  const batchStore = batchId ? createBatchStore() : null;
  const batch = batchStore ? await batchStore.getBatch(batchId) : null;
  const force = hasFlag(args, '--force');

  let publishableCount = 0;
  let blockedCount = 0;
  let notGeneratedCount = 0;

  for (const sessionCode of sessionCodes) {
    const existingJob = batch?.jobs?.[sessionCode];
    if (existingJob?.phase === 'validate' && existingJob?.status === 'succeeded' && !force) {
      console.log(`  ${sessionCode} : dÃ©jÃ  validÃ© (batch ${batchId}) â€” ignorÃ© (--force pour revalider).`);
      publishableCount += 1;
      continue;
    }

    const result = await validateOneSession({ sessionCode, contentProvider });

    if (!result.generated) {
      console.log(`  ${sessionCode} : pas encore gÃ©nÃ©rÃ© (aucun manifest.json) â€” ignorÃ©.`);
      notGeneratedCount += 1;
      continue;
    }

    if (result.report.publishable) {
      publishableCount += 1;
      console.log(`  ${sessionCode} : PUBLIABLE (${Object.keys(result.report.resources).length} ressources contrÃ´lÃ©es).`);
    } else {
      blockedCount += 1;
      console.log(`  ${sessionCode} : BLOQUÃ‰ â€” ${result.report.blocking_resources.length} ressource(s) en Ã©chec :`);
      for (const blocking of result.report.blocking_resources) {
        console.log(`    - ${blocking.resource_id} : ${blocking.bloquants.join(' | ')}`);
      }
    }

    if (batchStore) {
      await batchStore.upsertJob(batchId, sessionCode, {
        phase: 'validate',
        status: result.report.publishable ? 'succeeded' : 'quarantined',
        last_error: result.report.publishable ? null : result.report.blocking_resources.map((b) => b.resource_id).join(', '),
      });
    }
  }

  console.log(`\nPubliable : ${publishableCount} Â· BloquÃ© : ${blockedCount} Â· Non gÃ©nÃ©rÃ© : ${notGeneratedCount}`);
  if (hasFlag(args, '--strict') && (blockedCount > 0 || notGeneratedCount > 0)) process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant curriculum:validate :', error);
    process.exitCode = 1;
  });
}
