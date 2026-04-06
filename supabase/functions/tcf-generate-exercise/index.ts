import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT_BASE = `Tu es le moteur pédagogique de captcf.fr, application dédiée à la préparation intensive au TCF IRN.
Tu es un coach TCF IRN de haut niveau. Tout ce que tu produis est calibré sur les grilles d'évaluation officielles du TCF IRN.

CONTRAINTE TECHNIQUE ABSOLUE : Tu réponds exclusivement en JSON valide et complet. Tu ne tronques jamais un bloc JSON.

PROFIL DU PUBLIC — NIVEAU A0 CONTEXTUALISÉ :
Le niveau A0 désigne des adultes intégrés en France, majoritairement issus du Maghreb, qui parlent et comprennent partiellement le français oral du quotidien. Ils ont des lacunes différentielles ciblées : lecture, syntaxe écrite, repérage structuré de l'information. Ce ne sont pas des débutants linguistiques — ce sont des débutants scolaires face au format de l'examen.

CADRE TCF IRN — 4 ÉPREUVES :
- CO (Compréhension de l'Oral) : QCM, 25 questions, 4 choix, 20 min
- CE (Compréhension de l'Écrit) : QCM, 25 questions, 4 choix, 35 min
- EE (Expression Écrite) : 3 tâches rédactionnelles progressives, 30 min
- EO (Expression Orale) : 3 tâches orales progressives, 10 min

RÈGLES DE GÉNÉRATION :
- Contextes exclusivement ancrés dans la vie en France : préfecture, CAF, médecin, SNCF, logement, école, Pôle Emploi, commerce, mairie, banque, poste, urgences.
- Thématiques prioritaires IRN : droits et devoirs, vie administrative, santé, famille, travail, logement.
- Pour CO : fournir un script_audio complet avec marqueurs [pause 1s], [pause 2s], [ton interrogatif], [débit lent].
- Pour CE : décrire précisément le support visuel dans image_description. Le champ texte contient le document à lire.
- Pour EE : consignes suffisamment riches pour atteindre le volume de mots demandé.
- Pour EO : consignes orales concises et directement actionnables. Fournir image_description.
- 4 choix de réponse pour QCM, un seul correct. Distracteurs fondés sur des erreurs réelles (sonorité proche, confusion de dates, piège contextuel, synonyme trompeur).
- Jamais condescendant. Bienveillant mais honnête.

FORMAT DE SORTIE OBLIGATOIRE (JSON) :
{
  "titre": "Titre court",
  "consigne": "Formulation exacte pour l'apprenant",
  "epreuve": "CO | CE | EE | EO",
  "niveau_cecrl": "A0 | A1 | A2 | B1 | B2",
  "source": "genere",
  "type": "QCM | redaction | oral",
  "contexte": "Situation de communication (1-2 phrases)",
  "support": "Script audio (CO) ou texte du support visuel (CE) — vide pour EE/EO",
  "mot_cle_image": "mot clé EN ANGLAIS pour banque photo",
  "image_description": "Description détaillée de l'image pour CE/EO",
  "justification_pedagogique": "Explication de la bonne réponse et des pièges (2-3 lignes)",
  "criteres_correction": {
    "adequation_tache": "Critère concis",
    "coherence_cohesion": "Critère concis",
    "competence_linguistique": "Critère concis",
    "competence_phonologique": "Critère concis — EO uniquement, vide sinon"
  },
  "duree_estimee_secondes": 90,
  "note_differentiation": "Calibrage selon le profil apprenant (1 ligne)",
  "type_distracteurs": "sonorité_proche | confusion_date | piège_contexte | synonyme_trompeur",
  "contenu": {
    "items": [
      {
        "question": "...",
        "options": ["A: ...", "B: ...", "C: ...", "D: ..."],
        "bonne_reponse": "...",
        "explication": "..."
      }
    ],
    "script_audio": "... (CO uniquement)",
    "texte": "... (CE uniquement)",
    "image_description": "... (CE/EO)",
    "type_reponse": "ecrit | oral",
    "criteres_evaluation": {},
    "mots_cles_attendus": []
  }
}`;

function validateExercise(ex: any): string[] {
  const required = ["titre", "consigne", "epreuve", "niveau_cecrl", "type", "contenu"];
  const missing = required.filter(f => !ex[f]);
  if (!["CO", "CE", "EE", "EO"].includes(ex.epreuve)) missing.push("epreuve_invalide");
  if (ex.type === "QCM" && ex.contenu?.items) {
    for (const item of ex.contenu.items) {
      if (!item.options || item.options.length < 4) { missing.push("qcm_moins_4_options"); break; }
      if (!item.bonne_reponse) { missing.push("bonne_reponse_manquante"); break; }
    }
  }
  return missing;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { theme, level, competence, apprenant, type_demarche } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurée')

    // --- CORRECTION 2: Banque lookup before AI ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const searchWord = theme?.split(" ")[0] || "";
    if (searchWord && competence) {
      const { data: existing } = await supabase
        .from("exercices")
        .select("*")
        .eq("competence", competence)
        .eq("niveau_vise", level || "A1")
        .ilike("titre", `%${searchWord}%`)
        .limit(1)
        .maybeSingle();

      if (existing?.contenu && typeof existing.contenu === "object" && Object.keys(existing.contenu as Record<string, unknown>).length > 0) {
        return new Response(JSON.stringify({ ...(existing.contenu as Record<string, unknown>), source: "banque", id: existing.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- CORRECTION 1: type_demarche injection ---
    let demarcheBlock = "";
    if (type_demarche === "naturalisation") {
      demarcheBlock = `\n\nDÉMARCHE : Naturalisation — Seuil OBLIGATOIRE B1 sur toutes les épreuves. Syntaxe complexe, connecteurs logiques, argumentation simple, vocabulaire administratif enrichi.`;
    } else {
      demarcheBlock = `\n\nDÉMARCHE : Titre de séjour/Résidence — Seuil cible A2/B1 OFII. Priorité compréhension orale et écrite de la vie quotidienne et administrative.`;
    }

    const SYSTEM_PROMPT = SYSTEM_PROMPT_BASE + demarcheBlock;

    let apprenantBlock = "";
    if (apprenant) {
      apprenantBlock = `

PROFIL APPRENANT (OBLIGATOIRE à prendre en compte) :
- Niveau actuel : ${JSON.stringify(apprenant.niveau_actuel_par_competence || apprenant.niveau_actuel || "inconnu")}
- Taux de réussite : ${JSON.stringify(apprenant.taux_reussite_par_competence || {})}
- Vitesse de progression : ${apprenant.vitesse_progression || "normale"}
Adapte l'exercice au profil. Remplis le champ note_differentiation en conséquence.`;
    }

    const userPrompt = `Génère un exercice TCF IRN complet pour :
- Thème : "${theme}"
- Niveau : ${level || 'A1'}${competence ? `\n- Compétence visée : ${competence}` : ''}${apprenantBlock}

Produis un JSON complet avec tous les champs du format de sortie, y compris justification_pedagogique, criteres_correction, duree_estimee_secondes et note_differentiation.`;

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
    const exercise = JSON.parse(content);
    exercise.source = "genere";

    // --- Validate AI output ---
    const validationErrors = validateExercise(exercise);
    if (validationErrors.length > 0) {
      console.error("AI output validation failed:", validationErrors);
      return new Response(
        JSON.stringify({ error: "L'IA a produit un exercice incomplet", details: validationErrors }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch illustration from Pexels using mot_cle_image
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
        console.error("Pexels image fetch error:", imgErr);
      }
    }

    return new Response(JSON.stringify(exercise), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})