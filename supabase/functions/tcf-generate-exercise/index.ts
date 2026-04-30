// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"
import { QA_REVIEW_BLOCK } from "../_shared/qa-prompt.ts"
import { ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `
## RÔLE ET IDENTITÉ
Tu es le moteur pédagogique de captcf.fr, une application dédiée à la préparation intensive au TCF IRN. Tu n'es pas un assistant généraliste. Tu n'es pas un professeur de français. Tu es un coach TCF IRN de haut niveau, dont la seule et unique mission est d'amener chaque apprenant au score dont il a besoin pour réussir ses démarches administratives.
Tout ce que tu produis est calibré sur les grilles d'évaluation officielles du TCF IRN et le format exact de l'examen. Tu fais de la pédagogie pour le score.

## MISSION OPÉRATIONNELLE
Tu reçois des requêtes de quatre types: GÉNÉRATION D'EXERCICES, GÉNÉRATION DE SÉANCES, GÉNÉRATION D'ACTIVITÉS, CORRECTION.
Tu réponds exclusivement en JSON structuré.

## NIVEAUX — RÉFÉRENTIEL ÉTENDU A0 → B2
A0: Adulte intégré, français partiel oral, lacunes écrites/syntaxiques. Non-débutant absolu. Familiarisation avec le format TCF.
A1: Premier objectif de certification TCF.
A2: Progression vers le seuil B1.
B1: Seuil IRN minimum. Objectif cible.
B2: Au-delà du seuil.

## CADRE DE RÉFÉRENCE — LES 4 ÉPREUVES TCF IRN
CO (QCM audio), CE (QCM écrit), EE (Expression écrite), EO (Expression orale).
Seuils IRN: Titre de séjour: B1 min (CO+CE). Naturalisation: B1 min sur les 4.

## PARAMÈTRES ET DIFFÉRENCIATION
Tu prends en compte la pédagogie différenciée selon la progression (rapide, lente, moyenne).
Tu respectes les plans de séquences et la banque de données si fournis.

## RÈGLES DE GÉNÉRATION D'EXERCICES
- Tagué obligatoirement par épreuve (CO, CE, EE, EO) et niveau (A0, A1, A2, B1, B2).
- Contextes ancrés dans la vie en France: préfecture, médecin, CAF, logement, etc.
- Si une "Banque de données pédagogique" est fournie dans la requête, elle contient des exercices OFFICIELS certifiés. Tu DOIS t'en inspirer en priorité pour générer ton exercice (même thème, même structure, même ancrage IRN). Indique alors source: "banque_adapte".
- Si aucune banque n'est fournie, génère librement. Indique alors source: "genere".
- Format de sortie JSON STRICT:
{
  "epreuve": "CO | CE | EE | EO",
  "niveau_depart": "A0 | A1 | A2 | B1 | B2",
  "niveau_arrivee": "A1 | A2 | B1 | B2",
  "niveau_cecrl": "A0 | A1 | A2 | B1 | B2",
  "source": "banque | banque_adapte | genere",
  "type": "QCM | redaction | oral",
  "contexte": "Description de la situation de communication",
  "support": "Script audio complet (CO) ou texte/description du support visuel (CE) — vide pour EE/EO",
  "consigne": "Formulation exacte de la consigne pour l'apprenant",
  "choix": ["A: ...", "B: ...", "C: ...", "D: ..."],
  "reponse_correcte": "Lettre et texte de la bonne réponse — QCM uniquement",
  "justification_pedagogique": "Explication courte du pourquoi de la bonne réponse et des pièges",
  "criteres_correction": { "adequation_tache": "...", "coherence_cohesion": "...", "competence_linguistique": "...", "competence_phonologique": "..." },
  "duree_estimee_secondes": 90,
  "note_differentiation": "Explication du calibrage par rapport au profil apprenant",
  "seances_restantes_avant_examen": 12,
  "mot_cle_image": "phrase descriptive en anglais pour illustrer (DOIT correspondre exactement au contenu du support/script audio — ex: si le script est un dialogue chez le médecin, mettre 'french doctor office consultation patient')",
  "titre": "Titre court de l'exercice",
  "contenu": "Corps de l'exercice (texte, questions, scénario)"
}

RÈGLES LINGUISTIQUES STRICTES POUR APPRENANTS A0/A1 :
CONSIGNES :
- Maximum 12 mots par consigne
- Verbe à l'impératif uniquement (« Choisis », « Écris », « Écoute »)
- INTERDIT : subordonnées relatives, subjonctif, conditionnel
- Vocabulaire du quotidien CECRL A1 uniquement
- Phrases courtes (sujet + verbe + complément)
EXEMPLES VALIDES :
✅ « Choisis la bonne réponse. »
✅ « Écoute et coche la bonne case. »
✅ « Écris ton nom dans la case. »
EXEMPLES INTERDITS :
❌ « Tu choisiras celle qui te semble correcte. »
❌ « Sélectionne parmi les propositions qui suivent celle qui est la plus adaptée. »
❌ « Indiquez la réponse que vous jugez appropriée. »
VÉRIFICATION FINALE : avant de retourner la consigne, compte les mots. Si > 12, réécris-la plus courte.

RAPPEL: Tu existes pour une seule raison : que l'apprenant réussisse son TCF IRN. Exigeant et bienveillant, orienté B1.
` + QA_REVIEW_BLOCK;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { theme, level, dispositif, apprenant, banque_donnees, type_demarche } = body;

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('La clé GEMINI_API_KEY n\'est pas configurée')

    // === RAG : Recherche dans la banque d'exercices existants (327 exercices scannés) ===
    let basePedagogique = banque_donnees || [];

    if (!banque_donnees || banque_donnees.length === 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const targetLevel = level || 'B1'
        const selectFields = 'titre, competence, niveau_vise, consigne, format, contexte_irn, contenu, sous_competence'

        // Tentative 1 : par thème + compétence
        if (theme) {
          const { data: byTheme } = await supabase
            .from('exercices')
            .select(selectFields)
            .or(`titre.ilike.%${theme}%,consigne.ilike.%${theme}%,contexte_irn.ilike.%${theme}%,sous_competence.ilike.%${theme}%`)
            .limit(5)
          if (byTheme && byTheme.length > 0) basePedagogique = byTheme
        }

        // Tentative 2 : par niveau + compétence (si dispositif contient une épreuve)
        if (basePedagogique.length === 0 && dispositif?.epreuve) {
          const { data: byComp } = await supabase
            .from('exercices')
            .select(selectFields)
            .eq('competence', dispositif.epreuve)
            .eq('niveau_vise', targetLevel)
            .limit(5)
          if (byComp && byComp.length > 0) basePedagogique = byComp
        }

        // Tentative 3 : par niveau seul
        if (basePedagogique.length === 0) {
          const { data: byLevel } = await supabase
            .from('exercices')
            .select(selectFields)
            .eq('niveau_vise', targetLevel)
            .limit(5)
          if (byLevel && byLevel.length > 0) basePedagogique = byLevel
        }

        // Tentative 4 : fallback — exercices aléatoires
        if (basePedagogique.length === 0) {
          const { data: fallback } = await supabase
            .from('exercices')
            .select(selectFields)
            .limit(5)
          if (fallback && fallback.length > 0) basePedagogique = fallback
        }
      }
    }
    // === Fin RAG ===

    const demarche = type_demarche || "titre_sejour";
    const epreuvesAutorisees = demarche === "naturalisation"
      ? "CO, CE, EE, EO (les 4 épreuves obligatoires)"
      : "CO et CE uniquement (titre de séjour)";

    const promptDynamique = `
GÉNÉRATION D'EXERCICE DEMANDÉE:
Thème ciblé : ${theme || 'Vie quotidienne en France'}
Niveau cible : ${level || 'B1'}
Démarche IRN : ${demarche} — Épreuves autorisées : ${epreuvesAutorisees}
Dispositif: ${JSON.stringify(dispositif || {})}
Profil Apprenant: ${JSON.stringify(apprenant || {})}
Banque de données pédagogique (Ressources Officielles TCF certifiées — inspire-toi en priorité) : ${JSON.stringify(basePedagogique)}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: promptDynamique }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      }
    );

    const data = await response.json();
    if (!data.candidates) throw new Error("Erreur Gemini: " + JSON.stringify(data));

    const exercise = JSON.parse(data.candidates[0].content.parts[0].text);
    if (!exercise.titre) exercise.titre = "Exercice TCF - " + (exercise.epreuve || theme || 'IRN');
    if (!exercise.contenu) exercise.contenu = exercise.support || exercise.contexte || exercise.consigne;

    // Fetch illustration Pexels
    const pexelsKey = Deno.env.get('PEXELS_API_KEY');
    const imageKeyword = exercise.mot_cle_image || exercise.contenu?.image_description;
    if (pexelsKey && imageKeyword) {
      try {
        const searchTerm = (exercise.mot_cle_image || imageKeyword).slice(0, 80);
        const pexelsResp = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1&orientation=landscape`,
          { headers: { Authorization: pexelsKey } }
        );
        if (pexelsResp.ok) {
          const pexelsData = await pexelsResp.json();
          if (pexelsData.photos?.length > 0) {
            exercise.image_url = pexelsData.photos[0].src.medium;
            exercise.image_credit = `Photo by ${pexelsData.photos[0].photographer} on Pexels`;
            if (exercise.contenu && typeof exercise.contenu === 'object') {
              exercise.contenu.image_url = exercise.image_url;
              exercise.contenu.image_credit = exercise.image_credit;
            }
          }
        }
      } catch (imgErr) {
        console.error("Pexels error:", imgErr);
      }
    }

    return new Response(JSON.stringify(exercise), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
