import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corrigerExerciceServer } from '../_shared/correction-server.ts';
import { findMissingRequiredJustifications } from '../_shared/justification-guard.ts';

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

/**
 * Soumission d'un exercice du parcours de séance intégré. Contrairement à
 * auto-correct-exercise (conservé tel quel pour ses autres appelants —
 * PlayExercise public, ExerciseStudentPreviewDialog), cette fonction :
 *  - vérifie l'enrôlement séance/groupe (pas un simple assignment_id) ;
 *  - calcule le score SERVEUR (corrigerExerciceServer, réutilisé, pas
 *    dupliqué) en rechargeant exercices.contenu ici, jamais depuis le
 *    client ;
 *  - ne renvoie JAMAIS bonne_reponse/score/item_results dans la réponse —
 *    uniquement { attempt_id, status, progress } (relecture indépendante,
 *    point 2). La correction n'est lisible que via get-attempt-correction,
 *    et seulement après libération formateur (correction_released_at).
 */
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

    const { exercise_id: exerciseId, session_code: sessionCode, answers } = await req.json().catch(() => ({}));
    if (!exerciseId || !sessionCode || typeof answers !== 'object' || answers === null) {
      return jsonResponse({ error: 'exercise_id, session_code et answers requis' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Enrôlement : l'exercice doit être réellement lié à cette séance pour
    // ce groupe (session_document_links), ET l'apprenant doit appartenir au
    // groupe de cette séance. Vérifié ici, server-side, jamais délégué à une
    // policy RLS que le client pourrait contourner en changeant sa requête.
    const { data: link, error: linkError } = await admin
      .from('session_document_links')
      .select('id, audience')
      .eq('session_code', sessionCode)
      .eq('linked_id', exerciseId)
      .in('audience', ['apprenant', 'both'])
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) {
      return jsonResponse({ error: 'Exercice non lié à cette séance' }, 404);
    }

    // Résout LA séance réelle de l'élève (pas seulement "un enrôlement
    // quelconque" pour ce session_code) — 4e relecture, points 1/2 : cette
    // session_id est ensuite posée sur la tentative, condition nécessaire à
    // l'isolation multi-groupes de release_corrections (un même exercice
    // peut être travaillé par plusieurs groupes différents sur le même
    // training_session_code S01).
    const { data: enrollment, error: enrollmentError } = await admin
      .from('training_sessions')
      .select('id, sessions:sessions(id, group_members:group_members(eleve_id))')
      .eq('code', sessionCode)
      .maybeSingle();
    if (enrollmentError) throw enrollmentError;
    const matchingSession = (enrollment as any)?.sessions?.find((s: any) =>
      (s.group_members ?? []).some((gm: any) => gm.eleve_id === learnerId),
    );
    if (!matchingSession) {
      return jsonResponse({ error: 'Non enrôlé dans cette séance' }, 403);
    }
    const sessionId: string = matchingSession.id;

    const { data: exercice, error: exerciceError } = await admin
      .from('exercices')
      .select('id, format, competence, contenu, pedagogical_status, needs_content_review')
      .eq('id', exerciseId)
      .single();
    if (exerciceError || !exercice) {
      return jsonResponse({ error: 'Exercice introuvable' }, 404);
    }
    if (!['publishable', 'published'].includes(exercice.pedagogical_status) || exercice.needs_content_review) {
      return jsonResponse({ error: 'Exercice non disponible' }, 403);
    }

    const contenu = (exercice.contenu ?? {}) as Record<string, unknown>;
    const items = Array.isArray(contenu.items) ? (contenu.items as Array<Record<string, unknown>>) : [];

    // Défense en profondeur (Lot 2, B1/B2) : items.justification_required
    // vient de exercices.contenu rechargé ici server-side (jamais du
    // client) — un client qui omettrait la justification malgré la
    // validation côté UI est rejeté ici, AVANT tout insert. La réponse
    // principale n'est jamais perdue : rien n'est inséré, le client garde
    // sa saisie et peut réessayer avec la justification complétée.
    const missingJustifications = findMissingRequiredJustifications(items, answers);
    if (missingJustifications.length > 0) {
      return jsonResponse(
        {
          error: 'Justification requise manquante pour au moins une réponse.',
          code: 'JUSTIFICATION_REQUISE',
          item_indexes: missingJustifications,
        },
        422,
      );
    }

    // Score/correction TOUJOURS recalculés ici à partir de items+answers :
    // aucun champ score/score_normalized/item_results envoyé par le client
    // n'est jamais lu (req.json() n'a destructuré que exercise_id,
    // session_code, answers — voir plus haut) ni utilisé plus bas.
    const result = await corrigerExerciceServer({
      format: exercice.format,
      competence: exercice.competence,
      items,
      answers,
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
    });

    // Stockage COMPLET (Lot 2.1, points 5/6) : le modèle de résultat riche
    // (justification_status/score/feedback/overall_status/score_provisional
    // + preuve_support/explication_distracteurs/erreur_diagnostiquee/
    // remediation/justification_ouverte) est conservé ici pour la revue
    // formateur et la restitution différée. Il n'est JAMAIS renvoyé par
    // cette fonction (réponse volontairement minimale, voir plus bas) : seul
    // get-attempt-correction le lit, et seulement après libération, à
    // travers sa propre liste blanche dédiée (released-correction-filter.ts).
    const itemResults = Object.fromEntries(
      result.correction.map((c, idx) => [
        String(idx),
        {
          question: c.question,
          reponse_donnee: c.reponse_eleve,
          bonne_reponse: c.bonne_reponse,
          correct: c.correct,
          explication: c.explication ?? null,
          learner_justification: c.learner_justification ?? null,
          hint_used: c.hint_used ?? false,
          answer_correct: c.answer_correct,
          justification_status: c.justification_status,
          justification_score: c.justification_score,
          justification_feedback: c.justification_feedback,
          overall_status: c.overall_status,
          score_provisional: c.score_provisional,
          preuve_support: c.preuve_support ?? null,
          explication_distracteurs: c.explication_distracteurs ?? [],
          erreur_diagnostiquee: c.erreur_diagnostiquee ?? null,
          remediation: c.remediation ?? null,
          justification_ouverte: c.justification_ouverte ?? null,
        },
      ]),
    );

    const { data: attempt, error: insertError } = await admin
      .from('exercise_attempts')
      .insert({
        exercise_id: exerciseId,
        learner_id: learnerId,
        session_id: sessionId,
        status: 'completed',
        completed_at: new Date().toISOString(),
        score_raw: result.correctCount,
        score_normalized: result.score,
        answers,
        item_results: itemResults,
        source_app: 'seance_apprenant',
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    // Réponse volontairement minimale : ni score, ni correction, ni
    // bonne_reponse. Le formateur doit explicitement libérer (release_corrections)
    // avant que get-attempt-correction ne renvoie quoi que ce soit.
    return jsonResponse({
      attempt_id: attempt.id,
      status: 'completed',
      progress: { total_items: items.length, answered: Object.keys(answers).length },
    });
  } catch (err: any) {
    console.error('[submit-seance-answer] unhandled error:', err?.message ?? err);
    return jsonResponse({ error: err?.message ?? 'Erreur interne' }, 500);
  }
});
