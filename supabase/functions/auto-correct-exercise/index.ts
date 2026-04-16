import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateFeedback(scoreNormalized: number): string {
  if (scoreNormalized >= 80) return 'Excellent ! Tu maîtrises très bien ce contenu.';
  if (scoreNormalized >= 60) return 'Bien ! Quelques points à revoir, mais tu progresses.';
  return 'Continue tes efforts ! Relis les corrections et réessaie.';
}

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

    // Service-role client for trusted DB operations (bypasses RLS).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Try to authenticate the caller via the Authorization header.
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const userClient = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data, error } = await userClient.auth.getUser();
          if (error) {
            console.warn('[auto-correct-exercise] getUser error:', error.message);
          } else if (data?.user?.id) {
            userId = data.user.id;
          }
        } catch (e) {
          console.warn('[auto-correct-exercise] auth check failed:', (e as Error).message);
        }
      }
    }

    // Parse body. We deliberately IGNORE learner_id / formateur_id from the body.
    const body = await req.json().catch(() => ({}));
    const { exercise_id, assignment_id, answers } = body ?? {};

    if (!exercise_id || !Array.isArray(answers)) {
      return jsonResponse({ error: 'exercise_id et answers requis' }, 400);
    }

    // Load exercise via service role (works for anon + auth, RLS-safe correction).
    const { data: exercice, error: exerciceError } = await admin
      .from('exercices')
      .select('id, contenu, is_live_ready, play_token')
      .eq('id', exercise_id)
      .single();

    if (exerciceError || !exercice) {
      console.error('[auto-correct-exercise] exercise not found:', exerciceError?.message);
      return jsonResponse({ error: 'Exercice introuvable' }, 404);
    }

    // If anonymous, only allow exercises explicitly opened to public play.
    if (!userId && !exercice.is_live_ready) {
      return jsonResponse({ error: 'Exercice non accessible publiquement' }, 403);
    }

    // If an assignment_id is provided in auth mode, verify it belongs to this learner
    // and matches this exercise.
    if (userId && assignment_id) {
      const { data: assignment, error: assignmentError } = await admin
        .from('exercise_assignments')
        .select('id, learner_id, exercise_id')
        .eq('id', assignment_id)
        .maybeSingle();

      if (assignmentError) {
        console.error('[auto-correct-exercise] assignment lookup error:', assignmentError.message);
        return jsonResponse({ error: 'Erreur vérification assignment' }, 500);
      }
      if (!assignment) {
        return jsonResponse({ error: 'Assignment introuvable' }, 404);
      }
      if (assignment.learner_id !== userId) {
        console.warn('[auto-correct-exercise] assignment ownership mismatch', {
          userId, assignment_id,
        });
        return jsonResponse({ error: 'Accès refusé à cet assignment' }, 403);
      }
      if (assignment.exercise_id && assignment.exercise_id !== exercise_id) {
        return jsonResponse({ error: 'Assignment ne correspond pas à cet exercice' }, 400);
      }
    }

    // Score the answers.
    const items: any[] = (exercice.contenu as any)?.items ?? [];
    let correctCount = 0;
    const itemResults: Record<string, any> = {};

    for (const answer of answers) {
      const item = items[answer?.item_index];
      if (!item) continue;

      const isCorrect = String(answer.reponse) === String(item.bonne_reponse);
      if (isCorrect) correctCount++;

      itemResults[String(answer.item_index)] = {
        question: item.question,
        reponse_donnee: answer.reponse,
        bonne_reponse: item.bonne_reponse,
        correct: isCorrect,
        explication: item.explication ?? null,
      };
    }

    const scoreRaw = correctCount;
    const scoreNormalized = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0;
    const feedbackText = generateFeedback(scoreNormalized);

    const baseResult = {
      score_raw: scoreRaw,
      score_normalized: scoreNormalized,
      total_items: items.length,
      correct_count: correctCount,
      feedback_text: feedbackText,
      item_results: itemResults,
    };

    // Anonymous: never persist.
    if (!userId) {
      return jsonResponse({
        attempt_id: null,
        anonymous: true,
        mode: 'public',
        ...baseResult,
      });
    }

    // Authenticated: persist with the JWT-derived learner_id (NOT the body value).
    const { data: attempt, error: insertError } = await admin
      .from('exercise_attempts')
      .insert({
        exercise_id,
        assignment_id: assignment_id ?? null,
        learner_id: userId,
        completed_at: new Date().toISOString(),
        status: 'completed',
        score_raw: scoreRaw,
        score_normalized: scoreNormalized,
        answers,
        item_results: itemResults,
        feedback_text: feedbackText,
        source_app: 'connect',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[auto-correct-exercise] insert error:', insertError.message);
      return jsonResponse({ error: 'Erreur insertion', detail: insertError.message }, 500);
    }

    return jsonResponse({
      attempt_id: attempt.id,
      mode: 'auth',
      ...baseResult,
    });
  } catch (err: any) {
    console.error('[auto-correct-exercise] unhandled error:', err?.message ?? err);
    return jsonResponse({ error: err?.message ?? 'Erreur interne' }, 500);
  }
});
