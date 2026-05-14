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
    const { title, levels, skills, contexts } = await req.json()
    
    // Auth check
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Non autorisé')

    // 1. Appel à Claude
    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    
    const prompt = `Expert TCF IRN. Génère un test de positionnement pédagogique NON OFFICIEL pour adultes allophones en France. 
Progression A0→B1.
Contextes recommandés : ${contexts?.join(', ') || 'préfecture, CAF, mairie, OFII, médecin, logement, transport, banque, France Travail, sécurité sociale, école, impôts'}.

Tu dois générer exactement 24 items répartis comme suit :
- CE (Compréhension Écrite) : 10 QCM (3×A0/A1, 3×A1/A2, 3×A2/B1, 1×B1/B2)
- CO (Compréhension Orale) : 10 QCM (même répartition, fournis un audio_script car le son sera simulé par texte au MVP)
- EE (Expression Écrite) : 2 tâches (1×A1/A2, 1×A2/B1)
- EO (Expression Orale) : 2 tâches (1×A0/A1, 1×A1/B1)

Pour chaque item QCM, fournis 3 options (A, B, C) et la correct_answer.
Pour les items de production (EE/EO), fournis une consigne claire et un support (image ou texte).

Retourne UNIQUEMENT un JSON structuré comme ceci :
{
  "title": "${title || 'Test de positionnement TCF'}",
  "items": [
    {
      "skill": "CE",
      "level_cecrl": "A1",
      "difficulty": 1,
      "context": "mairie",
      "support_type": "affiche",
      "support": "...",
      "question": "...",
      "options": [{"id": "A", "text": "..."}, {"id": "B", "text": "..."}, {"id": "C", "text": "..."}],
      "correct_answer": "A",
      "explanation": "...",
      "score": 1,
      "audio_script": null
    }
  ]
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const claudeData = await response.json()
    const content = JSON.parse(claudeData.content[0].text)

    // 2. Insertion en BDD
    const { data: test, error: testError } = await supabaseClient
      .from('placement_tests')
      .insert({
        title: content.title,
        created_by: user.id,
        status: 'draft',
        niveaux_couverts: levels || ['A0', 'A1', 'A2', 'B1'],
        competences: skills || ['CE', 'CO', 'EE', 'EO'],
        contexte: contexts?.join(', ') || 'Général'
      })
      .select()
      .single()

    if (testError) throw testError

    const itemsToInsert = content.items.map((item: any, index: number) => ({
      ...item,
      test_id: test.id,
      order_index: index
    }))

    const { error: itemsError } = await supabaseClient
      .from('placement_test_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    return new Response(JSON.stringify({ success: true, testId: test.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
