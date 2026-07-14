import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { filterReleasedItemResults } from '../_shared/released-correction-filter.ts';

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
 * Seule voie de lecture de la correction d'une tentative. Ne renvoie
 * jamais item_results/score_normalized si correction_released_at est nul —
 * l'apprenant obtient alors seulement { released: false, status }.
 *
 * 4e relecture indépendante (point 5) : reçoit désormais attempt_id (pas
 * exercise_id) et vérifie que CETTE tentative précise appartient à
 * auth.uid(), au lieu de chercher "la dernière tentative" pour (exercise_id,
 * learner_id) — une recherche par "dernière tentative" pouvait renvoyer la
 * tentative d'une AUTRE séance/groupe sur le même exercice partagé, ou une
 * tentative différente de celle que l'apprenant vient de soumettre.
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

    const { attempt_id: attemptId } = await req.json().catch(() => ({}));
    if (!attemptId) {
      return jsonResponse({ error: 'attempt_id requis' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: attempt, error } = await admin
      .from('exercise_attempts')
      .select('id, status, correction_released_at, correction_viewed_at, score_normalized, item_results, learner_id')
      .eq('id', attemptId)
      .maybeSingle();
    if (error) throw error;

    if (!attempt) {
      return jsonResponse({ status: 'not_started', released: false });
    }

    // Vérification d'appartenance : cette tentative précise doit être celle
    // de l'appelant, jamais celle d'un autre apprenant (même exercice,
    // même séance ou non).
    if (attempt.learner_id !== learnerId) {
      return jsonResponse({ error: 'Cette tentative ne vous appartient pas' }, 403);
    }

    if (!attempt.correction_released_at) {
      return jsonResponse({ attempt_id: attempt.id, status: attempt.status, released: false });
    }

    // Lot 2.1, point 6 : liste blanche dédiée (released-correction-filter.ts)
    // appliquée ICI, au point de sortie, plutôt que de faire confiance
    // aveuglément à ce qui a été stocké par submit-seance-answer — défense
    // en profondeur.
    return jsonResponse({
      attempt_id: attempt.id,
      status: attempt.status,
      released: true,
      score_normalized: attempt.score_normalized,
      item_results: filterReleasedItemResults(attempt.item_results),
      correction_viewed_at: attempt.correction_viewed_at,
    });
  } catch (err: any) {
    console.error('[get-attempt-correction] unhandled error:', err?.message ?? err);
    return jsonResponse({ error: err?.message ?? 'Erreur interne' }, 500);
  }
});
