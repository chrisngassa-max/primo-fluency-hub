import { TCF_SYSTEM_PROMPT, MODEL, AI_GATEWAY } from "../_shared/system-prompt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      theme,
      level,
      competence,
      apprenant,
      type_demarche,
      niveau_depart,
      niveau_arrivee,
      dispositif,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurée');

    // Bloc profil apprenant (différenciation individuelle)
    let apprenantBlock = "";
    if (apprenant) {
      apprenantBlock = `\n\nPROFIL APPRENANT (obligatoire) :
- Niveau actuel par compétence : ${JSON.stringify(apprenant.niveau_actuel_par_competence || {})}
- Taux de réussite par compétence : ${JSON.stringify(apprenant.taux_reussite_par_competence || {})}
- Score test d'entrée : ${JSON.stringify(apprenant.score_test_entree || {})}
- Vitesse de progression : ${apprenant.vitesse_progression || "normale"}
Adapte l'exercice au profil. Remplis note_differentiation en conséquence.`;
    }

    // Bloc dispositif (contraintes calendaires)
    let dispositifBlock = "";
    if (dispositif) {
      dispositifBlock = `\n\nDISPOSITIF DE FORMATION :
- Durée totale : ${dispositif.duree_totale_heures}h / Séances de ${dispositif.duree_seance_heures}h
- Rythme : ${dispositif.seances_par_semaine} séances/semaine (${(dispositif.jours_seance || []).join(", ")})
- Date examen cible : ${dispositif.date_examen_cible || "non définie"}`;
    }

    const demarche = type_demarche || "titre_sejour";
    const epreuvesAutorisees = demarche === "naturalisation"
      ? "CO, CE, EE, EO (les 4 épreuves obligatoires)"
      : "CO et CE uniquement (titre de séjour)";

    const userPrompt = `Action : generer_exercice
Thème : "${theme}"
Niveau départ : ${niveau_depart || level || 'A0'}
Niveau arrivée : ${niveau_arrivee || 'A1'}
Compétence visée : ${competence || 'CO'}
Démarche IRN : ${demarche} → Épreuves autorisées : ${epreuvesAutorisees}${apprenantBlock}${dispositifBlock}

Produis un JSON complet avec tous les champs : titre, consigne, epreuve, niveau_cecrl, source, type, contexte, support, mot_cle_image, image_description, justification_pedagogique, criteres_correction, duree_estimee_secondes, note_differentiation, type_distracteurs, contenu (items, script_audio si CO, texte si CE, type_reponse, criteres_evaluation, mots_cles_attendus).`;

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
    const exercise = JSON.parse(content);

    // Fetch illustration Pexels
    const pexelsKey = Deno.env.get('PEXELS_API_KEY');
    const imageKeyword = exercise.mot_cle_image || exercise.contenu?.image_description;
    if (pexelsKey && imageKeyword) {
      try {
        const searchTerm = exercise.mot_cle_image || imageKeyword.split(' ').slice(0, 3).join(' ');
        const pexelsResp = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1&orientation=landscape`,
          { headers: { Authorization: pexelsKey } }
        );
        if (pexelsResp.ok) {
          const pexelsData = await pexelsResp.json();
          if (pexelsData.photos?.length > 0) {
            exercise.image_url = pexelsData.photos[0].src.medium;
            exercise.image_credit = `Photo by ${pexelsData.photos[0].photographer} on Pexels`;
            if (exercise.contenu) {
              exercise.contenu.image_url = exercise.image_url;
              exercise.contenu.image_credit = exercise.image_credit;
            }
          }
        }
      } catch (imgErr) {
        console.error("Pexels error:", imgErr);
      }
    }

    return new Response(JSON.stringify(exercise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
