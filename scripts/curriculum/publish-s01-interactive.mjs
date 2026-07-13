// Adaptateur du pont curriculum existant (scripts/curriculum/lib/publish-bridge.mjs)
// pour le format S01-v3 (content/curriculum/v2/S01-v3/exercices-interactifs.json),
// distinct du format "variantes-A1-A2-B1-B2.json" que syncPublishBridge lit
// nativement. Réutilise upsertExercice et resolveBridgeContext tels quels —
// n'invente PAS un second moteur d'upsert (relecture indépendante, point 5).
//
// Idempotent : upsertExercice upsert par metadata_code (déjà unique,
// cv2:S01:v3:<code>:<niveau>) ; session_document_links upsert par
// (session_code, linked_id) via la contrainte ajoutée en migration
// 20260713090000. Ré-exécuter ce script ne duplique rien.
//
// N'active JAMAIS pedagogical_status au-delà de 'draft' : cette procédure
// alimente le contenu, elle ne publie rien (voir checklist readiness).
//
// Usage : node scripts/curriculum/publish-s01-interactive.mjs [--dry-run]

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { resolveBridgeContext, upsertExercice } from './lib/publish-bridge.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_PATH = join(ROOT, 'content', 'curriculum', 'v2', 'S01-v3', 'exercices-interactifs.json');

export function buildDraft(entry) {
  return {
    metadata_code: entry.metadata_code,
    titre: entry.titre,
    consigne: entry.consigne,
    competence: entry.competence,
    format: entry.format,
    niveau_vise: entry.niveau_vise,
    difficulte: entry.difficulte,
    duree_limite_secondes: entry.duree_limite_secondes,
    source: entry.source,
    is_ai_generated: false,
    is_template: false,
    is_devoir: false,
    collectif: true,
    // Nouvelles colonnes réelles (migration 20260713090000) — jamais
    // au-delà de 'draft' depuis cette procédure d'ingestion automatisée.
    pedagogical_status: 'draft',
    civic_content: Boolean(entry.civic_content),
    civic_fact_ids: entry.civic_fact_ids ?? [],
    needs_content_review: Boolean(entry.contenu?.metadata?.needs_content_review),
    contenu: {
      items: entry.contenu.items,
      metadata: {
        ...entry.contenu.metadata,
        // family_id / extension_of_family_id n'ont PAS de colonne dédiée sur
        // `exercices` (confirmé : recherche exhaustive des migrations) — ils
        // vivent dans contenu.metadata, comme le fait déjà publish-bridge-lib.mjs
        // pour differentiation_contract.family_id.
        family_id: entry.family_id ?? null,
        extension_of_family_id: entry.extension_of_family_id ?? null,
      },
    },
  };
}

export async function publishS01Interactive({ client, dryRun = false } = {}) {
  const raw = await readFile(DATA_PATH, 'utf8');
  const payload = JSON.parse(raw);

  const report = {
    session_code: 'S01',
    dry_run: dryRun,
    exercises_seen: payload.exercises.length,
    exercises_upserted: 0,
    exercises_needing_review_skipped_links: 0,
    links_upserted: 0,
    activities_missing: [],
  };

  if (dryRun) {
    report.would_upsert = payload.exercises.map((e) => e.metadata_code);
    return report;
  }

  const { formateurId, pointId } = await resolveBridgeContext(client);

  const { data: activities, error: activitiesError } = await client
    .from('session_activities')
    .select('id, activity_code')
    .eq('session_code', 'S01');
  if (activitiesError) throw new Error(`publish-s01-interactive: lecture session_activities : ${activitiesError.message}`);
  const activityIdByCode = new Map((activities ?? []).map((a) => [a.activity_code, a.id]));

  for (const entry of payload.exercises) {
    const draft = buildDraft(entry);
    const upserted = await upsertExercice(client, draft, { formateurId, pointId });
    report.exercises_upserted += 1;

    const activityCode = entry.contenu?.metadata?.activity_code ?? null;
    const activityId = activityCode ? activityIdByCode.get(activityCode) ?? null : null;
    if (activityCode && !activityId) {
      report.activities_missing.push(activityCode);
    }

    const linkRow = {
      session_code: 'S01',
      linked_type: 'exercise',
      linked_id: upserted.id,
      audience: 'both',
      display_order: entry.contenu?.metadata?.display_order ?? 0,
      title: entry.titre,
      activity_id: activityId,
      block_code: `${activityCode ?? 'S01.NON_CLASSE'}.${entry.metadata_code}`,
      metadata: { needs_content_review: Boolean(entry.contenu?.metadata?.needs_content_review) },
    };

    const { error: linkError } = await client
      .from('session_document_links')
      .upsert(linkRow, { onConflict: 'session_code,linked_id' });
    if (linkError) throw new Error(`publish-s01-interactive: upsert session_document_links pour ${entry.metadata_code} : ${linkError.message}`);
    report.links_upserted += 1;
  }

  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run');
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error('publish-s01-interactive: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (ou --dry-run).');
    process.exit(1);
  }

  const client = dryRun ? null : createClient(supabaseUrl, serviceRoleKey);
  const report = await publishS01Interactive({ client, dryRun });
  console.log(JSON.stringify(report, null, 2));
}
