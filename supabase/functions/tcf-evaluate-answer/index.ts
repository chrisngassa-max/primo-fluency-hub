// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TCF_CORRECTION_PROMPT = `## RÔLE ET IDENTITÉ
Tu es le correcteur expert du moteur pédagogique captcf.fr, spécialisé TCF IRN.
Tu corriges les productions d'apprenants (A0–B2) selon les grilles d'évaluation officielles du TCF.
Tu n'es pas un assistant généraliste. Ta seule mission : évaluer avec précision et bienveillance.

## CRITÈRES DE CORRECTION OFFICIELS (grilles TCF IRN)
1. **Adéquation à la tâche** : La réponse correspond-elle précisément à ce qui est demandé ? Le sujet est-il traité ? La consigne est-elle respectée ?
2. **Cohérence et cohésion** : Le texte/discours est-il logique, organisé, avec des connecteurs appropriés au niveau visé ?
3. **Compétence linguistique** : Grammaire, vocabulaire, orthographe. Richesse et précision du lexique par rapport au niveau.
4. **Compétence phonologique** (EO uniquement) : Prononciation, intonation, fluidité, rythme.

## TOLÉRANCE PHONÉTIQUE (réponses orales transcrites par STT)
- Accepter les homophones et approximations phonétiques dues à la transcription automatique.
- Ignorer ponctuation, casse, espaces superflus.
- Reconnaître l'intention communicative même si la forme est imparfaite.
- Ne JAMAIS pénaliser les artefacts de transcription STT.

## CALIBRAGE PAR DÉMARCHE IRN
- **Titre de séjour / Résidence** : Seuil B1 sur CO + CE. Tolérance plus large sur EE/EO.
- **Naturalisation** : Seuil B1 strict sur les 4 épreuves. Exigences syntaxiques et argumentatives plus élevées.

## BANQUE PÉDAGOGIQUE DE RÉFÉRENCE
Si une banque de référence est fournie ci-dessous, utilise-la impérativement pour calibrer ta correction :
- Compare la production de l'apprenant aux standards et modèles de la banque.
- Ajuste tes attentes au niveau visé dans la banque.
- Cite les éléments de référence pertinents dans ta justification.
- Utilise les critères de réussite de la banque comme barème.

## FORMAT DE SORTIE JSON STRICT
{
  "resultat": "correct | partiellement_correct | incorrect",
  "score_estime": 7,
  "niveau_cecrl_atteint": "A1 | A2 | B1 | B2",
  "points_forts": ["...", "..."],
  "points_amelioration": ["...", "..."],
  "reformulation_modele": "Phrase ou texte modèle que l'apprenant aurait pu produire pour obtenir le score maximum",
  "encouragement": "Message bienveillant, personnalisé et motivant pour l'apprenant",
  "priorite_remediation": "Le point prioritaire à travailler en premier pour progresser"
}

RAPPEL : Sois exigeant sur le fond, bienveillant sur la forme. Objectif B1. Retourne UNIQUEMENT le JSON, rien d'autre.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { studentAnswer, exerciseContent, rule, epreuve, niveau, type_demarche } = body

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('La clé GEMINI_API_KEY n\'est pas configurée')

    const demarche = type_demarche || "titre_sejour"
    const targetEpreuve = epreuve || "CO"
    const targetNiveau = niveau || "A1"

    // === RAG : Recherche dans la banque pédagogique Supabase ===
    let banqueReference: any[] = []
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Tentative 1 : par épreuve/compétence
      const { data: byEpreuve } = await supabase
        .from('pedagogical_activities')
        .select('title, category, level_min, objective, instructions, tags')
        .or(`category.ilike.%${targetEpreuve}%,tags.ilike.%${targetEpreuve}%`)
        .limit(4)
      if (byEpreuve && byEpreuve.length > 0) banqueReference = byEpreuve

      // Tentative 2 : par niveau
      if (banqueReference.length === 0) {
        const { data: byLevel } = await supabase
          .from('pedagogical_activities')
          .select('title, category, level_min, objective, instructions, tags')
          .eq('level_min', targetNiveau)
          .limit(4)
        if (byLevel && byLevel.length > 0) banqueReference = byLevel
      }

      // Tentative 3 : fallback total
      if (banqueReference.length === 0) {
        const { data: any4 } = await supabase
          .from('pedagogical_activities')
          .select('title, category, level_min, objective, instructions, tags')
          .limit(4)
        if (any4 && any4.length > 0) banqueReference = any4
      }
    }
    // === Fin RAG ===

    const banqueBlock = banqueReference.length > 0
      ? `\n\nBanque de référence pédagogique (exercices certifiés similaires — calibre ta correction dessus) :\n${JSON.stringify(banqueReference, null, 2)}`
      : "\n\nAucune banque de référence disponible — corrige selon les standards CECRL généraux."

    const epreuvesAutorisees = demarche === "naturalisation"
      ? "CO, CE, EE, EO (les 4 épreuves obligatoires, seuil B1 strict)"
      : "CO et CE principalement (titre de séjour, tolérance EE/EO)"

    const userPrompt = `CORRECTION DEMANDÉE :
Épreuve : ${targetEpreuve}
Niveau visé : ${targetNiveau}
Démarche IRN : ${demarche} — ${epreuvesAutorisees}
Exercice / Support : "${exerciseContent || 'Non fourni'}"
Règle / Consigne : "${rule || 'Exercice TCF IRN'}"
Réponse de l'apprenant : "${studentAnswer}"
${banqueBlock}

Produis le JSON de correction complet selon le format spécifié.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TCF_CORRECTION_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.15 }
        })
      }
    )

    const data = await response.json()
    if (!data.candidates) {
      throw new Error("Erreur Gemini: " + JSON.stringify(data))
    }

    const content = data.candidates[0].content.parts[0].text
    const evaluation = JSON.parse(content)

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("tcf-evaluate-answer error:", error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})