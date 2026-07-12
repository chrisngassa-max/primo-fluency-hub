// npm run curriculum:publish -- --only S01
// npm run curriculum:publish -- --from S01 --to S05 [--batch-id <id>]
//
// Lot 3/section 9.6 : publication automatique et atomique-par-seance des
// ressources jugees publiables par curriculum:validate. Chaque publication
// cree une nouvelle version et conserve previous_published_version_id
// (restauration possible, section 9.7). Une seance non validee ou bloquee
// n'est jamais publiee.

import path from 'node:path';
import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { resolveSessionCodes } from './lib/session-order.mjs';
import { valueAfter, listAfter, hasFlag, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { createStoragePublisher } from './providers/storage-publisher.mjs';
import { readSessionManifest, readSessionJsonSibling, readResourceBuffer, relativePathForResource, sessionDir } from './lib/session-fs.mjs';
import { writeFile } from 'node:fs/promises';
import { syncPublishBridge } from './lib/publish-bridge.mjs';

const PUBLISHED_BUCKET = process.env.CURRICULUM_STORAGE_BUCKET ?? 'curriculum-published';
const AUDIO_BUCKET = process.env.CURRICULUM_AUDIO_BUCKET ?? 'curriculum-audio';

/** curriculum-published (defaut) ; MP3 TTS -> curriculum-audio (doc curriculum-cloud-setup §3). */
function bucketForResource(resourceEntry) {
  if (resourceEntry.kind === 'co_master' || resourceEntry.output_spec?.mime_type === 'audio/mpeg') {
    return AUDIO_BUCKET;
  }
  return PUBLISHED_BUCKET;
}

/** Publie atomiquement (par seance) toutes les ressources d'une seance deja validee/publiable. */
export async function publishOneSession({ sessionCode, storagePublisher, planVersionId, baseDir, allowPartialFamily = false }) {
  const manifest = await readSessionManifest(sessionCode, baseDir);
  if (!manifest) return { sessionCode, published: false, reason: 'not_generated' };

  const validation = await readSessionJsonSibling(sessionCode, 'validation-report.json', baseDir);
  if (!validation) return { sessionCode, published: false, reason: 'not_validated' };
  if (!validation.publishable) return { sessionCode, published: false, reason: 'blocked', blockingResources: validation.blocking_resources };

  const { sessionId, planVersionId: resolvedPlanVersionId } = await storagePublisher.resolvePublishContext({
    sessionCode,
    planVersionId,
  });

  const publishedResources = [];
  const now = new Date().toISOString();

  for (const resourceEntry of manifest.resources) {
    const buffer = await readResourceBuffer(sessionCode, resourceEntry.resource_id, baseDir);
    const relativePath = relativePathForResource(resourceEntry.resource_id);
    const storagePath = `${sessionCode}/${relativePath}`;
    const mime = resourceEntry.output_spec?.mime_type ?? null;

    const bucket = bucketForResource(resourceEntry);
    const { publicUrl } = await storagePublisher.upload({
      bucket,
      path: storagePath,
      buffer,
      contentType: mime ?? 'application/octet-stream',
    });

    const previousResource = await storagePublisher.latestSessionResource({
      sessionId,
      resourceId: resourceEntry.resource_id,
    });
    const previousPublication = previousResource
      ? await storagePublisher.latestPublication({ sessionResourceId: previousResource.id })
      : null;
    const version = (previousPublication?.version ?? previousResource?.version ?? 0) + 1;

    const row = await storagePublisher.insertSessionResource({
      session_id: sessionId,
      resource_id: resourceEntry.resource_id,
      kind: resourceEntry.kind,
      version,
      chemin: storagePath,
      mime,
      hash: resourceEntry.expected_hash,
      generation_mode: resourceEntry.generation_mode ?? null,
      statut: 'published',
      published_at: now,
      published_by: 'automation',
      previous_resource_version_id: previousResource?.id ?? null,
      metadata: { public_url: publicUrl },
    });

    if (previousResource) {
      await storagePublisher.supersedeSessionResource({ id: previousResource.id });
    }

    const publication = await storagePublisher.recordPublication({
      planVersionId: resolvedPlanVersionId,
      sessionResourceId: row.id,
      version,
      publishedBy: 'automation',
      previousPublicationId: previousPublication?.id ?? null,
    });

    publishedResources.push({ resource_id: resourceEntry.resource_id, session_resource_id: row.id, version, publication_id: publication.id });
  }

  const publicationRecord = {
    session_code: sessionCode,
    published_at: new Date().toISOString(),
    published_by: 'automation',
    resources: publishedResources,
  };
  await writeFile(path.join(sessionDir(sessionCode, baseDir), 'publication.json'), `${JSON.stringify(publicationRecord, null, 2)}\n`, 'utf8');

  let bridgeResult = null;
  try {
    bridgeResult = await syncPublishBridge({
      storagePublisher,
      sessionCode,
      sessionId,
      baseDir,
      publishedResources,
      allowPartialFamily,
    });
  } catch (bridgeError) {
    console.warn(`  ${sessionCode} : pont exercices echoue (publication storage OK) :`, bridgeError.message);
  }

  return { sessionCode, published: true, publishedResources, bridge: bridgeResult };
}

async function main() {
  const args = process.argv.slice(2);
  const only = listAfter(args, '--only');
  const from = valueAfter(args, '--from');
  const to = valueAfter(args, '--to');
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);
  const batchId = valueAfter(args, '--batch-id');

  console.log('CapTCF â€” curriculum:publish');

  const manifestJson = await loadManifest(manifestPath);
  const sessionCodes = resolveSessionCodes({ manifest: manifestJson, only, from, to });
  console.log(`SÃ©ance(s) ciblÃ©e(s) : ${sessionCodes.join(', ')}`);

  const storagePublisher = createStoragePublisher();
  const batchStore = batchId ? createBatchStore() : null;
  const batch = batchStore ? await batchStore.getBatch(batchId) : null;
  const planVersionId = process.env.CURRICULUM_PLAN_VERSION_ID ?? manifestJson.plan_version;
  const force = hasFlag(args, '--force');
  // Derogation EXPLICITE requise pour publier une famille A1/A2/B1/B2
  // incomplete (voir syncPublishBridge). Sans ce flag, une famille avec ne
  // serait-ce qu'un niveau bloque n'est PAS publiee dans `exercices` — elle
  // reste en brouillon, jamais annoncee comme publiee.
  const allowPartialFamily = hasFlag(args, '--allow-partial-family');
  if (allowPartialFamily) {
    console.log('  [derogation] --allow-partial-family actif : les familles incompletes seront publiees partiellement.');
  }

  let publishedCount = 0;
  let blockedCount = 0;
  let familiesRequiringOverride = 0;
  let incompleteFamilyCount = 0;

  for (const sessionCode of sessionCodes) {
    const existingJob = batch?.jobs?.[sessionCode];
    if (existingJob?.phase === 'publish' && existingJob?.status === 'succeeded' && !force) {
      console.log(`  ${sessionCode} : dÃ©jÃ  publiÃ© (batch ${batchId}) â€” ignorÃ© (--force pour republier).`);
      publishedCount += 1;
      continue;
    }

    const result = await publishOneSession({ sessionCode, storagePublisher, planVersionId, allowPartialFamily });

    if (result.published) {
      publishedCount += 1;
      const blockedVariantCount = result.bridge?.blocked_variants?.length ?? 0;
      const overrideNeeded = result.bridge?.families_requiring_override ?? [];
      familiesRequiringOverride += overrideNeeded.length;
      incompleteFamilyCount += (result.bridge?.families ?? []).filter((family) => family.status !== 'complete').length;
      const bridgeNote = result.bridge?.bridged
        ? ` · pont exercices : ${result.bridge.exercice_ids?.length ?? 0} ligne(s)`
          + (blockedVariantCount > 0 ? ` · ${blockedVariantCount} variante(s) BLOQUEE(S) (voir blocked_variants)` : '')
          + (overrideNeeded.length > 0
            ? ` · ${overrideNeeded.length} famille(s) NON PUBLIEE(S) faute de derogation (--allow-partial-family) : ${overrideNeeded.join(', ')}`
            : '')
        : result.bridge?.reason
          ? ` · pont exercices ignore (${result.bridge.reason})`
          : '';
      console.log(`  ${sessionCode} : PUBLIÃ‰ (${result.publishedResources.length} ressources)${bridgeNote}.`);
      for (const family of result.bridge?.families ?? []) {
        if (family.status !== 'complete') {
          console.log(
            `    - famille ${family.family_id} : ${family.status}`
            + ` (valides: ${family.niveaux_valides.join(',') || 'aucun'}`
            + `, bloques: ${family.niveaux_bloques.map((b) => `${b.niveau}[${b.reason}]`).join(',') || 'aucun'}`
            + `, manquants: ${family.niveaux_manquants.join(',') || 'aucun'}`
            + `, publiee: ${family.published})`,
          );
        }
      }
    } else if (result.reason === 'not_generated') {
      console.log(`  ${sessionCode} : pas encore gÃ©nÃ©rÃ© â€” exÃ©cutez curriculum:generate d'abord.`);
    } else if (result.reason === 'not_validated') {
      console.log(`  ${sessionCode} : pas encore validÃ© â€” exÃ©cutez curriculum:validate d'abord.`);
      blockedCount += 1;
    } else {
      console.log(`  ${sessionCode} : BLOQUÃ‰ (ressources non publiables) â€” publication refusÃ©e.`);
      blockedCount += 1;
    }

    if (batchStore) {
      await batchStore.upsertJob(batchId, sessionCode, {
        phase: 'publish',
        status: result.published ? 'succeeded' : 'quarantined',
        last_error: result.published ? null : (result.reason ?? 'blocked'),
      });
    }
  }

  console.log(`\nPubliÃ© : ${publishedCount} Â· Non publiÃ© : ${blockedCount}`);
  if (familiesRequiringOverride > 0) {
    console.log(`${familiesRequiringOverride} famille(s) en attente de derogation --allow-partial-family (voir details ci-dessus).`);
  }

  if (batchStore) {
    const status = blockedCount === 0 && incompleteFamilyCount === 0 ? 'published_complete' : publishedCount > 0 ? 'published_partial' : 'needs_attention';
    await batchStore.updateBatch(batchId, { status, counters: { published: publishedCount, blocked: blockedCount } });
  }

  if (hasFlag(args, '--strict') && (blockedCount > 0 || incompleteFamilyCount > 0)) process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant curriculum:publish :', error);
    process.exitCode = 1;
  });
}
