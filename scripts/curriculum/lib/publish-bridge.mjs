import { readSessionJsonSibling } from './session-fs.mjs';
import {
  buildCivicExerciceDraft,
  buildVariantExerciceDraft,
  CURRICULUM_SOURCE,
  dominantFormat,
  NIVEAUX,
  UnknownQuestionTypeError,
  UnsupportedFrontendFormatError,
} from './publish-bridge-lib.mjs';

/**
 * Regroupe les variantes par famille (family_id), en distinguant :
 *  - une famille DECLAREE (family_id present) — soumise a l'atomicite complete
 *    (4 niveaux requis, family_id et competence coherents) ;
 *  - un exercice AUTONOME LEGACY — un seul niveau dans tout le fichier
 *    session, sans family_id : il ne pretend pas appartenir a une famille,
 *    donc ni la contrainte des 4 niveaux ni l'exigence de family_id ne
 *    s'appliquent ;
 *  - une TENTATIVE DE FAMILLE NON IDENTIFIEE — plusieurs niveaux sans
 *    family_id dans le meme fichier : par construction (fichier
 *    "variantes-A1-A2-B1-B2"), plusieurs entrees representent une
 *    differenciation, donc l'absence de family_id est ici un defaut de
 *    donnee, pas un exercice autonome — BLOQUANT.
 */
function groupVariantsByFamily(variants, sessionCode) {
  const declared = new Map();
  const undeclared = [];
  for (const variant of variants) {
    if (variant.family_id) {
      if (!declared.has(variant.family_id)) declared.set(variant.family_id, []);
      declared.get(variant.family_id).push(variant);
    } else {
      undeclared.push(variant);
    }
  }

  const groups = new Map();
  for (const [familyId, familyVariants] of declared) {
    groups.set(familyId, { variants: familyVariants, kind: 'declared' });
  }
  if (undeclared.length === 1) {
    const solo = undeclared[0];
    groups.set(`${sessionCode}:__standalone__:${solo.niveau ?? 'niveau-inconnu'}`, {
      variants: undeclared,
      kind: 'standalone_legacy',
    });
  } else if (undeclared.length > 1) {
    groups.set(`${sessionCode}:__unidentified_family__`, {
      variants: undeclared,
      kind: 'unidentified_family',
    });
  }
  return groups;
}

/**
 * Verifie l'identite d'une famille AVANT toute validation par variante :
 * family_id manquant sur une tentative de famille multi-niveaux, ou
 * competence manquante/incoherente entre niveaux, sont des defauts qui
 * bloquent la famille ENTIERE, independamment de la validite individuelle
 * de chaque question. Les exercices autonomes legacy (un seul niveau, pas
 * de family_id) ne sont soumis qu'a la presence d'une competence — jamais a
 * la coherence inter-niveaux, puisqu'il n'y a qu'un seul niveau.
 */
function checkFamilyIdentity(groupMeta) {
  const { variants, kind } = groupMeta;

  if (kind === 'unidentified_family') {
    return {
      ok: false,
      reason: 'DIFF_FAMILY_ID_MISSING',
      message: `${variants.length} variantes de niveaux differents partagent le meme fichier de seance sans family_id — ceci ressemble a une famille de differenciation non identifiee, pas a des exercices autonomes. Publication bloquee tant que family_id n'est pas renseigne sur chaque variante.`,
    };
  }

  const competences = new Set(
    variants.map((v) => (v.competence ? String(v.competence).toUpperCase() : null)),
  );
  if (competences.has(null)) {
    return {
      ok: false,
      reason: 'DIFF_COMPETENCE_MISSING',
      message: 'Au moins une variante de cette famille ne declare aucune competence (`variant.competence` vide).',
    };
  }
  if (kind === 'declared' && competences.size > 1) {
    return {
      ok: false,
      reason: 'DIFF_COMPETENCE_INCONSISTENT',
      message: `Les niveaux de cette famille declarent des competences differentes (${[...competences].join(', ')}) — une famille doit rester dans la meme competence de A1 a B2.`,
    };
  }

  return { ok: true };
}

/** Valide une variante SANS ecriture DB. Renvoie { ok: true } ou
 * { ok: false, reason, question_type, message }. */
function validateVariantFormat(variant) {
  try {
    dominantFormat(variant.questions);
    return { ok: true };
  } catch (formatError) {
    if (formatError instanceof UnsupportedFrontendFormatError) {
      return {
        ok: false,
        reason: 'DIFF_FRONTEND_NOT_SUPPORTED',
        question_type: formatError.questionType,
        message: formatError.message,
      };
    }
    if (formatError instanceof UnknownQuestionTypeError) {
      return {
        ok: false,
        reason: 'DIFF_TRANSFORMATION_NOT_SUPPORTED',
        question_type: formatError.questionType,
        message: formatError.message,
      };
    }
    throw formatError;
  }
}

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
 *
 * ATOMICITE DES FAMILLES : les variantes sont groupees par `family_id`. Une
 * famille (A1/A2/B1/B2) n'est publiee dans `exercices` QUE si les 4 niveaux
 * sont valides — sinon RIEN n'est ecrit pour cette famille (les variantes
 * valides restent en brouillon, non publiees), sauf si l'appelant passe
 * explicitement `allowPartialFamily: true` (derogation formateur), auquel
 * cas seules les variantes valides de la famille sont publiees et le statut
 * reste `partial_draft` (jamais annonce comme `complete`).
 *
 * IDENTITE DE FAMILLE (bloquant, JAMAIS contournable par allowPartialFamily) :
 *  - `family_id` manquant sur une tentative de famille multi-niveaux (2+
 *    variantes sans family_id dans le meme fichier) -> `blocked`.
 *  - competence manquante sur une variante, ou incoherente entre les niveaux
 *    d'une meme famille declaree -> `blocked`.
 *  - EXCEPTION legacy : un seul niveau dans tout le fichier, sans family_id,
 *    est traite comme un exercice AUTONOME (pas une famille) — ni l'exigence
 *    de family_id, ni la regle des 4 niveaux ne s'appliquent, seule la
 *    presence d'une competence reste requise.
 * Ces defauts d'identite bloquent la famille ENTIERE independamment de la
 * validite individuelle de chaque question, et ne sont jamais publiables
 * meme avec `allowPartialFamily: true` (la derogation ne couvre que des
 * niveaux individuellement invalides dans une famille par ailleurs bien
 * identifiee, jamais une famille dont on ignore l'identite).
 *
 * Absence d'un niveau requis (famille declaree incomplete, ex. B2 manquant
 * du fichier) -> `partial_draft`, publiable uniquement avec derogation.
 *
 * Le PDF/les ressources storage sont publies AVANT cet appel (voir
 * publish-batch.mjs) et ne dependent jamais du resultat du pont : une
 * famille bloquee ici ne fait jamais echouer la publication documentaire.
 */
export async function syncPublishBridge({
  storagePublisher,
  sessionCode,
  sessionId,
  baseDir,
  publishedResources = [],
  allowPartialFamily = false,
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
  const families = [];

  const familyGroups = groupVariantsByFamily(variants, sessionCode);

  for (const [familyId, groupMeta] of familyGroups) {
    const familyVariants = groupMeta.variants;

    // ── Passe 0 : identite de la famille (family_id, competence) — bloque
    // TOUTE la famille avant meme de regarder le detail des questions. ──
    const identity = checkFamilyIdentity(groupMeta);

    // ── Passe 1 : validation pure par variante, AUCUNE ecriture DB tant que
    // le statut de la famille n'est pas tranche (evite des lignes
    // exercise_variants orphelines sans exercices correspondant). ──
    const validated = familyVariants.map((variant) => ({
      variant,
      niveau: variant.niveau ?? null,
      ...validateVariantFormat(variant),
    }));

    const blockedInFamily = validated.filter((v) => !v.ok);
    const validInFamily = identity.ok ? validated.filter((v) => v.ok) : [];
    const niveauxPresents = familyVariants.map((v) => v.niveau).filter(Boolean);
    // Un exercice autonome legacy n'a qu'un seul niveau et ne pretend a
    // aucune completude A1-B2 : la contrainte des 4 niveaux ne s'applique
    // qu'aux familles DECLAREES (family_id present).
    const niveauxManquants = groupMeta.kind === 'declared'
      ? NIVEAUX.filter((n) => !niveauxPresents.includes(n))
      : [];

    let familyStatus;
    if (!identity.ok) {
      familyStatus = 'blocked';
    } else if (blockedInFamily.length === 0 && niveauxManquants.length === 0) {
      familyStatus = 'complete';
    } else if (validInFamily.length === 0) {
      familyStatus = 'blocked';
    } else {
      familyStatus = 'partial_draft';
    }

    const familyReport = {
      family_id: familyId,
      kind: groupMeta.kind,
      status: familyStatus,
      identity_error: identity.ok ? null : { reason: identity.reason, message: identity.message },
      niveaux_valides: validInFamily.map((v) => v.niveau),
      niveaux_bloques: identity.ok
        ? blockedInFamily.map((v) => ({
            niveau: v.niveau,
            reason: v.reason,
            question_type: v.question_type,
            message: v.message,
          }))
        : familyVariants.map((v) => ({
            niveau: v.niveau ?? null,
            reason: identity.reason,
            question_type: null,
            message: identity.message,
          })),
      niveaux_manquants: niveauxManquants,
      published: false,
      requires_override: false,
    };

    // ── Passe 2 : decision de publication ──
    // 'complete' : on publie tout, comme avant.
    // 'partial_draft'/'blocked' SANS derogation : on ne publie RIEN pour
    //   cette famille — les variantes valides restent en brouillon plutot
    //   que d'etre annoncees comme publiees alors qu'un niveau manque.
    // 'partial_draft' AVEC derogation explicite : on publie uniquement les
    //   variantes valides, le statut reste 'partial_draft' (jamais 'complete').
    const shouldPublish = familyStatus === 'complete'
      || (familyStatus === 'partial_draft' && allowPartialFamily === true);

    if (!shouldPublish) {
      if (familyStatus !== 'complete') familyReport.requires_override = familyStatus === 'partial_draft';
      families.push(familyReport);
      continue;
    }

    for (const entry of validInFamily) {
      const { variant, niveau } = entry;
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
      void niveau; // deja trace dans familyReport.niveaux_valides
    }

    familyReport.published = true;
    families.push(familyReport);
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

  // Retro-compatibilite : `blocked_variants` a plat, calcule depuis `families`.
  const blockedVariants = families.flatMap((f) =>
    f.niveaux_bloques.map((b) => ({ family_id: f.family_id, ...b })),
  );

  return {
    bridged: true,
    source: CURRICULUM_SOURCE,
    invariant_support_id: invariant.id,
    exercise_variant_ids: variantRows,
    exercice_ids: exerciceRows.map((r) => r.id),
    created: exerciceRows.filter((r) => r.created).length,
    updated: exerciceRows.filter((r) => !r.created).length,
    blocked_variants: blockedVariants,
    families,
    families_requiring_override: families.filter((f) => f.requires_override).map((f) => f.family_id),
  };
}
