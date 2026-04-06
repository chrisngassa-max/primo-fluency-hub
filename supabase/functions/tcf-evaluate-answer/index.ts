const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Tu es le correcteur pédagogique de captcf.fr, spécialisé TCF IRN.

RÈGLES DE CORRECTION :
- QCM (CO/CE) : Indiquer correct ou incorrect. Expliquer pourquoi la bonne réponse est la bonne. Si incorrect, renseigner type_erreur.
- Productions (EE/EO) : Évaluer selon les 4 critères officiels TCF :
  1. Adéquation à la tâche
  2. Cohérence et cohésion
  3. Compétence linguistique
  4. Compétence phonologique (EO uniquement)

TON : Bienveillant mais honnête. Orienté résultat TCF. Jamais condescendant.
Identifier les 2-3 points les plus impactants pour le score TCF.
Proposer une reformulation modèle courte.
Terminer par un encouragement ciblé ancré dans la progression TCF.

TOLÉRANCE PHONÉTIQUE (réponses orales) :
Accepter les homophones et approximations phonétiques. Ignorer ponctuation, casse, espaces. Reconnaître l'intention même si la forme est imparfaite. Ne pas pénaliser les erreurs STT.

FORMAT DE SORTIE OBLIGATOIRE (JSON) :
{
  "resultat": "correct | incorrect | partiel",
  "is_correct": boolean,
  "score": entier sur 10,
  "niveau_cecrl_atteint": "A0 | A1 | A2 | B1 | B2",
  "type_erreur": "comprehension_globale | reperage_lexical | piege_distracteur | vide si correct",
  "correction_text": "Message d'explication pédagogique",
  "justification_pedagogique": "Pourquoi la bonne réponse est correcte et analyse des pièges",
  "criteres_correction": {
    "adequation_tache": "Évaluation concise",
    "coherence_cohesion": "Évaluation concise",
    "competence_linguistique": "Évaluation concise",
    "competence_phonologique": "Évaluation concise — EO uniquement"
  },
  "points_forts": ["Point 1", "Point 2"],
  "points_amelioration": ["Priorité 1", "Priorité 2"],
  "reformulation_modele": "Version améliorée courte de la production",
  "encouragement": "Message motivant ancré dans l'objectif TCF IRN (1-2 phrases)",
  "priorite_remediation": "Compétence ou notion la plus urgente à retravailler"
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { studentAnswer, exerciseContent, rule, epreuve, niveau } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurée')

    const userPrompt = `Évalue cette réponse d'apprenant TCF IRN :

Épreuve : ${epreuve || 'Grammaire générale'}
Niveau visé : ${niveau || 'A1'}
Exercice : "${exerciseContent}"
Règle/Consigne : "${rule || 'Exercice TCF IRN'}"
Réponse de l'apprenant : "${studentAnswer}"

Produis un JSON complet avec tous les champs du format de sortie, y compris justification_pedagogique, criteres_correction, points_forts, points_amelioration, reformulation_modele, encouragement et priorite_remediation.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const evaluation = JSON.parse(content);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
