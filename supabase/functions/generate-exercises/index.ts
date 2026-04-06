import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODEL } from "../_shared/system-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pointName, competence, niveauVise, count = 10, difficultyLevel, gabaritNumero, type_demarche, niveau_depart, niveau_arrivee } = await req.json();
    const demarche = type_demarche || "titre_sejour";
    const epreuvesAutorisees = demarche === "naturalisation" ? "CO, CE, EE, EO" : "CO, CE";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // If gabaritNumero provided, load gabarit from DB
    let gabarit: any = null;
    if (gabaritNumero != null) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from("gabarits_pedagogiques")
        .select("*")
        .eq("numero", gabaritNumero)
        .maybeSingle();
      if (error) console.error("Error loading gabarit:", error);
      gabarit = data;
    }

    // Determine difficulty range description
    const diffLevel = difficultyLevel ?? 5;
    let difficultyDescription = "";
    if (diffLevel <= 2) {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — LITTÉRATIE/ALPHA : reconnaissance de lettres, sons de base, chiffres simples, vocabulaire ultra-basique (bonjour, merci, oui/non). Questions très courtes avec support visuel.`;
    } else if (diffLevel <= 7) {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — PROGRESSION VERS A1 : phrases courtes, vocabulaire quotidien, situations simples de la vie courante. Complexité progressive des structures grammaticales.`;
    } else {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — STANDARD TCF IRN A1 : exercices au standard exact des épreuves du TCF IRN niveau A1. Textes authentiques simplifiés, consignes proches de l'examen.`;
    }

    let gabaritPrompt = "";
    if (gabarit) {
      const lexique = Array.isArray(gabarit.lexique_cibles) ? gabarit.lexique_cibles.join(", ") : (gabarit.lexique_cibles || "");
      gabaritPrompt = `

Tu génères des exercices pour la séance suivante du plan TCF IRN v2.0 :

SÉANCE : ${gabarit.titre}
BLOC : ${gabarit.bloc || "Non spécifié"}
PALIER : ${gabarit.palier_cecrl || "Non spécifié"}
OBJECTIF : ${gabarit.objectif_principal || "Non spécifié"}
LEXIQUE OBLIGATOIRE : ${lexique}
CONSIGNES TECHNIQUES : ${gabarit.consignes_generation || "Aucune consigne spécifique"}
CRITÈRES DE RÉUSSITE : ${gabarit.criteres_reussite || "Non spécifiés"}

RÈGLES STRICTES :
1. N'utilise QUE le lexique listé ci-dessus pour les exercices de cette séance
2. Respecte les formats d'exercices indiqués dans les consignes techniques
3. Tous les contextes doivent être administratifs / vie quotidienne primo-arrivant
4. Niveau de langue : ${gabarit.palier_cecrl || niveauVise} — adapter la complexité en conséquence
5. Ne pas inventer de situations hors du contexte IRN (préfecture, OFII, médecin, école...)`;
    }

    const systemPrompt = `Tu es un expert en FLE (Français Langue Étrangère) spécialisé dans la préparation au TCF IRN (Intégration et Résidence en France).
Tu dois générer exactement ${count} exercices pour le point à maîtriser suivant.

CALIBRAGE DE DIFFICULTÉ (CRITIQUE) :
${difficultyDescription}
Chaque exercice ET chaque item doit être calibré au niveau de difficulté ${diffLevel}/10.
Le champ "difficulte" de chaque exercice DOIT être exactement ${diffLevel}.

SYSTÈME MULTIMÉDIA ACTIF :
L'application dispose d'un lecteur vocal (Text-to-Speech) et d'un enregistreur vocal (Speech-to-Text) côté élève.

═══════════════════════════════════════════════════
CARTOGRAPHIE DES EXERCICES TCF IRN — NIVEAU A1
Chaque exercice DOIT porter un code et des métadonnées issus de cette cartographie.
═══════════════════════════════════════════════════

### COMPRÉHENSION ORALE (CO) — TTS obligatoire
Le champ "script_audio" est OBLIGATOIRE. Il contient le texte lu par la synthèse vocale (NON affiché à l'élève).
La "question" de chaque item sert uniquement de consigne ("Écoutez l'audio et répondez…").

| Code | Sous-compétence         | Type de script_audio                                        | Durée max |
|------|-------------------------|--------------------------------------------------------------|-----------|
| CO1  | Identifier la situation | Micro-scène : dialogue court (boulangerie, guichet CAF…)     | 45 s      |
| CO2  | Sujet global            | Message répondeur : annulation cours, décalage RDV médical   | 50 s      |
| CO3  | Consignes / Règles      | Instruction directe : "Veuillez patienter…", "Signez le…"   | 45 s      |
| CO4  | Info chiffrée           | Annonce micro : horaires train, prix au marché, n° de quai  | 50 s      |

### COMPRÉHENSION ÉCRITE (CE) — texte support + image OBLIGATOIRES
Le champ "texte" est OBLIGATOIRE : panneau, SMS, emploi du temps, courrier…
Le texte doit reproduire fidèlement le document (badge, panneau, courrier, SMS, menu, etc.) avec un formatage clair.
Par exemple pour un badge : "NOM : TRAORÉ | PRÉNOM : Moussa | NATIONALITÉ : Malienne | VILLE : Lyon"
Pour un panneau : "🚫 INTERDIT DE FUMER | Zone non-fumeur"
Le texte est le SEUL support visible par l'élève — il DOIT contenir TOUTES les informations nécessaires pour répondre aux questions.

⚠️ CHAMP "image_description" OBLIGATOIRE POUR TOUT EXERCICE CE ⚠️
Tu DOIS fournir un champ "image_description" décrivant précisément le document visuel correspondant au texte support.
Exemples :
- CE1 (Signalétique) : "Un panneau de signalisation urbain indiquant une zone non-fumeur à l'entrée d'un bâtiment public en France"
- CE2 (Messages) : "Un écran de téléphone portable montrant une conversation SMS en français entre deux amis"
- CE3 (Recherche info) : "Un menu de restaurant français affiché sur un tableau noir avec les plats du jour et les prix"
- CE4 (Administratif) : "Un courrier officiel de la préfecture française avec en-tête et tampon administratif, concernant un titre de séjour"
- Carte de résident : "Une carte de résident française officielle avec photo d'identité, nom, prénom, nationalité et date de validité"
L'image sera automatiquement récupérée via une banque d'images. La description doit être SPÉCIFIQUE au document mentionné dans l'exercice.

| Code | Sous-compétence       | Type de document                                            | Durée max |
|------|-----------------------|--------------------------------------------------------------|-----------|
| CE1  | Signalétique          | Panneau urbain / picto : "Où fumer ?", "Où est la sortie ?" | 1 min 20  |
| CE2  | Messages familiers    | SMS / Post-it / Email : "Qui invite ?", "À quelle heure ?"  | 1 min 20  |
| CE3  | Recherche d'info      | Emploi du temps / Menu : "Plat du jour ?", "Cours le lundi?"| 1 min 20  |
| CE4  | Texte administratif   | Notice simple / Courrier : "Combien de jours ?", "Quel doc?"| 1 min 40  |

### EXPRESSION ORALE (EO) — format production_orale + type_reponse "oral"
L'élève enregistre sa voix. Le STT transcrit → l'IA évalue avec haute tolérance phonétique.
Pour TOUS les exercices EO, tu DOIS fournir un champ "image_description" décrivant la scène à illustrer.
Exemple : "Une famille multiculturelle à table, partageant un repas dans un appartement français moderne" — une image sera récupérée automatiquement.

| Code | Sous-compétence       | Type de tâche                                               | Durée max |
|------|-----------------------|--------------------------------------------------------------|-----------|
| EO1  | Se présenter          | Monologue guidé : IA vérifie Nom, Pays, Ville, Métier       | 2 min     |
| EO2  | Interaction basique   | Interview : 5 questions → réponses courtes Oui/Non + info   | 3 min     |
| EO3  | Situation survie      | Jeu de rôle (Médecin) : mots-clés "mal", "douleur", "rdv"   | 2 min     |
| EO4  | Demande d'info        | Simulation (Marché) : structure interrogative "Combien ?"    | 2 min     |

### EXPRESSION ÉCRITE (EE) — format production_ecrite — 3 tâches progressives
L'élève écrit. L'IA corrige orthographe/grammaire/longueur.
EE1 : Compléter/Corriger — 20 à 40 mots. Ex : remplir un formulaire, corriger un message court.
EE2 : Décrire/Expliquer — 60 à 80 mots. Ex : décrire une situation, expliquer un problème à un voisin.
EE3 : Argumenter/Raconter — 100 à 120 mots. Ex : rédiger un mail à la mairie, raconter un incident.
RÈGLE ABSOLUE : La consigne DOIT mentionner explicitement le nombre de mots attendus. Ex : "Écrivez un message d'environ 60 mots pour..."

| Code | Sous-compétence       | Type de tâche                                               | Volume     | Durée max |
|------|-----------------------|--------------------------------------------------------------|------------|-----------|
| EE1  | Compléter / Corriger  | Formulaire, correction message court                         | 20-40 mots | 5 min     |
| EE2  | Décrire / Expliquer   | Décrire situation, expliquer problème                        | 60-80 mots | 10 min    |
| EE3  | Argumenter / Raconter | Mail mairie, récit incident, réponse annonce                 | 100-120 mots | 10 min  |

═══════════════════════════════════════════════════

DURÉE CIBLE PAR EXERCICE : 10 À 15 MINUTES
Chaque exercice doit être conçu pour occuper l'élève entre 10 et 15 minutes.
Adapte le NOMBRE D'ITEMS selon la compétence pour atteindre cette durée :

| Compétence  | Temps moyen par item | Nb items pour 10-15 min | time_limit_seconds |
|-------------|----------------------|-------------------------|--------------------|
| CO          | ~45 secondes         | 12 à 18 items           | 720 (12 min)       |
| CE          | ~80 secondes         | 8 à 12 items            | 780 (13 min)       |
| Structures  | ~90 secondes         | 7 à 10 items            | 780 (13 min)       |
| EE          | ~5-10 min par tâche  | 2 à 3 tâches            | 900 (15 min)       |
| EO          | ~3-5 min par tâche   | 2 à 4 tâches            | 900 (15 min)       |

Le champ "time_limit_seconds" dans metadata DOIT refléter la durée totale de l'exercice (entre 600 et 900 secondes).

RÈGLES DE GÉNÉRATION :
- Chaque exercice doit recevoir un champ "metadata" avec : { "code": "CO1", "skill": "Compréhension Orale", "sub_skill": "Identifier situation", "time_limit_seconds": 720 }
- Le code doit correspondre à la compétence et à la sous-compétence les plus pertinentes.
- Contexte : situations réelles de la vie en France (préfecture, CAF, emploi, logement, transport, santé, citoyenneté)
- Public : adultes primo-arrivants, niveau ${niveauVise}
- Formats possibles : qcm, vrai_faux, texte_lacunaire, appariement, transformation, production_ecrite, production_orale
- Langue simple et claire. Chaque exercice doit être ORIGINAL.

CORRECTION AUTOMATIQUE & TOLÉRANCE :
- QCM/CO/CE : correspondance exacte avec bonne_reponse
- EE : L'IA vérifie (1) nombre de mots, (2) mots-clés liés au code, (3) structures grammaticales A1
- EO : HAUTE TOLÉRANCE pour homophones, anomalies phonétiques et erreurs STT. Reconnaître les mots phonétiquement proches (ex: "doctère" → "docteur", "mal e dent" → "mal de dent").

IMPORTANT — Pour CHAQUE exercice, tu dois aussi proposer un "animation_guide" :
- scenario : une mise en situation simple et concrète liée à l'exercice
- jeu : une règle de jeu ludique adaptée au niveau
- materiel : ce qu'il faut préparer
- objectif_oral : la structure de phrase cible
- documentation_fournie : un objet OBLIGATOIRE contenant :
  - guide_formateur : instructions pas-à-pas détaillées pour animer l'activité (étapes numérotées, timing, consignes de gestion de classe)
  - fiches_eleves : tableau de fiches à imprimer pour les élèves. Chaque fiche contient titre_fiche (ex: "Fiche A — Le Client"), contenu_fiche (rôle, mission, vocabulaire imposé, données concrètes — texte complet prêt à distribuer), lexique_cles (5-10 mots/phrases du niveau à utiliser)

IMPORTANT — Pour CHAQUE exercice, tu dois aussi proposer des VARIANTES DE DIFFÉRENCIATION :
- "variante_niveau_bas" : version simplifiée pour les élèves en difficulté. Contient : consigne (reformulée plus simplement, avec aide ou amorce), aide (mot ou phrase de démarrage), nb_items_reduit (nombre d'items réduit, ex: 2).
- "variante_niveau_haut" : version enrichie pour les élèves avancés. Contient : consigne (avec contrainte supplémentaire ou tâche de transfert), extension (question ouverte ou production additionnelle).

Tu DOIS utiliser le tool "generate_exercises" pour retourner le résultat.${gabaritPrompt}`;

    const userPrompt = `Génère ${count} exercices pour :
- Point à maîtriser : "${pointName}"
- Compétence : ${competence}
- Niveau visé : ${niveauVise}
- Difficulté calibrée : ${diffLevel}/10${gabarit ? `\n- Gabarit séance : ${gabarit.titre} (n°${gabarit.numero})` : ""}

Choisis les codes les plus adaptés dans la cartographie (ex: pour CO → CO1/CO2/CO3/CO4, varier les codes).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_exercises",
              description: "Return generated exercises with animation guides and metadata codes",
              parameters: {
                type: "object",
                properties: {
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titre: { type: "string", description: "Titre court de l'exercice" },
                        consigne: { type: "string", description: "Consigne pour l'élève" },
                        format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation", "production_ecrite", "production_orale"] },
                        difficulte: { type: "number", minimum: 0, maximum: 10, description: "Niveau de difficulté sur l'échelle 0-10" },
                        metadata: {
                          type: "object",
                          description: "Métadonnées pédagogiques de l'exercice",
                          properties: {
                            code: { type: "string", description: "Code de l'exercice (CO1, CO2, CE1, EO1, EE1, etc.)" },
                            skill: { type: "string", description: "Compétence (Compréhension Orale, Expression Écrite, etc.)" },
                            sub_skill: { type: "string", description: "Sous-compétence (Identifier situation, Se présenter, etc.)" },
                            time_limit_seconds: { type: "number", description: "Durée maximale en secondes" },
                          },
                          required: ["code", "skill", "sub_skill", "time_limit_seconds"],
                        },
                        contenu: {
                          type: "object",
                          properties: {
                            texte: { type: "string", description: "Texte support / document à lire avant les questions (OBLIGATOIRE pour CE). Doit reproduire fidèlement le document (badge, panneau, courrier, SMS, etc.) avec TOUTES les informations nécessaires pour répondre." },
                            script_audio: { type: "string", description: "Script audio pour CO : texte lu par la synthèse vocale (OBLIGATOIRE pour CO, NE PAS afficher à l'élève)" },
                            image_description: { type: "string", description: "Description de l'image à générer automatiquement (pour EO quand l'exercice demande de décrire une image). Ex: 'Une famille à table en train de manger dans un appartement'. NE PAS mettre d'URL, seulement une description textuelle détaillée de la scène." },
                            type_reponse: { type: "string", enum: ["ecrit", "oral"], description: "Type de réponse attendu (oral pour EO)" },
                            criteres_evaluation: { type: "object", description: "Critères d'évaluation pour les productions orales/écrites" },
                            mots_cles_attendus: {
                              type: "array",
                              items: { type: "string" },
                              description: "Mots-clés que l'élève doit prononcer/écrire pour valider la tâche (EO/EE)",
                            },
                            items: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  question: { type: "string" },
                                  options: { type: "array", items: { type: "string" } },
                                  bonne_reponse: { type: "string" },
                                  explication: { type: "string" },
                                },
                                required: ["question", "bonne_reponse"],
                              },
                            },
                          },
                          required: ["items"],
                        },
                        variante_niveau_bas: {
                          type: "object",
                          description: "Version simplifiée de l'exercice pour les élèves en difficulté",
                          properties: {
                            consigne: { type: "string", description: "Consigne simplifiée avec aide ou amorce fournie" },
                            aide: { type: "string", description: "Mot ou phrase donnée pour démarrer" },
                            nb_items_reduit: { type: "number", description: "Nombre d'items réduit" },
                          },
                          required: ["consigne", "aide", "nb_items_reduit"],
                        },
                        variante_niveau_haut: {
                          type: "object",
                          description: "Version enrichie de l'exercice pour les élèves avancés",
                          properties: {
                            consigne: { type: "string", description: "Consigne avec contrainte supplémentaire ou tâche de transfert" },
                            extension: { type: "string", description: "Question ouverte ou production additionnelle demandée" },
                          },
                          required: ["consigne", "extension"],
                        },
                        animation_guide: {
                          type: "object",
                          description: "Guide d'animation ludique pour le formateur avec matériel imprimable",
                          properties: {
                            scenario: { type: "string", description: "Mise en situation concrète" },
                            jeu: { type: "string", description: "Règle de jeu ludique" },
                            materiel: { type: "string", description: "Matériel à préparer" },
                            objectif_oral: { type: "string", description: "Structure de phrase cible" },
                            documentation_fournie: {
                              type: "object",
                              description: "Matériel pédagogique complet imprimable",
                              properties: {
                                guide_formateur: { type: "string", description: "Instructions pas-à-pas détaillées pour animer l'activité" },
                                fiches_eleves: {
                                  type: "array",
                                  description: "Fiches physiques à distribuer aux élèves",
                                  items: {
                                    type: "object",
                                    properties: {
                                      titre_fiche: { type: "string", description: "Ex: Fiche A — Le Client" },
                                      contenu_fiche: { type: "string", description: "Rôle, mission, vocabulaire imposé, données concrètes" },
                                      lexique_cles: { type: "array", items: { type: "string" }, description: "5-10 mots/phrases à utiliser" },
                                    },
                                    required: ["titre_fiche", "contenu_fiche", "lexique_cles"],
                                  },
                                },
                              },
                              required: ["guide_formateur", "fiches_eleves"],
                            },
                          },
                          required: ["scenario", "jeu", "materiel", "objectif_oral", "documentation_fournie"],
                        },
                      },
                      required: ["titre", "consigne", "format", "difficulte", "metadata", "contenu", "animation_guide", "variante_niveau_bas", "variante_niveau_haut"],
                    },
                  },
                },
                required: ["exercises"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_exercises" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const exercises = JSON.parse(toolCall.function.arguments);

    // Post-processing: fetch photos from Pexels for exercises that have image_description
    const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");

    for (const ex of exercises.exercises || []) {
      const desc = ex.contenu?.image_description;
      if (!desc || typeof desc !== "string" || desc.trim().length === 0) continue;
      if (!PEXELS_API_KEY) {
        console.warn("PEXELS_API_KEY not configured, skipping image search");
        continue;
      }

      try {
        // Search Pexels with the image description as query
        const query = encodeURIComponent(desc.slice(0, 100));
        const pexelsResponse = await fetch(
          `https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape&size=medium`,
          {
            headers: { Authorization: PEXELS_API_KEY },
          }
        );

        if (!pexelsResponse.ok) {
          console.error("Pexels API error:", pexelsResponse.status);
          continue;
        }

        const pexelsData = await pexelsResponse.json();
        const photos = pexelsData.photos;
        if (!photos || photos.length === 0) {
          console.warn("No Pexels results for:", desc.slice(0, 50));
          continue;
        }

        // Pick a random photo from results for variety
        const photo = photos[Math.floor(Math.random() * photos.length)];
        ex.contenu.image_url = photo.src.medium;
        ex.contenu.image_credit = {
          photographer: photo.photographer,
          photographer_url: photo.photographer_url,
          pexels_url: photo.url,
        };
        console.log("Pexels photo found:", photo.src.medium);
      } catch (imgErr) {
        console.error("Pexels search error for exercise:", imgErr);
      }
    }

    return new Response(JSON.stringify(exercises), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exercises error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
