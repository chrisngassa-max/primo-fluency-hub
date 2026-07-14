// Pont de publication S01-v3. L'ingestion conserve tous les contenus comme
// brouillons révisables, mais seuls les exercices validés sont reliés à la
// séance apprenant. Une réingestion retire aussi un ancien lien devenu bloqué.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { resolveBridgeContext, upsertExercice } from './lib/publish-bridge.mjs';
import {
  publicationDecision,
  validateS01DifferentiationPayload,
} from './lib/s01-differentiation-validate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_PATH = join(ROOT, 'content', 'curriculum', 'v2', 'S01-v3', 'exercices-interactifs.json');
const BASELINE_PATH = join(ROOT, 'content', 'curriculum', 'v2', 'S01-v3', '__snapshots__', 's01-v3-corpus-baseline.json');

export function buildDraft(entry, validationResult = null) {
  const decision = validationResult
    ? publicationDecision(validationResult, entry.metadata_code)
    : { publishable: !entry.contenu?.metadata?.needs_content_review, blocking_errors: [] };
  const needsContentReview = Boolean(entry.contenu?.metadata?.needs_content_review || !decision.publishable);

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
    statut: 'draft',
    is_live_ready: false,
    pedagogical_status: 'draft',
    civic_content: Boolean(entry.civic_content),
    civic_fact_ids: entry.civic_fact_ids ?? [],
    needs_content_review: needsContentReview,
    contenu: {
      items: entry.contenu.items,
      metadata: {
        ...entry.contenu.metadata,
        family_id: entry.family_id ?? null,
        extension_of_family_id: entry.extension_of_family_id ?? null,
        publishable: decision.publishable,
        validation_report: {
          publishable: decision.publishable,
          blocking_errors: decision.blocking_errors,
        },
      },
    },
  };
}

export function buildPublicationPlan(payload, baseline) {
  const differentiationValidation = validateS01DifferentiationPayload(payload, { baseline });
  const entries = payload.exercises.map((entry) => ({
    entry,
    decision: publicationDecision(differentiationValidation, entry.metadata_code),
  }));

  return {
    aborted: differentiationValidation.global_blocking_errors.length > 0,
    differentiation_validation: differentiationValidation,
    drafts: entries,
    linkable: entries.filter(({ decision }) => decision.publishable),
    blocked_variants: entries
      .filter(({ decision }) => !decision.publishable)
      .map(({ entry, decision }) => ({
        metadata_code: entry.metadata_code,
        blocking_errors: decision.blocking_errors,
      })),
  };
}

async function findCommonLink(client, linkedId, metadataCode) {
  const { data, error } = await client
    .from('session_document_links')
    .select('id')
    .eq('session_code', 'S01')
    .eq('linked_id', linkedId)
    .is('eleve_id', null)
    .maybeSingle();
  if (error) throw new Error(`publish-s01-interactive: lecture session_document_links pour ${metadataCode} : ${error.message}`);
  return data;
}

export async function publishS01Interactive({
  client,
  dryRun = false,
  payload: suppliedPayload = null,
  baseline: suppliedBaseline = undefined,
} = {}) {
  let payload = suppliedPayload;
  let baseline = suppliedBaseline;
  if (!payload || baseline === undefined) {
    const [raw, baselineRaw] = await Promise.all([
      readFile(DATA_PATH, 'utf8'),
      readFile(BASELINE_PATH, 'utf8'),
    ]);
    payload ??= JSON.parse(raw);
    if (baseline === undefined) baseline = JSON.parse(baselineRaw);
  }
  const plan = buildPublicationPlan(payload, baseline);

  const report = {
    session_code: 'S01',
    dry_run: dryRun,
    aborted: plan.aborted,
    exercises_seen: payload.exercises.length,
    exercises_upserted: 0,
    exercises_needing_review_skipped_links: 0,
    links_upserted: 0,
    links_removed_for_blocked: 0,
    activities_missing: [],
    blocked_variants: plan.blocked_variants,
    differentiation_validation: plan.differentiation_validation,
  };

  if (dryRun) {
    report.would_upsert_drafts = plan.drafts.map(({ entry }) => entry.metadata_code);
    report.would_link = plan.linkable.map(({ entry }) => entry.metadata_code);
    return report;
  }

  if (plan.aborted) {
    throw new Error(`publish-s01-interactive: validation structurelle bloquante : ${JSON.stringify(plan.differentiation_validation.global_blocking_errors)}`);
  }

  const { formateurId, pointId } = await resolveBridgeContext(client);
  const { data: activities, error: activitiesError } = await client
    .from('session_activities')
    .select('id, activity_code')
    .eq('session_code', 'S01');
  if (activitiesError) throw new Error(`publish-s01-interactive: lecture session_activities : ${activitiesError.message}`);
  const activityIdByCode = new Map((activities ?? []).map((activity) => [activity.activity_code, activity.id]));

  for (const { entry, decision } of plan.drafts) {
    const draft = buildDraft(entry, plan.differentiation_validation);
    const upserted = await upsertExercice(client, draft, { formateurId, pointId });
    report.exercises_upserted += 1;

    const existingLink = await findCommonLink(client, upserted.id, entry.metadata_code);
    if (!decision.publishable) {
      report.exercises_needing_review_skipped_links += 1;
      if (existingLink) {
        const { error } = await client.from('session_document_links').delete().eq('id', existingLink.id);
        if (error) throw new Error(`publish-s01-interactive: retrait du lien bloqué ${entry.metadata_code} : ${error.message}`);
        report.links_removed_for_blocked += 1;
      }
      continue;
    }

    const activityCode = entry.contenu?.metadata?.activity_code ?? null;
    const activityId = activityCode ? activityIdByCode.get(activityCode) ?? null : null;
    if (activityCode && !activityId) report.activities_missing.push(activityCode);

    const linkRow = {
      session_code: 'S01',
      linked_type: 'exercise',
      linked_id: upserted.id,
      audience: 'both',
      display_order: entry.contenu?.metadata?.display_order ?? 0,
      title: entry.titre,
      activity_id: activityId,
      block_code: `${activityCode ?? 'S01.NON_CLASSE'}.${entry.metadata_code}`,
      metadata: {
        needs_content_review: false,
        validation_report: draft.contenu.metadata.validation_report,
      },
      eleve_id: null,
    };

    const linkError = existingLink
      ? (await client.from('session_document_links').update(linkRow).eq('id', existingLink.id)).error
      : (await client.from('session_document_links').insert(linkRow)).error;
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