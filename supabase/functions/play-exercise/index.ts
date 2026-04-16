import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role: the row filtering is enforced explicitly below
    // (play_token + is_live_ready). This avoids relying on the anon RLS policy
    // and makes the public play flow robust.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { play_token } = await req.json().catch(() => ({}));

    if (!play_token || typeof play_token !== 'string') {
      return new Response(JSON.stringify({ error: 'play_token requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only return non-sensitive fields. Never expose formateur_id, eleve_id,
    // play_token, statut internals, etc.
    const { data: exercice, error } = await supabase
      .from('exercices')
      .select('id, titre, consigne, competence, format, contenu, niveau_vise, difficulte, is_live_ready')
      .eq('play_token', play_token)
      .maybeSingle();

    if (!exercice || !exercice.is_live_ready) {
      return new Response(JSON.stringify({ error: 'Exercice introuvable ou non disponible' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Strip the gating field from the response.
    delete (exercice as any).is_live_ready;

    if (error || !exercice) {
      return new Response(JSON.stringify({ error: 'Exercice introuvable ou non disponible' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(exercice), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
