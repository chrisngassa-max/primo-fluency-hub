import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TCF_CORRECTION_PROMPT = `## RÔLE
Tu es le correcteur expert du moteur pédagogique captcf.fr, spécialisé TCF IRN.
Tu corriges les productions d'apprenants (A0–B2) selon les grilles officielles du TCF.

## CRITÈRES DE CORRECTION OFFICIELS
- adequation_tache : La réponse correspond-elle à ce qui est demandé ?
- coherence_cohesion : Le texte/discours est-il logique et organisé ?
- competence_linguistique : Grammaire, vocabulaire, orthographe.
- competence_phonologique (EO uniquement) : Prononciation, intonation, fluidité.

## TOLÉRANCE PHONÉTIQUE (réponses orales transcrites STT)
Accepter homophones et approximations phonétiques. Ignorer ponctuation, casse, espaces.
Reconnaître l'intention même si la forme est imparfaite. Ne pas pénaliser les erreurs STT.

## BANQUE PÉDAGOGIQUE
Si une banque de référence est fournie, utilise-la pour calibrer ta correction :
- Compare la production de l'apprenant aux standards de la banque
- Ajuste tes attentes au niveau visé
- Cite les éléments de référence dans ta justification

## FORMAT DE SORTIE JSON STRICT
{
  "resultat": "correct | partiellement_correct | incorrect",
  "score_estime": 7,
  "niveau_cecrl_atteint": "A1 | A2 | B1 | B2",
  "criteres_correction": {
    "adequation_tache": "...",
    "coherence_cohesion": "...",
    "competence_linguistique": "...",
    "competence_phonologique": "..."
  },
  "points_forts": ["...", "..."],
  "points_amelioration": ["...", "..."],
  "reformulation_modele": "Phrase modèle que l'apprenant aurait pu produire",
  "encouragement": "Message bienveillant et motivant",
  "priorite_remediation": "Point prioritaire à travailler"
}

RAPPEL : Sois exigeant sur le fond, bienveillant sur la forme. Objectif B1.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { studentAnswer, exerciseContent, rule, epreuve, niveau, type_demarche } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurée');

    const demarche = type_demarche || "titre_sejour";
    const targetEpreuve = epreuve || "CO";
    const targetNiveau = niveau || "A1";

    // === RAG : Recherche dans la banque pédagogique ===
    let banqueReference: any[] = [];
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Recherche par épreuve/compétence
      const { data: byEpreuve } = await supabase
        .from('pedagogical_activities')
        .select('title, category, level_min, objective, instructions, tags')
        .or(`category.ilike.%${targetEpreuve}%,tags.ilike.%${targetEpreuve}%`)
        .limit(3);
      if (byEpreuve && byEpreuve.length > 0) banqueReference = byEpreuve;

      // Fallback par niveau
      if (banqueReference.length === 0) {
        const { data: byLevel } = await supabase
          .from('pedagogical_activities')
          .select('title, category, level_min, objective, instructions, tags')
          .eq('level_min', targetNiveau)
          .limit(3);
        if (byLevel && byLevel.length > 0) banqueReference = byLevel;
      }
    }
    // === Fin RAG ===

    const banqueBlock = banqueReference.length > 0
      ? `\nBanque de référence pédagogique (exercices certifiés similaires — utilise-les pour calibrer ta correction) :\n${JSON.stringify(banqueReference)}`
      : "\nAucune banque de référence disponible — corrige selon les standards CECRL généraux.";

    const userPrompt = `Action : corriger
Épreuve : ${targetEpreuve}
Niveau visé : ${targetNiveau}
Démarche IRN : ${demarche}
Exercice : "${exerciseContent}"
Règle/Consigne : "${rule || 'Exercice TCF IRN'}"
Réponse de l'apprenant : "${studentAnswer}"
${banqueBlock}

Produis le JSON de correction complet.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: TCF_CORRECTION_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      throw new Error(`AI error ${status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const evaluation = JSON.parse(content);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("tcf-evaluate-answer error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
