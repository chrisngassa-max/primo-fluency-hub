// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { checkConsent, consentBlockedResponse, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TCF_CORRECTION_PROMPT = `## RÔLE ET IDENTITÉ
Tu es le correcteur expert du moteur pédagogique captcf.fr, spécialisé TCF IRN.
Tu corriges les productions d'apprenants (A0–B2) selon les grilles d'évaluation officielles du TCF.
Tu n'es pas un assistant généraliste. Ta seule mission : évaluer avec précision et bienveillance.

## RÈGLES DE NOTATION ABSOLUES (à appliquer AVANT toute autre considération)
1. **Adéquation à la consigne d'abord** : si la réponse ne traite PAS le sujet demandé, ou ne contient AUCUN des éléments demandés par la consigne (sujet, nombre d'informations, idées), alors :
   - resultat = "incorrect"
   - score = 0 (sur 10)
   - Tu DOIS l'indiquer clairement dans points_amelioration.
2. **Une simple salutation** ("Bonjour", "Bonjours", "Salut", "Coucou", etc.) répondue à une consigne demandant une production, est TOUJOURS incorrect, score = 0. Ce n'est pas une production, c'est une formule.
3. **Une réponse vide ou < 3 mots utiles** (hors salutations) à une consigne de production est incorrect, score = 0.
4. **Une réponse hors-sujet en français correct** reste incorrect, score ≤ 2. La langue ne sauve pas l'absence de contenu.
5. **Une réponse partielle** qui aborde le sujet mais oublie des éléments demandés : partiellement_correct, score 3-6 selon la complétude.
6. **Une réponse complète et compréhensible**, même avec des fautes de français : correct, score 7-10. La tolérance porte sur la FORME (orthographe, grammaire, conjugaison), JAMAIS sur l'absence de CONTENU.

## CRITÈRES DE CORRECTION (dans cet ordre de priorité)
1. **Adéquation à la tâche** (priorité absolue) : sujet traité, consigne respectée, éléments demandés présents.
2. **Cohérence et cohésion** : organisation logique, connecteurs au niveau visé.
3. **Compétence linguistique** : grammaire, vocabulaire, orthographe — tolérante sur la forme, pas sur le fond.
4. **Compétence phonologique** (EO uniquement) : prononciation, intonation, fluidité.

## TOLÉRANCE PHONÉTIQUE (réponses orales transcrites par STT)
- Accepter les homophones et approximations phonétiques dues à la transcription automatique.
- Ignorer ponctuation, casse, espaces superflus.
- Reconnaître l'intention communicative même si la forme est imparfaite.
- Ne JAMAIS pénaliser les artefacts de transcription STT.
- ATTENTION : ces tolérances ne s'appliquent qu'à la FORME. Une réponse hors-sujet reste hors-sujet.

## CALIBRAGE PAR DÉMARCHE IRN
- **Titre de séjour / Résidence** : Seuil B1 sur CO + CE. Tolérance plus large sur EE/EO.
- **Naturalisation** : Seuil B1 strict sur les 4 épreuves. Exigences syntaxiques et argumentatives plus élevées.

## BANQUE PÉDAGOGIQUE DE RÉFÉRENCE
Si une banque de référence est fournie ci-dessous, utilise-la pour calibrer ta correction (standards, niveau visé, critères de réussite).

## FORMAT DE SORTIE JSON STRICT (champs obligatoires en gras)
{
  "resultat": "correct | partiellement_correct | incorrect",
  "score": 0,                    // ENTIER de 0 à 10. 0 = vide/hors-sujet/salutation. 10 = parfait.
  "score_estime": 0,             // alias rétro-compatibilité, mêmes valeurs que "score"
  "correct": false,              // true UNIQUEMENT si score >= 6 ET resultat = "correct"
  "justification": "...",        // 1-2 phrases qui expliquent CONCRÈTEMENT au formateur pourquoi ce score
  "correction_text": "...",      // alias de justification (rétro-compatibilité)
  "niveau_cecrl_atteint": "A0 | A1 | A2 | B1 | B2",
  "points_forts": ["..."],       // [] si rien à valoriser
  "points_amelioration": ["..."],// précis : ce qui manque par rapport à la consigne
  "reformulation_modele": "...", // exemple court de réponse attendue, adressé à l'élève en tutoiement
  "encouragement": "...",        // bienveillant mais HONNÊTE — ne félicite jamais une non-réponse
  "priorite_remediation": "..."  // un seul axe à travailler en premier
}

RAPPEL CRITIQUE :
- "Bonjours" à une consigne "Présentez votre famille" → score: 0, correct: false, resultat: "incorrect", justification: "La réponse est une salutation, pas une présentation. Aucun membre de la famille n'est cité."
- Sois exigeant sur le fond, bienveillant sur la forme.
- Retourne UNIQUEMENT le JSON, rien d'autre.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { studentAnswer, exerciseContent, rule, epreuve, niveau, type_demarche, eleveId } = body

    const triggeredBy = await getUserIdFromAuth(req);
    const subjectId = eleveId || triggeredBy;
    const isOral = (epreuve || "CO") === "EO";
    const secretBlock = await ensurePseudonymSecretOrLog("tcf-evaluate-answer", corsHeaders, subjectId);
    if (secretBlock) return secretBlock;
    if (subjectId) {
      const consent = await checkConsent({ userId: subjectId, requireBiometric: isOral });
      if (!consent.ok) {
        await logAICall({ function_name: "tcf-evaluate-answer", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: isOral ? ["production", "voice"] : ["production"], pseudonymization_level: "none" });
        return consentBlockedResponse(consent.reason || "consent_required", corsHeaders);
      }
    }
    await logAICall({ function_name: "tcf-evaluate-answer", subject_user_id: subjectId, triggered_by_user_id: triggeredBy, status: "ok", data_categories: isOral ? ["production", "voice"] : ["production"], pseudonymization_level: "none" });

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('La clé GEMINI_API_KEY n\'est pas configurée')

    const demarche = type_demarche || "titre_sejour"
    const targetEpreuve = epreuve || "CO"
    const targetNiveau = niveau || "A1"

    // === GARDE-FOU PRÉ-IA : salutations / vide / hors-sujet flagrant ===
    // Évite de payer Gemini pour des cas où le résultat est évident, et
    // garantit qu'aucune bienveillance excessive ne valorise une non-réponse.
    const raw = String(studentAnswer ?? "").trim()
    const normalized = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.,;:!?'"()«»\-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const SALUTATIONS = new Set([
      "", "bonjour", "bonjours", "bonsoir", "salut", "coucou", "hello", "hi",
      "bonne journee", "bonne soiree", "merci", "ok", "oui", "non",
    ])
    const usefulWords = normalized
      .split(" ")
      .filter((w) => w.length > 1)
      .filter((w) => !["le", "la", "les", "un", "une", "des", "et", "de", "du"].includes(w))
    if (SALUTATIONS.has(normalized) || raw.length < 4 || usefulWords.length < 2) {
      const justification = raw.length === 0
        ? "Aucune réponse n'a été fournie."
        : SALUTATIONS.has(normalized)
          ? `La réponse "${raw}" est une formule de politesse, pas une production qui répond à la consigne.`
          : "La réponse est trop courte pour traiter la consigne."
      return new Response(JSON.stringify({
        resultat: "incorrect",
        score: 0,
        score_estime: 0,
        correct: false,
        justification,
        correction_text: justification,
        niveau_cecrl_atteint: "A0",
        points_forts: [],
        points_amelioration: ["Lis attentivement la consigne", "Donne au moins une information demandée"],
        reformulation_modele: "",
        encouragement: "Tu peux y arriver — relis la question et donne une vraie réponse.",
        priorite_remediation: "Comprendre et traiter la consigne",
        skipped_ai: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

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

    // Normalisation des alias attendus par le frontend (rétro-compatibilité).
    const score = Number(evaluation.score ?? evaluation.score_estime ?? 0)
    const safeScore = Math.max(0, Math.min(10, Math.round(isFinite(score) ? score : 0)))
    const justification = evaluation.justification ?? evaluation.correction_text ?? ""
    const resultat = evaluation.resultat ?? (safeScore >= 6 ? "correct" : safeScore >= 3 ? "partiellement_correct" : "incorrect")
    const correct = typeof evaluation.correct === "boolean"
      ? evaluation.correct
      : (resultat === "correct" && safeScore >= 6)

    const normalized = {
      ...evaluation,
      score: safeScore,
      score_estime: safeScore,
      correct,
      resultat,
      justification,
      correction_text: justification,
    }

    return new Response(JSON.stringify(normalized), {
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