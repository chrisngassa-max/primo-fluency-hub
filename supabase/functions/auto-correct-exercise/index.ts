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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { exercise_id, learner_id, assignment_id, answers } = await req.json();

    const { data: exercice, error } = await supabase
      .from('exercices')
      .select('contenu')
      .eq('id', exercise_id)
      .single();

    if (error || !exercice) {
      return new Response(JSON.stringify({ error: 'Exercice introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const items: any[] = (exercice.contenu as any)?.items ?? [];

    let correctCount = 0;
    const itemResults: Record<string, any> = {};

    for (const answer of answers) {
      const item = items[answer.item_index];
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

    const { data: attempt, error: insertError } = await supabase
      .from('exercise_attempts')
      .insert({
        exercise_id,
        assignment_id: assignment_id ?? null,
        learner_id,
        completed_at: new Date().toISOString(),
        status: 'completed',
        score_raw: scoreRaw,
        score_normalized: scoreNormalized,
        answers: answers,
        item_results: itemResults,
        feedback_text: feedbackText,
        source_app: 'connect',
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Erreur insertion', detail: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      attempt_id: attempt.id,
      score_raw: scoreRaw,
      score_normalized: scoreNormalized,
      total_items: items.length,
      correct_count: correctCount,
      feedback_text: feedbackText,
      item_results: itemResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
