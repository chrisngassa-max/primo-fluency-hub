// Generates idempotent SQL seed for training_plan_versions + training_sessions
// from content/curriculum/v2/manifest.json.
//
// Usage:
//   node scripts/curriculum/generate-plan-seed-sql.mjs > supabase/migrations/20260706160000_seed_curriculum_v2_plan.sql
//   node scripts/curriculum/generate-plan-seed-sql.mjs --stdout   (print only)

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_MANIFEST_PATH, loadManifest } from './lib/manifest-io.mjs';
import { valueAfter, hasFlag } from './lib/cli-args.mjs';

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  if (!values?.length) return "ARRAY[]::text[]";
  return `ARRAY[${values.map((v) => sqlLiteral(v)).join(', ')}]`;
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function buildMigrationSql(manifest) {
  const lines = [
    '-- CapTCF — Seed curriculum v2 plan + sessions from manifest.json',
    '-- Idempotent: safe to re-run. Does not touch cohort pins, batches, or published resources.',
    '',
    'BEGIN;',
    '',
    'DO $$',
    'DECLARE',
    '  v_plan_id uuid;',
    'BEGIN',
    `  INSERT INTO public.training_plan_versions (version, statut, notes, activated_at)`,
    `  VALUES (`,
    `    ${sqlLiteral(manifest.version)},`,
    `    'active',`,
    `    ${sqlLiteral(`Manifest plan_version ${manifest.plan_version} (generated ${manifest.generated_at})`)},`,
    '    now()',
    '  )',
    '  ON CONFLICT (version) DO UPDATE SET',
    "    statut = 'active',",
    '    notes = EXCLUDED.notes,',
    '    activated_at = COALESCE(public.training_plan_versions.activated_at, EXCLUDED.activated_at),',
    '    updated_at = now()',
    '  RETURNING id INTO v_plan_id;',
    '',
    '  IF v_plan_id IS NULL THEN',
    '    SELECT id INTO v_plan_id FROM public.training_plan_versions WHERE version = ' +
      sqlLiteral(manifest.version) +
      ' LIMIT 1;',
    '  END IF;',
    '',
  ];

  for (const entry of manifest.entries) {
    const moduleVal = entry.module === null ? 'NULL' : sqlLiteral(entry.module);
    const civicTheme = entry.civic_theme === null ? 'NULL' : sqlLiteral(entry.civic_theme);
    const civicMention = entry.civic_mention === null ? 'NULL' : sqlLiteral(entry.civic_mention);

    lines.push(
      '  INSERT INTO public.training_sessions (',
      '    plan_version_id, code, ordre, kind, module, palier, type_seance, duree_minutes,',
      '    titre, objectifs, competences, civic_theme, civic_mention, source_ids, statut',
      '  ) VALUES (',
      '    v_plan_id,',
      `    ${sqlLiteral(entry.session_code)},`,
      `    ${entry.ordre},`,
      `    ${sqlLiteral(entry.kind)},`,
      `    ${moduleVal},`,
      `    ${sqlLiteral(entry.palier)},`,
      `    ${sqlLiteral(entry.type_seance)},`,
      `    ${entry.duree_minutes},`,
      `    ${sqlLiteral(entry.titre)},`,
      `    ${sqlJson(entry.objectifs)},`,
      `    ${sqlArray(entry.competences)},`,
      `    ${civicTheme},`,
      `    ${civicMention},`,
      `    ${sqlArray(entry.source_ids)},`,
      `    ${sqlLiteral(entry.statut ?? 'planned')}`,
      '  )',
      '  ON CONFLICT (plan_version_id, code) DO UPDATE SET',
      '    ordre = EXCLUDED.ordre,',
      '    kind = EXCLUDED.kind,',
      '    module = EXCLUDED.module,',
      '    palier = EXCLUDED.palier,',
      '    type_seance = EXCLUDED.type_seance,',
      '    duree_minutes = EXCLUDED.duree_minutes,',
      '    titre = EXCLUDED.titre,',
      '    objectifs = EXCLUDED.objectifs,',
      '    competences = EXCLUDED.competences,',
      '    civic_theme = EXCLUDED.civic_theme,',
      '    civic_mention = EXCLUDED.civic_mention,',
      '    source_ids = EXCLUDED.source_ids,',
      "    statut = CASE WHEN public.training_sessions.statut IN ('published', 'publishable')",
      '      THEN public.training_sessions.statut',
      '      ELSE EXCLUDED.statut',
      '    END,',
      '    updated_at = now();',
      '',
    );
  }

  lines.push('END $$;', '', 'COMMIT;', '');
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = valueAfter(args, '--manifest', DEFAULT_MANIFEST_PATH);
  const outPath = valueAfter(args, '--out', 'supabase/migrations/20260706160000_seed_curriculum_v2_plan.sql');
  const stdoutOnly = hasFlag(args, '--stdout');

  const manifest = await loadManifest(manifestPath);
  const sql = buildMigrationSql(manifest);

  if (stdoutOnly) {
    process.stdout.write(sql);
    return;
  }

  const absolute = resolve(outPath);
  await writeFile(absolute, sql, 'utf8');
  console.log(`Wrote ${absolute} (${manifest.entries.length} sessions, version ${manifest.version})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
