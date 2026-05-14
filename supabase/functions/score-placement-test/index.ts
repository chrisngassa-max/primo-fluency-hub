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

    // 3. Correction automatique et préparation des données
    const skillScores: any = { CE: { score: 0, count: 0 }, CO: { score: 0, count: 0 } }
    const levelStats: any = {
      A1: { correct: 0, total: 0, time: 0 },
      A2: { correct: 0, total: 0, time: 0 },
      B1: { correct: 0, total: 0, time: 0 },
      B2: { correct: 0, total: 0, time: 0 }
    }
    
    const processedAnswers = []
    const timestamps = [] // Pour la détection de fatigue

    for (const item of items) {
      const studentAnswer = answers.find((a: any) => a.item_id === item.id)
      const timeSpent = studentAnswer?.time_spent || 0
      
      let isCorrect = null
      let score = 0

      if (['CE', 'CO'].includes(item.skill)) {
        isCorrect = studentAnswer?.answer === item.correct_answer
        score = isCorrect ? 1 : 0
        
        const lvl = item.level_cecrl as keyof typeof levelStats
        if (levelStats[lvl]) {
          levelStats[lvl].correct += score
          levelStats[lvl].total += 1
          levelStats[lvl].time += timeSpent
        }
        
        skillScores[item.skill].score += score
        skillScores[item.skill].count += 1
        
        timestamps.push({ temps: timeSpent, correct: isCorrect })
      }

      processedAnswers.push({
        item_id: item.id,
        student_answer: studentAnswer?.answer || '',
        is_correct: isCorrect,
        score: score,
        time_spent: timeSpent
      })
    }

    // --- ALGORITHME DE SCORING HARDENED (Portage Python) ---
    const levels = ["A1", "A2", "B1", "B2"] as const
    const poids = { A1: 5, A2: 10, B1: 15, B2: 20 }
    const medianes = { A1: 25, A2: 45, B1: 75, B2: 120 }
    
    const fiabilite: Record<string, number> = { A1: 1.0, A2: 1.0, B1: 1.0, B2: 1.0 }
    const flags = new Set<string>()

    // 1. CALCUL DES TAUX BRUTS PAR NIVEAU
    const taux: Record<string, number> = {}
    levels.forEach(niv => {
      taux[niv] = levelStats[niv].total > 0 ? levelStats[niv].correct / levelStats[niv].total : 0
    })

    // 2. FIABILITÉ DE BASE (BORNAGE SOUPLE)
    for (let i = 1; i < levels.length; i++) {
      const n = levels[i], prev = levels[i-1]
      if (taux[prev] >= 0.75) fiabilite[n] = 1.0
      else if (taux[prev] >= 0.58) fiabilite[n] = 0.7
      else if (taux[prev] >= 0.42) {
        fiabilite[n] = 0.3
        flags.add(`FIABILITE_FAIBLE_${n}`)
      } else {
        fiabilite[n] = 0.0
      }
    }

    // 3. REMONTÉE PAR PREUVE (RÈGLE DES 50% SOCLE)
    for (let i = 1; i < levels.length; i++) {
      const n = levels[i], prev = levels[i-1]
      if (taux[n] >= 0.75 && taux[prev] >= 0.50) {
        fiabilite[n] = Math.max(fiabilite[n], 1.0)
        fiabilite[prev] = Math.max(fiabilite[prev], 0.85)
        flags.add(`SOCLE_${prev}_VALIDE_PAR_PREUVE_${n}`)
      }
    }

    // 4. PÉNALITÉ TEMPORELLE (NON-CASCADE)
    levels.forEach(niv => {
      const tempsMoyen = levelStats[niv].total > 0 ? levelStats[niv].time / levelStats[niv].total : 0
      if (tempsMoyen > (medianes[niv] * 2)) {
        const nextIdx = levels.indexOf(niv) + 1
        if (nextIdx < levels.length) {
          fiabilite[levels[nextIdx]] *= 0.7
          flags.add(`LENTEUR_DETECTEE_EN_${niv}`)
        }
      }
    })

    // 5. INCOHÉRENCE VERTICALE
    for (let i = 1; i < levels.length; i++) {
      const n = levels[i], prev = levels[i-1]
      if (fiabilite[prev] === 0.0 && taux[n] > 0.50) {
        flags.add("PROFIL_INCOHERENT")
      }
    }

    // 6. FLAGS COMPORTEMENTAUX ET ASYMÉTRIE
    // Alerte Vitesse
    if ((levelStats.B1.time / (levelStats.B1.total || 1)) < medianes.B1/3 || 
        (levelStats.B2.time / (levelStats.B2.total || 1)) < medianes.B2/3) {
      if ((taux.B1 + taux.B2) > 0.80) {
        flags.add("ALERTE_VITESSE_INCOHERENTE")
      }
    }

    // Détection de Fatigue
    if (timestamps.length >= 9) {
      const n = timestamps.length
      const p_tier = timestamps.slice(0, Math.floor(n/3))
      const d_tier = timestamps.slice(-Math.floor(n/3))
      
      const t_p = p_tier.reduce((acc, i) => acc + i.temps, 0) / p_tier.length
      const t_d = d_tier.reduce((acc, i) => acc + i.temps, 0) / d_tier.length
      const r_p = p_tier.filter(i => i.correct).length / p_tier.length
      const r_d = d_tier.filter(i => i.correct).length / d_tier.length
      
      if (t_p > 0 && (t_p - t_d) / t_p > 0.60 && (r_p - r_d) > 0.40) {
        flags.add("FATIGUE_DETECTEE")
      }
    }

    // Asymétrie Horizontale
    const pctCO = skillScores.CO.score / (skillScores.CO.count || 1)
    const pctCE = skillScores.CE.score / (skillScores.CE.count || 1)
    if (Math.abs(pctCO - pctCE) > 0.25) {
      flags.add("PROFIL_ASYMETRIQUE")
    }

    // 7. CALCUL SCORE ET CLASSIFICATION
    const scoreFinal = levels.reduce((acc, niv) => {
      return acc + (levelStats[niv].correct * poids[niv]) * fiabilite[niv]
    }, 0)

    let niveauEstime = "A0"
    for (const niv of levels) {
      if (fiabilite[niv] > 0.5) niveauEstime = niv
    }

    // --- FIN ALGORITHME ---

    // 8. Recherche de remédiation
    const weakestSkill = (pctCO < pctCE) ? 'CO' : 'CE'

    const { data: remediation } = await supabaseClient
      .from('exercices')
      .select('id, titre, competence, niveau_vise')
      .eq('competence', weakestSkill)
      .eq('statut', 'published')
      .is('formateur_id', null)
      .limit(5)

    // 9. Analyse pédagogique par Claude
    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')
    const analysisPrompt = `Analyse les résultats d'un élève au test "${test.title}".
Nom: ${student_name}
Niveau estimé: ${niveauEstime}
Score pondéré: ${scoreFinal.toFixed(0)}
Flags de diagnostic: ${Array.from(flags).join(', ')}
Scores par compétence:
- CE: ${(pctCE * 100).toFixed(0)}%
- CO: ${(pctCO * 100).toFixed(0)}%

Produis un bilan pédagogique court (3-4 phrases) avec :
1. Les points forts (basés sur les compétences réussies)
2. Les axes d'amélioration
3. Le groupe conseillé (A1, A2, B1)
4. Un conseil de parcours (ex: "Focus administratif", "Renforcement oral")

IMPORTANT: Si le flag ALERTE_VITESSE_INCOHERENTE ou PROFIL_INCOHERENT est présent, mentionne qu'un entretien humain est nécessaire pour valider le niveau.

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

    // 10. Enregistrement de la tentative
    const { data: attempt, error: attemptError } = await supabaseClient
      .from('placement_test_attempts')
      .insert({
        test_id: test.id,
        student_id: student_id || null,
        student_name: student_name,
        status: 'completed',
        total_score: scoreFinal,
        max_score: 100,
        estimated_level: niveauEstime,
        source: source,
        completed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (attemptError) throw attemptError

    // 11. Enregistrement des réponses
    await supabaseClient.from('placement_test_answers').insert(
      processedAnswers.map(a => ({ ...a, attempt_id: attempt.id }))
    )

    // 12. Enregistrement du résultat détaillé
    const resultData = {
      attempt_id: attempt.id,
      global_level: niveauEstime,
      ce_level: niveauEstime, 
      co_level: niveauEstime,
      global_score_pct: (scoreFinal / 500) * 100, 
      ce_score_pct: pctCE * 100,
      co_score_pct: pctCO * 100,
      strengths: pedagogicalAnalysis.strengths,
      weaknesses: pedagogicalAnalysis.weaknesses,
      recommended_group: pedagogicalAnalysis.recommended_group,
      recommended_pathway: pedagogicalAnalysis.recommended_pathway,
      teacher_notes: pedagogicalAnalysis.teacher_notes,
      remediation_exercises: remediation || [],
      raw_analysis: pedagogicalAnalysis,
      flags: Array.from(flags)
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
