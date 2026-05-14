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
    const { token, student_name, student_id, answers, source = 'site_externe' } = await req.json()

    if (!token || !answers) throw new Error('Données manquantes')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Récupérer le test
    const { data: test, error: testError } = await supabaseClient
      .from('placement_tests')
      .select('id, title')
      .eq('play_token', token)
      .single()

    if (testError || !test) throw new Error('Test invalide')

    // 2. Récupérer les items avec les bonnes réponses
    const { data: items, error: itemsError } = await supabaseClient
      .from('placement_test_items')
      .select('*')
      .eq('test_id', test.id)

    if (itemsError) throw itemsError

    // 3. Correction automatique (CE/CO)
    let totalPoints = 0
    let maxPossiblePoints = 0
    const processedAnswers = []
    const skillScores: any = { CE: { score: 0, max: 0 }, CO: { score: 0, max: 0 }, EE: { score: 0, max: 0 }, EO: { score: 0, max: 0 } }

    for (const item of items) {
      const studentAnswer = answers.find((a: any) => a.item_id === item.id)
      const weight = item.difficulty || 1
      maxPossiblePoints += weight
      skillScores[item.skill].max += weight

      let isCorrect = null
      let score = 0

      if (['CE', 'CO'].includes(item.skill)) {
        isCorrect = studentAnswer?.answer === item.correct_answer
        score = isCorrect ? weight : 0
        totalPoints += score
        skillScores[item.skill].score += score
      } else {
        // EE/EO : pas de correction auto pour le moment
        isCorrect = null
        score = 0
      }

      processedAnswers.push({
        item_id: item.id,
        student_answer: studentAnswer?.answer || '',
        is_correct: isCorrect,
        score: score,
        time_spent: studentAnswer?.time_spent || 0
      })
    }

    // 4. Estimation du niveau CECRL
    const scorePct = (totalPoints / (maxPossiblePoints || 1)) * 100
    let estimatedLevel = "A0_pre_A1"
    if (scorePct >= 91) estimatedLevel = "B1_acquis"
    else if (scorePct >= 83) estimatedLevel = "B1_fragile"
    else if (scorePct >= 73) estimatedLevel = "A2_acquis"
    else if (scorePct >= 61) estimatedLevel = "A2_fragile"
    else if (scorePct >= 46) estimatedLevel = "A1_acquis"
    else if (scorePct >= 26) estimatedLevel = "A1_fragile"

    // 5. Recherche de remédiation (exercices de la banque globale)
    // On cherche des exercices qui correspondent au niveau estimé et à la compétence la plus faible
    const weakestSkill = Object.keys(skillScores).reduce((a, b) => 
      (skillScores[a].score / (skillScores[a].max || 1)) < (skillScores[b].score / (skillScores[b].max || 1)) ? a : b
    )

    const { data: remediation } = await supabaseClient
      .from('exercices')
      .select('id, titre, competence, niveau_vise')
      .eq('competence', weakestSkill)
      .eq('statut', 'published')
      .is('formateur_id', null)
      .limit(5)

    // 6. Analyse pédagogique par Claude
    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const analysisPrompt = `Analyse les résultats d'un élève au test "${test.title}".
Nom: ${student_name}
Niveau estimé: ${estimatedLevel}
Score global: ${scorePct.toFixed(1)}%
Scores par compétence:
- CE: ${((skillScores.CE.score / skillScores.CE.max) * 100).toFixed(0)}%
- CO: ${((skillScores.CO.score / skillScores.CO.max) * 100).toFixed(0)}%

Produis un bilan pédagogique court (3-4 phrases) avec :
1. Les points forts (basés sur les compétences réussies)
2. Les axes d'amélioration
3. Le groupe conseillé (A1, A2, B1)
4. Un conseil de parcours (ex: "Focus administratif", "Renforcement oral")

Retourne un JSON :
{
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "recommended_group": "...",
  "recommended_pathway": "...",
  "teacher_notes": "..."
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
        max_tokens: 1024,
        messages: [{ role: 'user', content: analysisPrompt }],
      }),
    })

    const claudeData = await response.json()
    const pedagogicalAnalysis = JSON.parse(claudeData.content[0].text)

    // 7. Enregistrement de la tentative
    const { data: attempt, error: attemptError } = await supabaseClient
      .from('placement_test_attempts')
      .insert({
        test_id: test.id,
        student_id: student_id || null,
        student_name: student_name,
        status: 'completed',
        total_score: totalPoints,
        max_score: maxPossiblePoints,
        estimated_level: estimatedLevel,
        source: source,
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (attemptError) throw attemptError

    // 8. Enregistrement des réponses
    await supabaseClient.from('placement_test_answers').insert(
      processedAnswers.map(a => ({ ...a, attempt_id: attempt.id }))
    )

    // 9. Enregistrement du résultat détaillé
    const resultData = {
      attempt_id: attempt.id,
      global_level: estimatedLevel,
      ce_level: estimatedLevel, // Simplifié pour le MVP
      co_level: estimatedLevel,
      global_score_pct: scorePct,
      ce_score_pct: (skillScores.CE.score / skillScores.CE.max) * 100,
      co_score_pct: (skillScores.CO.score / skillScores.CO.max) * 100,
      strengths: pedagogicalAnalysis.strengths,
      weaknesses: pedagogicalAnalysis.weaknesses,
      recommended_group: pedagogicalAnalysis.recommended_group,
      recommended_pathway: pedagogicalAnalysis.recommended_pathway,
      teacher_notes: pedagogicalAnalysis.teacher_notes,
      remediation_exercises: remediation || [],
      raw_analysis: pedagogicalAnalysis
    }

    await supabaseClient.from('placement_test_results').insert(resultData)

    return new Response(JSON.stringify({ 
      success: true, 
      attempt_id: attempt.id,
      result: resultData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
