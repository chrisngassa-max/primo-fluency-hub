import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { QA_REVIEW_BLOCK } from '../_shared/qa-prompt.ts';
import { validateAndFix } from '../_shared/exercise-validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { skill_type, format, level, theme, gabarit_id, nombre_items, difficulte, formateur_id, point_a_maitriser_id } = await req.json();

    // [ADAPTATION captcf] point_a_maitriser_id est NOT NULL dans captcf
    if (!point_a_maitriser_id) {
      return new Response(JSON.stringify({ error: 'point_a_maitriser_id requis dans captcf' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Lire le gabarit pédagogique
    // [ADAPTATION captcf] colonnes directes: titre, consignes_generation, lexique_cibles, objectif_principal (pas de champ "structure")
    const { data: gabarit, error: gabaritError } = await supabase
      .from('gabarits_pedagogiques')
      .select('*')
      .eq('id', gabarit_id)
      .single();

    if (gabaritError || !gabarit) {
      return new Response(JSON.stringify({ error: 'Gabarit introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Lire les 3 derniers exercices similaires pour éviter les doublons
    const { data: existingExercices } = await supabase
      .from('exercices')
      .select('titre, consigne, contenu')
      .eq('formateur_id', formateur_id)
      .eq('competence', skill_type)
      .eq('niveau_vise', level)
      .order('created_at', { ascending: false })
      .limit(3);

    const existingContext = existingExercices?.map(e => ({
      titre: e.titre,
      consigne: e.consigne,
    })) ?? [];

    // 3. Appeler Claude
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'Clé API Anthropic manquante' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Tu es expert TCF IRN. Tu génères des exercices FLE pour apprenants A0/A1. Contextes : préfecture, médecin, CAF, logement. Inspire-toi du gabarit fourni. Évite de reproduire les exercices existants. Retourne uniquement du JSON strict : { titre, consigne, competence, niveau_cecrl, format, contenu: { items: [{question, options[], bonne_reponse, explication}] }, justification_pedagogique, duree_estimee_secondes }` + QA_REVIEW_BLOCK;

    // [ADAPTATION captcf] Accès direct aux colonnes du gabarit (pas gabarit.structure.*)
    const userMessage = `Gabarit : ${JSON.stringify({
      titre: gabarit.titre,
      consignes_generation: gabarit.consignes_generation,
      lexique_cibles: gabarit.lexique_cibles,
      objectif_principal: gabarit.objectif_principal,
    })}

Paramètres : compétence=${skill_type}, format=${format}, niveau=${level}, thème=${theme}, difficulté=${difficulte}/5, nombre_items=${nombre_items}

Exercices existants à ne pas reproduire : ${JSON.stringify(existingContext)}`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      return new Response(JSON.stringify({ error: 'Erreur Claude API', detail: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text ?? '';

    let exerciseJson: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Pas de JSON trouvé');
      exerciseJson = JSON.parse(jsonMatch[0]);
    } catch {
      return new Response(JSON.stringify({ error: 'JSON invalide retourné par Claude', raw: rawText }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!exerciseJson.titre || !exerciseJson.consigne || !exerciseJson.contenu?.items) {
      return new Response(JSON.stringify({ error: 'Structure JSON incomplète', data: exerciseJson }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Validation déterministe + régénération ──
    const validated = await validateAndFix(
      { ...exerciseJson, competence: skill_type, format, niveau_vise: level, difficulte },
      { niveau: level }
    );
    if (!validated) {
      console.warn('[QA_AUTO][claude-generate-exercise] Excluded after retries');
      return new Response(JSON.stringify({ error: 'QA bloquée : exercice invalide après régénération' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    exerciseJson = { ...exerciseJson, ...validated.exercise };

    // 5. Insérer dans exercices
    // [ADAPTATION captcf] statut='draft' (pas 'to_review'), point_a_maitriser_id requis
    const { data: newExercice, error: insertError } = await supabase
      .from('exercices')
      .insert({
        titre: exerciseJson.titre,
        consigne: exerciseJson.consigne,
        competence: skill_type,
        niveau_vise: level,
        format: format,
        difficulte: difficulte,
        formateur_id: formateur_id,
        contenu: exerciseJson.contenu,
        point_a_maitriser_id: point_a_maitriser_id,
        statut: 'draft',
        is_ai_generated: true,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Erreur insertion', detail: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ...newExercice, justification_pedagogique: exerciseJson.justification_pedagogique, duree_estimee_secondes: exerciseJson.duree_estimee_secondes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
