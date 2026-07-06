// Polls resource_generation_batches (etat=running) and runs generate→validate→publish
// via runBatchPipeline + SupabaseBatchStore. Bridges UI-started batches to the CLI pipeline.
//
// Usage:
//   BATCH_STORE=supabase npm run curriculum:worker -- --once
//   BATCH_STORE=supabase npm run curriculum:worker -- --batch-id <uuid>
//   BATCH_STORE=supabase npm run curriculum:worker -- --poll-interval 15000
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: CONTENT_PROVIDER=fake IMAGE_PROVIDER=svg (évite les appels API réels en dev)
// CURRICULUM_PLAN_VERSION_ID is set per-batch from plan_version_id when processing.

import { createClient } from '@supabase/supabase-js';
import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { valueAfter, hasFlag, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { createImageProvider } from './providers/image-provider.mjs';
import { createTtsProvider } from './providers/tts-provider.mjs';
import { createRenderer } from './providers/renderer.mjs';
import { providerConfigFromEnv } from './generate-batch.mjs';
import { runBatchPipeline } from './batch.mjs';

function requireEnv(name) {
  const value = process.env[name] ?? process.env[name.replace('SUPABASE_', 'VITE_SUPABASE_')];
  if (!value) throw new Error(`${name} requis pour le worker Supabase.`);
  return value;
}

async function listRunningBatches(client, batchId) {
  let query = client
    .from('resource_generation_batches')
    .select('id, plan_version_id, configuration, etat')
    .in('etat', ['running', 'pending'])
    .order('created_at', { ascending: true });

  if (batchId) query = query.eq('id', batchId);

  const { data, error } = await query;
  if (error) throw new Error(`Impossible de lister les batches : ${error.message}`);
  return data ?? [];
}

async function processOneBatch({ batchRow, manifestJson, force, log }) {
  const planVersionId = batchRow.plan_version_id;
  process.env.CURRICULUM_PLAN_VERSION_ID = planVersionId;
  process.env.BATCH_STORE = 'supabase';

  const batchStore = createBatchStore();
  const batch = await batchStore.getBatch(batchRow.id);
  if (!batch) {
    log(`  Batch ${batchRow.id} introuvable après rechargement — ignoré.`);
    return { skipped: true };
  }

  const sessionCodes = batch.config?.session_codes;
  if (!Array.isArray(sessionCodes) || sessionCodes.length === 0) {
    await batchStore.updateBatch(batchRow.id, {
      status: 'failed',
      report: { error: 'configuration.session_codes manquant ou vide' },
    });
    throw new Error(`Batch ${batchRow.id} : session_codes invalide dans configuration.`);
  }

  const providerConfig = batch.config.providers ?? providerConfigFromEnv();
  const providers = {
    imageProvider: createImageProvider(),
    ttsProvider: createTtsProvider(),
    renderer: createRenderer(),
  };

  log(`  Traitement batch ${batchRow.id.slice(0, 8)}… (${sessionCodes.length} séances, plan ${planVersionId.slice(0, 8)}…)`);

  const result = await runBatchPipeline({
    batch,
    batchStore,
    sessionCodes,
    manifestJson,
    providers,
    providerConfig,
    publish: batch.config.publish ?? false,
    force,
    log,
  });

  return { batchId: batchRow.id, ...result };
}

export async function runSupabaseBatchWorker({
  batchId,
  once = false,
  pollIntervalMs = 15_000,
  dryRun = false,
  force = false,
  manifestPath = DEFAULT_MANIFEST_PATH,
  log = console.log,
} = {}) {
  if ((process.env.BATCH_STORE ?? 'file') !== 'supabase') {
    throw new Error('BATCH_STORE=supabase requis (worker Supabase uniquement).');
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const manifestJson = await loadManifest(manifestPath);
  log('CapTCF — curriculum worker (Supabase)');

  const tick = async () => {
    const batches = await listRunningBatches(client, batchId);
    if (batches.length === 0) {
      log("Aucun batch en etat running/pending.");
      return 0;
    }

    log(`${batches.length} batch(es) running…`);
    if (dryRun) {
      for (const b of batches) log(`  [dry-run] ${b.id} plan=${b.plan_version_id}`);
      return batches.length;
    }

    for (const batchRow of batches) {
      try {
        const result = await processOneBatch({ batchRow, manifestJson, force, log });
        log(`  Batch ${batchRow.id.slice(0, 8)}… terminé — statut ${result.status ?? 'skipped'}`);
      } catch (err) {
        log(`  Batch ${batchRow.id} en échec : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return batches.length;
  };

  if (once || batchId) {
    await tick();
    return;
  }

  log(`Polling toutes les ${pollIntervalMs}ms (Ctrl+C pour arrêter)…`);
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

async function main() {
  const args = process.argv.slice(2);
  await runSupabaseBatchWorker({
    batchId: valueAfter(args, '--batch-id'),
    once: hasFlag(args, '--once') || hasFlag(args, '--batch-id') && !hasFlag(args, '--poll'),
    pollIntervalMs: Number(valueAfter(args, '--poll-interval', '15000')) || 15_000,
    dryRun: hasFlag(args, '--dry-run'),
    force: hasFlag(args, '--force'),
    manifestPath: valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH),
  });
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur worker curriculum :', error);
    process.exitCode = 1;
  });
}
