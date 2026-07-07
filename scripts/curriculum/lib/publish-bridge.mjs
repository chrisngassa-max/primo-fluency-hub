import { readSessionJsonSibling } from './session-fs.mjs';
import {
  buildCivicExerciceDraft,
  buildVariantExerciceDraft,
  CURRICULUM_SOURCE,
} from './publish-bridge-lib.mjs';

async function resolveBridgeContext(client, env = process.env) {
  const formateurId = env.CURRICULUM_BRIDGE_FORMATEUR_ID;
  if (!formateurId) {
    const { data: roleRow } = await client
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    if (!roleRow?.user_id) {
      throw new Error(
        'Pont curriculum : definissez CURRICULUM_BRIDGE_FORMATEUR_ID ou un compte admin.',
      );
    }
    return { formateurId: roleRow.user_id, pointId: await resolveDefaultPointId(client) };
  }
  return { formateurId, pointId: await resolveDefaultPointId(client) };
}

async function resolveDefaultPointId(client) {
  const envPoint = process.env.CURRICULUM_BRIDGE_POINT_ID;
  if (envPoint) return envPoint;

  const { data, error } = await client.from('points_a_maitriser').select('id').limit(1).maybeSingle();
  if (error) throw new Error(`Pont curriculum : lecture points_a_maitriser : ${error.message}`);
  if (!data?.id) throw new Error('Pont curriculum : aucun point_a_maitriser en base.');
  return data.id;
}

async function upsertInvariantSupport(client, { support, sessionId, sessionCode }) {
  const row = {
    support_id: support.support_id,
    version: support.version ?? 1,
    hash: support.hash,
    session_id: sessionId,
    session_code: sessionCode,
    donnees_canoniques: support,
    source_ids: support.source_ids ?? [],
    statut: 'published',
  };

  const { data, error } = await client
    .from('invariant_supports')
    .upsert(row, { onConflict: 'support_id,version' })
    .select('id')
    .single();

  if (error) throw new Error(`Pont curriculum : upsert invariant_supports : ${error.message}`);
  return data;
}

async function upsertExerciseVariant(client, { variant, supportUuid }) {
  const row = {
    support_id: supportUuid,
    version: variant.version ?? 1,
    niveau: variant.niveau,
    consigne: variant.consigne,
    aides: variant.aides ?? [],
    questions: variant.questions ?? [],
    corrige: variant.corrige ?? {},
    invariants_hash: variant.invariants_hash,
    statut: 'published',
  };

  const { data, error } = await client
    .from('exercise_variants')
    .upsert(row, { onConflict: 'support_id,niveau,version' })
    .select('id')
    .single();

  if (error) throw new Error(`Pont curriculum : upsert exercise_variants : ${error.message}`);
  return data;
}

async function upsertExercice(client, draft, { formateurId, pointId }) {
  const { data: existing, error: readErr } = await client
    .from('exercices')
    .select('id, metadata_code')
    .eq('metadata_code', draft.metadata_code)
    .maybeSingle();

  if (readErr) throw new Error(`Pont curriculum : lecture exercice ${draft.metadata_code} : ${readErr.message}`);

  const payload = {
    ...draft,
    formateur_id: formateurId,
    point_a_maitriser_id: pointId,
  };

  if (existing?.id) {
    const { data, error } = await client
      .from('exercices')
      .update(payload)
      .eq('id', existing.id)
      .select('id, metadata_code, niveau_vise')
      .single();
    if (error) throw new Error(`Pont curriculum : update exercice : ${error.message}`);
    return { ...data, created: false };
  }

  const { data, error } = await client
    .from('exercices')
    .insert(payload)
    .select('id, metadata_code, niveau_vise')
    .single();
  if (error) throw new Error(`Pont curriculum : insert exercice : ${error.message}`);
  return { ...data, created: true };
}

/**
 * Apres publication storage : synchronise invariant_supports, exercise_variants
 * et lignes reutilisables dans exercices (source curriculum_v2).
 */
export async function syncPublishBridge({
  storagePublisher,
  sessionCode,
  sessionId,
  baseDir,
  publishedResources = [],
}) {
  const client = storagePublisher?.client;
  if (!client) {
    return { bridged: false, reason: 'no_supabase_client' };
  }

  const support = await readSessionJsonSibling(sessionCode, 'support/support-master.json', baseDir);
  const variants = await readSessionJsonSibling(
    sessionCode,
    'exercices/variantes-A1-A2-B1-B2.json',
    baseDir,
  );
  const civic = await readSessionJsonSibling(sessionCode, 'exercices/qcm-civique.json', baseDir);

  if (!support || !Array.isArray(variants) || variants.length === 0) {
    return { bridged: false, reason: 'missing_variant_or_support' };
  }

  const { formateurId, pointId } = await resolveBridgeContext(client);
  const invariant = await upsertInvariantSupport(client, { support, sessionId, sessionCode });

  const variantResourceId = publishedResources.find((r) => r.resource_id === 'variantes-a1-a2-b1-b2')
    ?.session_resource_id ?? null;
  const civicResourceId = publishedResources.find((r) => r.resource_id === 'qcm-civique-json')
    ?.session_resource_id ?? null;

  const exerciceRows = [];
  const variantRows = [];

  for (const variant of variants) {
    const dbVariant = await upsertExerciseVariant(client, {
      variant,
      supportUuid: invariant.id,
    });
    variantRows.push(dbVariant.id);

    const draft = buildVariantExerciceDraft({
      variant,
      sessionCode,
      trainingSessionId: sessionId,
      supportId: support.support_id,
      exerciseVariantId: dbVariant.id,
      sessionResourceId: variantResourceId,
    });
    exerciceRows.push(await upsertExercice(client, draft, { formateurId, pointId }));
  }

  if (civic?.questions?.length) {
    let index = 0;
    for (const question of civic.questions) {
      const draft = buildCivicExerciceDraft({
        question,
        index,
        sessionCode,
        trainingSessionId: sessionId,
        civicMeta: civic,
        sessionResourceId: civicResourceId,
      });
      exerciceRows.push(await upsertExercice(client, draft, { formateurId, pointId }));
      index += 1;
    }
  }

  if (variantResourceId) {
    await client
      .from('session_resources')
      .update({ support_id: invariant.id })
      .eq('id', variantResourceId);
  }

  return {
    bridged: true,
    source: CURRICULUM_SOURCE,
    invariant_support_id: invariant.id,
    exercise_variant_ids: variantRows,
    exercice_ids: exerciceRows.map((r) => r.id),
    created: exerciceRows.filter((r) => r.created).length,
    updated: exerciceRows.filter((r) => !r.created).length,
  };
}
