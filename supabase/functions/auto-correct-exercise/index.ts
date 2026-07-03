import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corrigerExerciceServer } from '../_shared/correction-server.ts';
import { classifyAndEmitErrors } from '../_shared/classifyAndEmitErrors.ts';
import { resolveLiveSessionId } from '../_shared/resolveLiveSessionId.ts';

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

/** Convertit answers[] (PlayExercise) en Record index → valeur. */
function answersArrayToRecord(
  answers: Array<{ item_index?: number; reponse?: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of answers) {
    if (typeof a?.item_index === 'number') {
      out[String(a.item_index)] = a.reponse ?? '';
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

    const body = await req.json().catch(() => ({}));
    const { exercise_id, assignment_id, answers, session_id: bodySessionId } = body ?? {};

    if (!exercise_id || !Array.isArray(answers)) {
      return jsonResponse({ error: 'exercise_id et answers requis' }, 400);
    }

    const { data: exercice, error: exerciceError } = await admin
      .from('exercices')
      .select('id, titre, consigne, contenu, format, competence, niveau_vise, is_live_ready, play_token')
      .eq('id', exercise_id)
      .single();

    if (exerciceError || !exercice) {
      console.error('[auto-correct-exercise] exercise not found:', exerciceError?.message);
      return jsonResponse({ error: 'Exercice introuvable' }, 404);
    }

    if (!userId && !exercice.is_live_ready) {
      return jsonResponse({ error: 'Exercice non accessible publiquement' }, 403);
    }

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

    const contenu = (exercice.contenu ?? {}) as Record<string, unknown>;
    const items = Array.isArray(contenu.items) ? contenu.items as Array<Record<string, unknown>> : [];
    const metadata = (contenu.metadata ?? {}) as { code?: string };
    const answersRecord = answersArrayToRecord(answers);

    let scoreNormalized = 0;
    let correctCount = 0;
    let itemResults: Record<string, unknown> = {};
    let aiFailed = false;

    if (userId) {
      const result = await corrigerExerciceServer({
        format: exercice.format,
        competence: exercice.competence,
        items,
        answers: answersRecord,
        metadata,
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      });
      scoreNormalized = result.score;
      correctCount = result.correctCount;
      aiFailed = result.ai_failed;
      itemResults = Object.fromEntries(
        result.correction.map((c, idx) => [
          String(idx),
          {
            question: c.question,
            reponse_donnee: c.reponse_eleve,
            bonne_reponse: c.bonne_reponse,
            correct: c.correct,
            explication: c.explication ?? null,
          },
        ]),
      );
    } else {
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
      scoreNormalized = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0;
    }

    const feedbackText = generateFeedback(scoreNormalized);

    const baseResult = {
      score_raw: correctCount,
      score_normalized: scoreNormalized,
      total_items: items.length,
      correct_count: correctCount,
      feedback_text: feedbackText,
      item_results: itemResults,
      ai_failed: aiFailed,
    };

    if (!userId) {
      return jsonResponse({
        attempt_id: null,
        anonymous: true,
        mode: 'public',
        ...baseResult,
      });
    }

    const { data: attempt, error: insertError } = await admin
      .from('exercise_attempts')
      .insert({
        exercise_id,
        assignment_id: assignment_id ?? null,
        learner_id: userId,
        completed_at: new Date().toISOString(),
        status: 'completed',
        score_raw: correctCount,
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

    const liveSessionId = await resolveLiveSessionId(admin, {
      bodySessionId: bodySessionId ?? null,
      exerciceId: exercise_id,
      eleveId: userId,
    });

    if (liveSessionId) {
      const correction = Object.values(itemResults);
      classifyAndEmitErrors({
        sessionId: liveSessionId,
        eleveId: userId,
        exerciceId: exercise_id,
        competence: exercice.competence,
        consigne: exercice.consigne ?? '',
        items,
        answers: answersRecord,
        correction,
        score: scoreNormalized,
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      }).catch((e) =>
        console.warn('[auto-correct-exercise] classifyAndEmitErrors:', (e as Error).message),
      );
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
