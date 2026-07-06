// npm run curriculum:batch -- --from S01 --to S37 [--publish] [--dry-run]
//
// "Un seul batch" (section 0) : une commande orchestratrice unique qui cree
// UN batch persiste (reprenable via curriculum:resume, inspectable via
// curriculum:report) et enchaine generate -> validate -> (publish si
// --publish) pour chaque seance de la plage. Une seance en echec est mise
// en quarantaine ; le reste du batch continue (section 9.5).

import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { runPreflight } from './lib/preflight-checks.mjs';
import { resolveSessionCodes } from './lib/session-order.mjs';
import { valueAfter, listAfter, hasFlag, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { createImageProvider } from './providers/image-provider.mjs';
import { createTtsProvider } from './providers/tts-provider.mjs';
import { createRenderer } from './providers/renderer.mjs';
import { createContentProvider } from './providers/content-provider.mjs';
import { createStoragePublisher } from './providers/storage-publisher.mjs';
import { providerConfigFromEnv, runGenerateBatch } from './generate-batch.mjs';
import { validateOneSession } from './validate-batch.mjs';
import { publishOneSession } from './publish-batch.mjs';

/**
 * Enchaine generate -> validate -> (publish) pour un batch deja cree, en
 * reutilisant systematiquement le meme batch_id (utilise par batch.mjs et
 * resume-batch.mjs).
 */
export async function runBatchPipeline({ batch, batchStore, sessionCodes, manifestJson, providers, providerConfig, publish, force = false, log = console.log }) {
  const generateSummary = await runGenerateBatch({ sessionCodes, manifestJson, providers, providerConfig, dryRun: false, force, batchStore, batch, log });
  log(
    `\nGÃ©nÃ©ration â€” gÃ©nÃ©rÃ©: ${generateSummary.generated.length}, quarantaine: ${generateSummary.quarantined.length}, ` +
      `dÃ©jÃ  fait: ${generateSummary.skippedAlreadyGenerated.length}, sans brief: ${generateSummary.skippedNoBrief.length}.`,
  );

  const readyForValidation = sessionCodes.filter(
    (code) => generateSummary.generated.includes(code) || generateSummary.skippedAlreadyGenerated.includes(code),
  );

  const contentProvider = createContentProvider();
  let validatedCount = 0;
  let blockedCount = 0;

  for (const sessionCode of readyForValidation) {
    const existingJob = batch.jobs?.[sessionCode];
    if (existingJob?.phase === 'validate' && existingJob?.status === 'succeeded' && !force) {
      validatedCount += 1;
      continue;
    }
    const result = await validateOneSession({ sessionCode, contentProvider });
    if (result.generated && result.report.publishable) {
      validatedCount += 1;
      await batchStore.upsertJob(batch.batch_id, sessionCode, { phase: 'validate', status: 'succeeded', last_error: null });
    } else {
      blockedCount += 1;
      const errorSummary = result.generated ? result.report.blocking_resources.map((b) => b.resource_id).join(', ') : 'not_generated';
      await batchStore.upsertJob(batch.batch_id, sessionCode, { phase: 'validate', status: 'quarantined', last_error: errorSummary });
      log(`  ${sessionCode} : BLOQUÃ‰ Ã  la validation â€” ${errorSummary}`);
    }
  }
  log(`Validation â€” publiable: ${validatedCount}, bloquÃ©: ${blockedCount}.`);

  let publishedCount = 0;
  let publishBlockedCount = 0;

  if (publish) {
    const planVersionId = process.env.CURRICULUM_PLAN_VERSION_ID ?? manifestJson.plan_version;
    const storagePublisher = createStoragePublisher();

    for (const sessionCode of readyForValidation) {
      const existingJob = batch.jobs?.[sessionCode];
      if (existingJob?.phase === 'publish' && existingJob?.status === 'succeeded' && !force) {
        publishedCount += 1;
        continue;
      }
      const result = await publishOneSession({ sessionCode, storagePublisher, planVersionId });
      if (result.published) {
        publishedCount += 1;
        await batchStore.upsertJob(batch.batch_id, sessionCode, { phase: 'publish', status: 'succeeded', last_error: null });
      } else {
        publishBlockedCount += 1;
        await batchStore.upsertJob(batch.batch_id, sessionCode, { phase: 'publish', status: 'quarantined', last_error: result.reason ?? 'blocked' });
      }
    }
    log(`Publication â€” publiÃ©: ${publishedCount}, non publiÃ©: ${publishBlockedCount}.`);
  }

  const anyBlocked = generateSummary.quarantined.length > 0 || blockedCount > 0 || publishBlockedCount > 0;
  const anySucceeded = publish ? publishedCount > 0 : validatedCount > 0;
  const status = !anyBlocked ? (publish ? 'published_complete' : 'paused') : anySucceeded ? (publish ? 'published_partial' : 'needs_attention') : 'needs_attention';

  await batchStore.updateBatch(batch.batch_id, {
    status,
    counters: { generate: generateSummary, validate: { publishable: validatedCount, blocked: blockedCount }, publish: { published: publishedCount, blocked: publishBlockedCount } },
  });

  return { generateSummary, validatedCount, blockedCount, publishedCount, publishBlockedCount, status };
}

async function main() {
  const args = process.argv.slice(2);
  const only = listAfter(args, '--only');
  const from = valueAfter(args, '--from');
  const to = valueAfter(args, '--to');
  const dryRun = hasFlag(args, '--dry-run');
  const publish = hasFlag(args, '--publish');
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);

  console.log('CapTCF â€” curriculum:batch (orchestrateur unique)');

  const manifestJson = await loadManifest(manifestPath);
  const { valid, errors } = await runPreflight({ manifestJson });
  if (!valid) {
    console.error('Preflight Ã©chouÃ©, batch non dÃ©marrÃ© :');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  const sessionCodes = resolveSessionCodes({ manifest: manifestJson, only, from, to });
  console.log(
    `${sessionCodes.length} sÃ©ance(s) : ${sessionCodes[0]}..${sessionCodes.at(-1)}${dryRun ? ' (dry-run)' : ''}${publish ? ' + publication automatique' : ''}`,
  );

  const providerConfig = providerConfigFromEnv();
  const providers = { imageProvider: createImageProvider(), ttsProvider: createTtsProvider(), renderer: createRenderer() };

  if (dryRun) {
    const summary = await runGenerateBatch({ sessionCodes, manifestJson, providers, providerConfig, dryRun: true, batchStore: null, batch: null });
    console.log(`\nDry-run â€” ok: ${summary.generated.length}, sans brief: ${summary.skippedNoBrief.length}.`);
    return;
  }

  const batchStore = createBatchStore();
  const batch = await batchStore.createBatch({ config: { session_codes: sessionCodes, providers: providerConfig, publish } });
  console.log(`Batch : ${batch.batch_id}`);

  const result = await runBatchPipeline({ batch, batchStore, sessionCodes, manifestJson, providers, providerConfig, publish });

  console.log(`\nBatch ${batch.batch_id} â€” statut final : ${result.status}`);
  console.log(`Rapport : npm run curriculum:report -- --batch-id ${batch.batch_id}`);
  if (result.status === 'needs_attention' || result.status === 'failed') process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant curriculum:batch :', error);
    process.exitCode = 1;
  });
}
