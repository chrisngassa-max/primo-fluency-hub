// npm run curriculum:report -- --batch-id <id>
//
// Section 14, point 13 : "un rapport final liste pour chaque seance :
// ressources prevues, generees, validees, publiees, quarantaines, couts,
// sources et hashes."

import { valueAfter, isMainModule } from './lib/cli-args.mjs';
import { createBatchStore } from './lib/batch-store.mjs';
import { readSessionManifest } from './lib/session-fs.mjs';

function phaseLabel(job) {
  if (!job) return 'non dÃ©marrÃ©';
  return `${job.phase ?? '?'} â†’ ${job.status}${job.attempts ? ` (tentative ${job.attempts})` : ''}`;
}

export async function buildBatchReport(batch) {
  const rows = [];
  for (const sessionCode of batch.config.session_codes ?? []) {
    const job = batch.jobs?.[sessionCode];
    const manifest = await readSessionManifest(sessionCode).catch(() => null);
    rows.push({
      session_code: sessionCode,
      status: job?.status ?? 'not_started',
      phase: job?.phase ?? null,
      attempts: job?.attempts ?? 0,
      support_hash: job?.support_hash ?? null,
      resource_count: job?.resource_count ?? manifest?.resources?.length ?? 0,
      source_ids: manifest?.source_ids ?? [],
      last_error: job?.last_error ?? null,
    });
  }
  return { batch_id: batch.batch_id, status: batch.status, created_at: batch.created_at, updated_at: batch.updated_at, config: batch.config, rows };
}

async function main() {
  const args = process.argv.slice(2);
  const batchId = valueAfter(args, '--batch-id');
  const asJson = args.includes('--json');

  if (!batchId) {
    console.error('curriculum:report requiert --batch-id <id>.');
    process.exitCode = 1;
    return;
  }

  const batchStore = createBatchStore();
  const batch = await batchStore.getBatch(batchId);
  if (!batch) {
    console.error(`Batch introuvable : ${batchId}`);
    process.exitCode = 1;
    return;
  }

  const report = await buildBatchReport(batch);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`CapTCF â€” rapport du batch ${report.batch_id}`);
  console.log(`Statut global : ${report.status} (crÃ©Ã© ${report.created_at}, mis Ã  jour ${report.updated_at})`);
  console.log(`Configuration : ${JSON.stringify(report.config)}`);
  console.log('\nSÃ©ance      | Statut                              | Ressources | Hash support     | Sources | Erreur');
  console.log('------------|-------------------------------------|------------|------------------|---------|-------');
  for (const row of report.rows) {
    console.log(
      `${row.session_code.padEnd(11)} | ${phaseLabel(row).padEnd(37)} | ${String(row.resource_count).padEnd(10)} | ${(row.support_hash ?? '-').slice(0, 16).padEnd(16)} | ${String(row.source_ids.length).padEnd(7)} | ${row.last_error ?? ''}`,
    );
  }

  const succeeded = report.rows.filter((r) => r.status === 'succeeded').length;
  const quarantined = report.rows.filter((r) => r.status === 'quarantined').length;
  console.log(`\nTotal : ${report.rows.length} sÃ©ance(s) Â· succÃ¨s : ${succeeded} Â· quarantaine : ${quarantined}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error('Erreur inattendue pendant curriculum:report :', error);
    process.exitCode = 1;
  });
}
