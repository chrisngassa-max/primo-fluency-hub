import { TCF_SYSTEM_PROMPT, MODEL, AI_GATEWAY } from "../_shared/system-prompt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { studentAnswer, exerciseContent, rule, epreuve, niveau, type_demarche } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurée');

    const demarche = type_demarche || "titre_sejour";

    const userPrompt = `Action : corriger
Épreuve : ${epreuve || 'CO'}
Niveau visé : ${niveau || 'A1'}
Démarche IRN : ${demarche}
Exercice : "${exerciseContent}"
Règle/Consigne : "${rule || 'Exercice TCF IRN'}"
Réponse de l'apprenant : "${studentAnswer}"

TOLÉRANCE PHONÉTIQUE (réponses orales) : Accepter les homophones et approximations phonétiques. Ignorer ponctuation, casse, espaces. Reconnaître l'intention même si la forme est imparfaite. Ne pas pénaliser les erreurs STT.

Produis un JSON complet : resultat, is_correct, score (sur 10), niveau_cecrl_atteint, type_erreur, correction_text, justification_pedagogique, criteres_correction, points_forts, points_amelioration, reformulation_modele, encouragement, priorite_remediation.`;

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: TCF_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const evaluation = JSON.parse(content);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
