// npm run curriculum:generate -- --only S01 [--dry-run] [--force]
// npm run curriculum:generate -- --from S01 --to S05
//
// Lot 3, section 9.2 : genere le paquet standard d'une ou plusieurs seances
// (support-master, variantes A1-A2-B1-B2, visuel, audio, lexique, exercices,
// devoirs, fiches formateur/apprenant) en composant les providers du lot 2,
// puis ecrit le paquet sur disque (content/curriculum/v2/SXX/) et un
// manifest.json valide par sessionManifestSchema. Reprise et quarantaine
// apres 3 tentatives (section 9.5).

import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { runPreflight } from './lib/preflight-checks.mjs';
import { resolveSessionCodes, findManifestEntry } from './lib/session-order.mjs';
import { valueAfter, listAfter, hasFlag, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { createImageProvider } from './providers/image-provider.mjs';
import { createTtsProvider } from './providers/tts-provider.mjs';
import { createRenderer } from './providers/renderer.mjs';
import { generateSessionPackage } from './lib/session-pipeline.mjs';
import { readSessionBrief, writeSessionPackageToDisk } from './lib/session-fs.mjs';
import { hashContent } from './lib/hash.mjs';
import { sessionManifestSchema } from './schemas/session-manifest.schema.mjs';

export const MAX_ATTEMPTS = 3;

export function providerConfigFromEnv(env = process.env) {
  return {
    content: (env.CONTENT_PROVIDER ?? 'anthropic').toLowerCase(),
    image: (env.IMAGE_PROVIDER ?? 'svg').toLowerCase(),
    tts: (env.TTS_PROVIDER ?? 'google').toLowerCase(),
    renderer: (env.RENDERER ?? 'playwright').toLowerCase(),
    storage: (env.STORAGE_PUBLISHER ?? 'supabase').toLowerCase(),
  };
}

function buildSessionManifest({ sessionCode, manifestJson, manifestEntry, resources, variantsList }) {
  return {
    session_code: sessionCode,
    plan_version: manifestJson.plan_version,
    support_id: variantsList[0]?.support_id,
    type_seance: manifestEntry.type_seance,
    objectifs: manifestEntry.objectifs,
    competences: manifestEntry.competences,
    civic_theme: manifestEntry.civic_theme,
    civic_mention: manifestEntry.civic_mention,
    source_ids: manifestEntry.source_ids ?? [],
    resources: resources.map((resource) => ({
      resource_id: resource.resource_id,
      kind: resource.kind,
      required: true,
      generation_mode: resource.generation_mode,
      prompt_version: null,
      required_elements: resource.required_elements,
      forbidden_elements: resource.forbidden_elements,
      source_ids: resource.source_ids,
      rights_status: resource.rights_status,
      output_spec: { mime_type: resource.mimeType },
      alt_text: resource.alt_text,
      depends_on_answer: resource.depends_on_answer,
      expected_hash: resource.hash,
      dependencies: resource.dependencies,
    })),
    variants: variantsList.map((variant) => ({ niveau: variant.niveau, resource_id: 'variantes-a1-a2-b1-b2' })),
    duration_plan: { total_minutes: manifestEntry.duree_minutes ?? null },
    validation_policy: { deterministic: true, ai_review: true, min_quality_score: 4, min_pedagogical_relevance_score: 4 },
    publication_policy: { auto_publish: true, max_attempts: MAX_ATTEMPTS },
  };
}

/**
 * Genere une seance (sans reprise ni tentative multiple) : utilise par
 * `runGenerateBatch` (qui gere les tentatives/quarantaine) et par les tests.
 */
export async function generateOneSession({ sessionCode, manifestJson, brief, providers, baseDir }) {
  const manifestEntry = findManifestEntry(manifestJson, sessionCode);
  const { supportHash, variantsList, resources } = await generateSessionPackage({ sessionCode, brief, providers });
  const sessionManifest = buildSessionManifest({ sessionCode, manifestJson, manifestEntry, resources, variantsList });
  sessionManifestSchema.parse(sessionManifest);
  await writeSessionPackageToDisk({ sessionCode, resources, manifest: sessionManifest, baseDir });
  return { supportHash, resources, sessionManifest };
}

/**
 * Orchestre la generation d'une liste de seances avec persistance de batch
 * (reprise, idempotency_key, quarantaine apres 3 tentatives — section 9.5).
 * Reutilisable par generate-batch.mjs (CLI), batch.mjs et resume-batch.mjs.
 */
export async function runGenerateBatch({ sessionCodes, manifestJson, providers, providerConfig, dryRun = false, force = false, batchStore, batch, log = console.log, baseDir }) {
  const summary = { generated: [], quarantined: [], skippedNoBrief: [], skippedAlreadyGenerated: [] };

  for (const sessionCode of sessionCodes) {
    const brief = await readSessionBrief(sessionCode, baseDir).catch(() => null);
    if (!brief) {
      log(`  ${sessionCode} : aucun brief.json — ignoré (contenu pas encore rédigé, lot 4).`);
      summary.skippedNoBrief.push(sessionCode);
      continue;
    }

    const idempotencyKey = hashContent({ sessionCode, brief, providerConfig });
    const existingJob = batch?.jobs?.[sessionCode];

    if (!dryRun && existingJob?.status === 'succeeded' && existingJob?.idempotency_key === idempotencyKey && !force) {
      log(`  ${sessionCode} : déjà généré avec la même idempotency_key — ignoré (--force pour régénérer).`);
      summary.skippedAlreadyGenerated.push(sessionCode);
      continue;
    }

    if (dryRun) {
      log(`  ${sessionCode} : dry-run OK — brief valide, aucun appel provider (idempotency_key=${idempotencyKey.slice(0, 12)}...).`);
      summary.generated.push(sessionCode);
      continue;
    }

    let attempts = existingJob?.idempotency_key === idempotencyKey ? (existingJob?.attempts ?? 0) : 0;
    let lastError = existingJob?.last_error ?? null;
    let succeeded = false;

    if (batch) await batchStore.upsertJob(batch.batch_id, sessionCode, { phase: 'generate', status: 'running', idempotency_key: idempotencyKey, attempts });

    while (attempts < MAX_ATTEMPTS && !succeeded) {
      attempts += 1;
      try {
        const { supportHash, resources } = await generateOneSession({ sessionCode, manifestJson, brief, providers, baseDir });
        succeeded = true;
        summary.generated.push(sessionCode);
        log(`  ${sessionCode} : généré (${resources.length} ressources, support_hash=${supportHash.slice(0, 12)}...).`);
        if (batch) {
          await batchStore.upsertJob(batch.batch_id, sessionCode, {
            phase: 'generate',
            status: 'succeeded',
            attempts,
            idempotency_key: idempotencyKey,
            last_error: null,
            support_hash: supportHash,
            resource_count: resources.length,
          });
        }
      } catch (error) {
        lastError = error.message;
        log(`  ${sessionCode} : échec tentative ${attempts}/${MAX_ATTEMPTS} — ${error.message}`);
      }
    }

    if (!succeeded) {
      summary.quarantined.push(sessionCode);
      log(`  ${sessionCode} : QUARANTAINE après ${MAX_ATTEMPTS} tentatives — ${lastError}`);
      if (batch) {
        await batchStore.upsertJob(batch.batch_id, sessionCode, {
          phase: 'generate',
          status: 'quarantined',
          attempts,
          idempotency_key: idempotencyKey,
          last_error: lastError,
        });
      }
    }
  }

  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const only = listAfter(args, '--only');
  const from = valueAfter(args, '--from');
  const to = valueAfter(args, '--to');
  const dryRun = hasFlag(args, '--dry-run');
  const force = hasFlag(args, '--force');
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);
  const existingBatchId = valueAfter(args, '--batch-id');

  console.log('CapTCF — curriculum:generate');

  const manifestJson = await loadManifest(manifestPath);
  const { valid, errors } = await runPreflight({ manifestJson });
  if (!valid) {
    console.error('Preflight échoué, aucune génération lancée :');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  const sessionCodes = resolveSessionCodes({ manifest: manifestJson, only, from, to });
  console.log(`Séance(s) ciblée(s) : ${sessionCodes.join(', ')}${dryRun ? ' (dry-run)' : ''}`);

  const providerConfig = providerConfigFromEnv();
  const providers = { imageProvider: createImageProvider(), ttsProvider: createTtsProvider(), renderer: createRenderer() };

  let batchStore = null;
  let batch = null;
  if (!dryRun) {
    batchStore = createBatchStore();
    batch = existingBatchId
      ? await batchStore.getBatch(existingBatchId)
      : await batchStore.createBatch({ config: { session_codes: sessionCodes, providers: providerConfig } });
    if (!batch) throw new Error(`Batch introuvable : ${existingBatchId}`);
    console.log(`Batch : ${batch.batch_id}`);
  }

  const summary = await runGenerateBatch({ sessionCodes, manifestJson, providers, providerConfig, dryRun, force, batchStore, batch });
  const skippedTotal = summary.skippedNoBrief.length + summary.skippedAlreadyGenerated.length;

  console.log(`\nGénéré : ${summary.generated.length} · Quarantaine : ${summary.quarantined.length} · Ignoré : ${skippedTotal}`);

  if (batch) {
    const status = summary.quarantined.length > 0 ? (summary.generated.length > 0 ? 'needs_attention' : 'failed') : 'paused';
    await batchStore.updateBatch(batch.batch_id, { status, counters: summary });
    console.log(`Batch id (pour curriculum:validate/publish/resume/report) : ${batch.batch_id}`);
  }

  if (summary.quarantined.length > 0) process.exitCode = 1;
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant curriculum:generate :', error);
    process.exitCode = 1;
  });
}
