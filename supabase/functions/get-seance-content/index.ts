import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sanitizeExercice } from '../_shared/session-content-sanitizer.ts';
import { findEnrolledSessionForCode } from '../_shared/session-enrollment.ts';
import { isActivityVisible, isExerciseLinkVisible, resolveLearnerLevelForCompetence } from '../_shared/session-visibility.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Authentification requise' }, 401);
    }
    const token = authHeader.slice(7).trim();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: 'Session invalide' }, 401);
    }
    const learnerId = userData.user.id;

    const { session_code: sessionCode } = await req.json().catch(() => ({}));
    if (!sessionCode || typeof sessionCode !== 'string') {
      return jsonResponse({ error: 'session_code requis' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Vérification d'enrôlement — même chemin que le reste de la
    // plateforme (training_sessions -> sessions -> group_members),
    // effectuée ici server-side (service role), jamais confiée à une
    // policy RLS activable par le client lui-même. On récupère aussi
    // groups.niveau (fallback) et sessions.id : cette dernière ancre
    // désormais chaque tentative/libération à LA séance précise (4e
    // relecture, point 1 — isolation multi-groupes).
    let enrolled;
    try {
      enrolled = await findEnrolledSessionForCode(admin, sessionCode, learnerId);
    } catch (enrollmentError) {
      console.error('[get-seance-content] enrollment lookup error:', enrollmentError instanceof Error ? enrollmentError.message : enrollmentError);
      return jsonResponse({ error: 'Erreur de vérification' }, 500);
    }
    if (!enrolled) {
      return jsonResponse({ error: 'Non enrôlé dans cette séance' }, 403);
    }
    const sessionId: string = enrolled.sessionId;
    const groupNiveau: string | null = enrolled.groupNiveau;

    // Niveau INDIVIDUEL de l'apprenant, prioritaire sur le niveau de groupe
    // (4e relecture, point 8) : profils_eleves porte un niveau par
    // compétence (niveau_ce/co/ee/eo) en plus du niveau_actuel global.
    const { data: profile } = await admin
      .from('profils_eleves')
      .select('niveau_actuel, niveau_ce, niveau_co, niveau_ee, niveau_eo')
      .eq('eleve_id', learnerId)
      .maybeSingle();

    // Point 4 (3e relecture) : le filtre publishable/published est appliqué
    // directement dans la requête (pas seulement en mémoire après coup).
    const { data: activities, error: activitiesError } = await admin
      .from('session_activities')
      .select('id, activity_code, title, objective, display_order, pedagogical_status')
      .eq('session_code', sessionCode)
      .in('pedagogical_status', ['publishable', 'published'])
      .order('display_order', { ascending: true });
    if (activitiesError) throw activitiesError;

    // Jamais file_url / source_file_path / storage_path / content_json dans
    // cette sélection : liste de colonnes en dur, jamais construite depuis
    // l'input du client. content_json est ENTIÈREMENT EXCLU pour ce pilote
    // (4e relecture, point 10) plutôt que nettoyé par liste noire — la
    // colonne n'est de toute façon peuplée nulle part aujourd'hui
    // (vérifié), et une exclusion complète est structurellement plus sûre
    // qu'un filtrage best-effort sur une forme de données non figée.
    const { data: documents, error: documentsError } = await admin
      .from('session_documents')
      .select('id, document_type, title, content_html, display_order, activity_id, pedagogical_status, audience')
      .eq('session_code', sessionCode)
      .in('audience', ['apprenant', 'both'])
      .in('pedagogical_status', ['publishable', 'published']);
    if (documentsError) throw documentsError;

    // Point 3 : un lien est visible s'il est COMMUN (eleve_id NULL) ou
    // assigné INDIVIDUELLEMENT à cet apprenant (bonus/remédiation, toujours
    // visible quel que soit son niveau — c'est un choix délibéré du
    // formateur). `.or()` exprime "eleve_id.is.null,eleve_id.eq.<learnerId>".
    const { data: links, error: linksError } = await admin
      .from('session_document_links')
      .select('id, linked_id, display_order, activity_id, title, eleve_id, is_bonus')
      .eq('session_code', sessionCode)
      .in('audience', ['apprenant', 'both'])
      .or(`eleve_id.is.null,eleve_id.eq.${learnerId}`);
    if (linksError) throw linksError;

    const linkedIds = (links ?? []).map((l) => l.linked_id);
    let exercisesById = new Map<string, Record<string, unknown>>();
    if (linkedIds.length > 0) {
      const { data: exercises, error: exercisesError } = await admin
        .from('exercices')
        .select('id, titre, consigne, competence, format, niveau_vise, contenu, civic_content, pedagogical_status, needs_content_review')
        .in('id', linkedIds)
        .in('pedagogical_status', ['publishable', 'published'])
        .eq('needs_content_review', false);
      if (exercisesError) throw exercisesError;
      exercisesById = new Map((exercises ?? []).map((e) => [e.id, e]));
    }

    // Tentatives DE CET APPRENANT, DANS CETTE SÉANCE PRÉCISE UNIQUEMENT
    // (session_id = sessionId) — la même exigence d'isolation multi-groupes
    // que release_corrections (point 1/3) : ne jamais résoudre "la dernière
    // tentative sur cet exercice_id" tous groupes/séances confondus.
    const attemptByExercise = new Map<string, Record<string, unknown>>();
    if (linkedIds.length > 0) {
      const { data: attempts, error: attemptsError } = await admin
        .from('exercise_attempts')
        .select('id, exercise_id, status, correction_released_at')
        .eq('learner_id', learnerId)
        .eq('session_id', sessionId)
        .in('exercise_id', linkedIds)
        .order('created_at', { ascending: false });
      if (attemptsError) throw attemptsError;
      // La plus récente par exercice (le tri DESC + première rencontre suffit).
      for (const a of attempts ?? []) {
        if (!attemptByExercise.has(a.exercise_id)) attemptByExercise.set(a.exercise_id, a);
      }
    }

    const supportBlocks = (documents ?? []).map((d) => ({
      kind: 'support',
      id: d.id,
      activity_id: d.activity_id,
      display_order: d.display_order,
      title: d.title,
      content_html: d.content_html,
    }));

    const exerciseBlocks = (links ?? [])
      .map((link) => {
        const exercice = exercisesById.get(link.linked_id);
        if (!exercice) return null;
        const learnerNiveau = resolveLearnerLevelForCompetence(profile ?? null, groupNiveau, exercice.competence as string);
        // Point 3 : fonction pure partagée et testée (session-visibility.ts)
        // — un A1 ne doit jamais recevoir automatiquement les variantes
        // B1/B2 de la même famille ; un lien individuel reste visible.
        if (!isExerciseLinkVisible(link, exercice as any, learnerId, learnerNiveau)) {
          return null;
        }
        const attempt = attemptByExercise.get(link.linked_id);
        return {
          kind: 'exercise' as const,
          id: link.id,
          activity_id: link.activity_id,
          display_order: link.display_order,
          is_bonus: Boolean(link.is_bonus),
          ...sanitizeExercice(exercice as any),
          my_attempt: attempt
            ? { attempt_id: attempt.id, status: attempt.status, correction_released: Boolean(attempt.correction_released_at) }
            : null,
        };
      })
      .filter((b) => b !== null);

    const blocks = [...supportBlocks, ...exerciseBlocks].sort((a: any, b: any) => a.display_order - b.display_order);

    return jsonResponse({
      session_code: sessionCode,
      session_id: sessionId,
      // Défense en profondeur : filtre déjà appliqué en SQL (point 4),
      // revérifié ici via la fonction pure partagée et testée.
      activities: (activities ?? []).filter(isActivityVisible),
      blocks,
    });
  } catch (err: any) {
    console.error('[get-seance-content] unhandled error:', err?.message ?? err);
    return jsonResponse({ error: err?.message ?? 'Erreur interne' }, 500);
  }
});
