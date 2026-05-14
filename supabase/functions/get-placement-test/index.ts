import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Récupérer le test (soit par token, soit le dernier publié)
    let query = supabaseClient
      .from('placement_tests')
      .select('*')

    if (token) {
      query = query.eq('play_token', token)
    } else {
      query = query.eq('status', 'published').order('published_at', { ascending: false }).limit(1)
    }

    const { data: test, error: testError } = await query.single()

    if (testError || !test) {
      return new Response(JSON.stringify({ error: 'Test non trouvé ou aucun test publié.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Récupérer les items (on exclut explicitement correct_answer et explanation)
    const { data: items, error: itemsError } = await supabaseClient
      .from('placement_test_items')
      .select('id, skill, level_cecrl, difficulty, context, support_type, support, question, options, audio_script, score, order_index')
      .eq('test_id', test.id)
      .order('order_index', { ascending: true })

    if (itemsError) throw itemsError

    // 3. Update last used
    await supabaseClient
      .from('placement_test_exports')
      .update({ last_used_at: new Date().toISOString() })
      .eq('test_id', test.id)

    // 4. Construction de la réponse publique (Schéma placement_test_v1)
    const payload = {
      schema_version: "placement_test_v1",
      test: {
        id: test.id,
        title: test.title,
        target_exam: test.target_exam,
        target_public: test.target_public,
        estimated_duration_minutes: 45,
        disclaimer: "Ce test est un test pédagogique de positionnement non officiel. Il ne remplace en aucun cas un examen officiel TCF."
      },
      configuration: {
        levels_covered: test.niveaux_couverts,
        skills: test.competences,
        contexts: test.contexte
      },
      items: items,
      scoring_rules: {
        difficulty_weights: { "1": 1, "2": 2, "3": 3, "4": 4 },
        level_thresholds: [
          { level: "A0_pre_A1", min_percent: 0, max_percent: 25 },
          { level: "A1_fragile", min_percent: 26, max_percent: 45 },
          { level: "A1_acquis", min_percent: 46, max_percent: 60 },
          { level: "A2_fragile", min_percent: 61, max_percent: 72 },
          { level: "A2_acquis", min_percent: 73, max_percent: 82 },
          { level: "B1_fragile", min_percent: 83, max_percent: 90 },
          { level: "B1_acquis", min_percent: 91, max_percent: 100 }
        ]
      }
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
