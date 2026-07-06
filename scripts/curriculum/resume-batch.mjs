// npm run curriculum:resume -- --batch-id <id>
//
// Section 9.5 : "Une relance avec la mÃªme idempotency_key reprend le job
// sans doublon." Recharge un batch persiste et rejoue generate -> validate
// -> (publish) uniquement pour les seances qui ne sont pas deja au statut
// 'succeeded' pour la phase concernee (aucun appel/depense redondant pour
// les seances deja terminees).

import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { valueAfter, hasFlag, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { createImageProvider } from './providers/image-provider.mjs';
import { createTtsProvider } from './providers/tts-provider.mjs';
import { createRenderer } from './providers/renderer.mjs';
import { runBatchPipeline } from './batch.mjs';

async function main() {
  const args = process.argv.slice(2);
  const batchId = valueAfter(args, '--batch-id');
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);
  const force = hasFlag(args, '--force');

  if (!batchId) {
    console.error('curriculum:resume requiert --batch-id <id>.');
    process.exitCode = 1;
    return;
  }

  console.log(`CapTCF â€” curriculum:resume (batch ${batchId})`);

  const batchStore = createBatchStore();
  const batch = await batchStore.getBatch(batchId);
  if (!batch) {
    console.error(`Batch introuvable : ${batchId}`);
    process.exitCode = 1;
    return;
  }

  if (batch.plan_version_id) {
    process.env.CURRICULUM_PLAN_VERSION_ID = batch.plan_version_id;
  }

  const manifestJson = await loadManifest(manifestPath);
  const sessionCodes = batch.config.session_codes;
  const providerConfig = batch.config.providers;
  const providers = { imageProvider: createImageProvider(), ttsProvider: createTtsProvider(), renderer: createRenderer() };

  const alreadyDone = Object.values(batch.jobs ?? {}).filter((job) => job.status === 'succeeded').length;
  console.log(`${sessionCodes.length} sÃ©ance(s) dans le batch, ${alreadyDone} job(s) dÃ©jÃ  au statut succeeded (repris sans nouvel appel).`);

  const result = await runBatchPipeline({
    batch,
    batchStore,
    sessionCodes,
    manifestJson,
    providers,
    providerConfig,
    publish: batch.config.publish ?? false,
    force,
  });

  console.log(`\nBatch ${batchId} â€” statut final : ${result.status}`);
  if (result.status === 'needs_attention' || result.status === 'failed') process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant curriculum:resume :', error);
    process.exitCode = 1;
  });
}
