import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from '../_shared/check-consent.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const _triggeredBy = await getUserIdFromAuth(req);
    const _secretBlock = await ensurePseudonymSecretOrLog('claude-review-exercise', corsHeaders, null);
    if (_secretBlock) return _secretBlock;
    await logAICall({ function_name: 'claude-review-exercise', triggered_by_user_id: _triggeredBy, status: 'ok', data_categories: [], pseudonymization_level: 'none' });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { exercise_id } = await req.json();

    const { data: exercice, error } = await supabase
      .from('exercices')
      .select('*')
      .eq('id', exercise_id)
      .single();

    if (error || !exercice) {
      return new Response(JSON.stringify({ error: 'Exercice introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'Clé API Anthropic manquante' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: 'Tu es expert en didactique du FLE et en préparation au TCF IRN. Analyse les exercices et retourne uniquement du JSON strict.',
        messages: [{
          role: 'user',
          content: `Analyse cet exercice FLE TCF IRN. Vérifie : niveau linguistique adapté A0/A1, cohérence consigne/réponses, qualité des distracteurs, clarté des consignes. Retourne JSON : { niveau_ok: boolean, suggestions: string[], corrections: [{item_index: number, probleme: string, correction: string}] }

Exercice : ${JSON.stringify({
  titre: exercice.titre,
  consigne: exercice.consigne,
  competence: exercice.competence,
  niveau_vise: exercice.niveau_vise,
  format: exercice.format,
  difficulte: exercice.difficulte,
  contenu: exercice.contenu,
})}`,
        }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      return new Response(JSON.stringify({ error: 'Erreur Claude API', detail: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text ?? '';

    let review: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Pas de JSON trouvé');
      review = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: 'JSON invalide retourné par Claude', raw: rawText }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(review), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
