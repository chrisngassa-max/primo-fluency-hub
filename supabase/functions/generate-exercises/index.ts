import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODEL } from "../_shared/system-prompt.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pointName, competence, niveauVise, count = 10, difficultyLevel, gabaritNumero, type_demarche, niveau_depart, niveau_arrivee, groupId, existingExercises } = await req.json();
    const demarche = type_demarche || "titre_sejour";
    const epreuvesAutorisees = demarche === "naturalisation" ? "CO, CE, EE, EO" : "CO, CE";
    // AI key check moved to shared ai-client

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If gabaritNumero provided, load gabarit from DB
    let gabarit: any = null;
    if (gabaritNumero != null) {
      const { data, error } = await supabase
        .from("gabarits_pedagogiques")
        .select("*")
        .eq("numero", gabaritNumero)
        .maybeSingle();
      if (error) console.error("Error loading gabarit:", error);
      gabarit = data;
    }

    // ═══ ENRICHISSEMENT : Récupérer et scorer des références pédagogiques ═══
    const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2"];
    const TOP_N = 10;
    let referencesUtilisees: any[] = [];
    let referenceScores: any[] = [];
    let selectionMetadata: any = { competence_cible: competence || null, niveau_cible: niveauVise || null, theme_normalise: pointName || null, nb_candidates: 0, nb_retenues: 0 };
    let pedagogicalWarnings: string[] = [];
    let referencesPrompt = "";

    const levelIndex = (l: string | null) => l ? LEVEL_ORDER.indexOf(l) : -1;
    const levelDistance = (a: string | null, b: string | null) => {
      const ia = levelIndex(a), ib = levelIndex(b);
      if (ia < 0 || ib < 0) return 2; // unknown = moderate penalty
      return Math.abs(ia - ib);
    };

    try {
      // Pre-compute theme tokens for potential supplementary query
      const IRN_SYNONYMS: Record<string, string[]> = {
        "préfecture": ["sous-préfecture", "guichet", "administration", "rendez-vous préfecture", "dossier préfecture", "rendez-vous", "dossier", "formulaire", "accueil", "demande", "démarche", "guichet unique"],
        "titre de séjour": ["carte de séjour", "récépissé", "autorisation de séjour", "renouvellement titre", "premier titre", "titre séjour", "demande séjour"],
        "ofii": ["contrat d'intégration", "cir", "parcours d'intégration", "office français"],
        "caf": ["allocation", "aide au logement", "apl", "prime d'activité", "caisse d'allocations"],
        "cpam": ["sécurité sociale", "carte vitale", "assurance maladie", "remboursement", "médecin traitant"],
        "médical": ["santé", "docteur", "médecin", "hôpital", "pharmacie", "ordonnance", "consultation", "urgences"],
        "logement": ["bail", "loyer", "appartement", "hlm", "hébergement", "propriétaire", "locataire", "état des lieux"],
        "transport": ["bus", "métro", "train", "ticket", "abonnement", "navigo", "gare", "trajet", "itinéraire"],
        "emploi": ["travail", "cv", "lettre de motivation", "pôle emploi", "france travail", "contrat", "salaire", "embauche", "entretien"],
        "citoyenneté": ["nationalité", "naturalisation", "droits", "devoirs", "élections", "république", "valeurs"],
        "école": ["inscription scolaire", "cantine", "périscolaire", "bulletin", "professeur", "rentrée"],
        "banque": ["compte bancaire", "rib", "virement", "carte bancaire", "retrait", "guichet automatique"],
      };
      const expandTokens = (input: string): string[] => {
        const base = input.toLowerCase().split(/[\s,;]+/).filter((t: string) => t.length > 2);
        const expanded = new Set(base);
        for (const [key, syns] of Object.entries(IRN_SYNONYMS)) {
          const allTerms = [key, ...syns];
          const inputLower = input.toLowerCase();
          if (allTerms.some(t => inputLower.includes(t))) {
            allTerms.forEach(s => s.split(/[\s,;]+/).filter(w => w.length > 2).forEach(w => expanded.add(w)));
          }
        }
        return [...expanded];
      };

      // Fetch a broader set for scoring (up to 50)
      let query = supabase
        .from("pedagogical_activities")
        .select("id, title, category, level_min, level_max, objective, instructions, tags, format, competence")
        .eq("is_active", true)
        .limit(50);

      // Broad competence filter: include matching + null
      if (competence) {
        const compMap: Record<string, string> = { CO: "compréhension orale", CE: "compréhension écrite", EE: "expression écrite", EO: "expression orale" };
        const compLabel = compMap[competence];
        if (compLabel) {
          query = query.or(`competence.eq.${competence},competence.ilike.%${compLabel}%,competence.is.null`);
        } else {
          query = query.or(`competence.eq.${competence},competence.is.null`);
        }
      }

      let { data: activities, error: actError } = await query;
      if (actError) {
        console.error("Error loading pedagogical_activities:", actError);
      }

      // Supplementary cross-competence query when theme tokens exist but primary set lacks meaningful theme matches
      const themeTokensGlobal = expandTokens(pointName || "");
      // Use only "core" tokens (from original input, not expanded synonyms) to test meaningful match
      const coreTokens = (pointName || "").toLowerCase().split(/[\s,;]+/).filter((t: string) => t.length > 2);
      if (activities && activities.length > 0 && coreTokens.length > 0) {
        const meaningfulMatchCount = activities.filter((a: any) => {
          const searchable = `${a.title} ${a.category || ""} ${(a.tags || []).join(" ")} ${a.objective || ""} ${a.instructions || ""}`.toLowerCase();
          return coreTokens.some((t: string) => searchable.includes(t));
        }).length;
        if (meaningfulMatchCount < 3) {
          // Fetch 20 cross-competence activities (theme-oriented, any competence)
          const { data: crossActivities } = await supabase
            .from("pedagogical_activities")
            .select("id, title, category, level_min, level_max, objective, instructions, tags, format, competence")
            .eq("is_active", true)
            .limit(30);
          if (crossActivities) {
            const existingIds = new Set(activities.map((a: any) => a.id));
            const newOnes = crossActivities.filter((a: any) => !existingIds.has(a.id));
            activities = [...activities, ...newOnes];
            console.log(JSON.stringify({ event: "cross_competence_supplement", added: newOnes.length }));
          }
        }
      }

      if (activities && activities.length > 0) {
        selectionMetadata.nb_candidates = activities.length;

        // Score each activity
        const scored = activities.map((a: any) => {
          let score = 0;
          const reasons: string[] = [];

          // 1. Competence match (0-40 pts)
          const compCode = a.competence;
          const compCat = (a.category || "").toLowerCase();
          const compMap: Record<string, string> = { CO: "compréhension orale", CE: "compréhension écrite", EE: "expression écrite", EO: "expression orale" };
          const targetLabel = competence ? (compMap[competence] || "") : "";
          if (competence && compCode === competence) {
            score += 40; reasons.push("competence_exacte");
          } else if (competence && targetLabel && compCat.includes(targetLabel)) {
            score += 35; reasons.push("competence_categorie");
          } else if (!compCode) {
            score += 10; reasons.push("competence_generique");
          } else {
            score += 0; reasons.push("competence_differente");
          }

          // 2. Level proximity (0-30 pts)
          if (niveauVise) {
            const distMin = levelDistance(a.level_min, niveauVise);
            const distMax = levelDistance(a.level_max, niveauVise);
            const minDist = Math.min(distMin, distMax);
            const levelScore = Math.max(0, 30 - minDist * 10);
            score += levelScore;
            if (levelScore >= 20) reasons.push("niveau_proche");
            else if (levelScore > 0) reasons.push("niveau_acceptable");
            else reasons.push("niveau_eloigne");
          } else {
            score += 15; // no level specified = neutral
          }

          // 3. Theme match via tags/title + IRN synonyms (0-20 pts)
          const themeTokens = expandTokens(pointName || "");
          if (themeTokens.length > 0) {
            const searchable = `${a.title} ${a.category || ""} ${(a.tags || []).join(" ")} ${a.objective || ""} ${a.instructions || ""}`.toLowerCase();
            const matches = themeTokens.filter((t: string) => searchable.includes(t)).length;
            const themeScore = Math.min(20, Math.round((matches / themeTokens.length) * 20));
            score += themeScore;
            if (themeScore > 0) reasons.push("theme_match");
          }

          // 4. Quality bonus (0-10 pts)
          if (a.objective && a.objective.length > 10) { score += 5; reasons.push("objectif_present"); }
          if (a.instructions && a.instructions.length > 20) { score += 5; reasons.push("consigne_exploitable"); }

          return { ...a, _score: score, _reasons: reasons };
        });

        // Sort by score desc, take top N
        scored.sort((a: any, b: any) => b._score - a._score);
        const topRefs = scored.slice(0, TOP_N);
        selectionMetadata.nb_retenues = topRefs.length;

        // Build reference scores array
        referenceScores = topRefs.map((a: any) => ({
          id: a.id,
          score: a._score,
          reasons: a._reasons,
        }));

        referencesUtilisees = topRefs.map((a: any) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          level_min: a.level_min,
          level_max: a.level_max,
          objective: a.objective,
          format: a.format,
          score: a._score,
        }));

        // ═══ CECR/TCF coherence checks ═══
        if (niveauVise && topRefs.length > 0) {
          const avgLevelIdx = topRefs.reduce((sum: number, r: any) => {
            const idx = levelIndex(r.level_min);
            return sum + (idx >= 0 ? idx : levelIndex(niveauVise));
          }, 0) / topRefs.length;
          const targetIdx = levelIndex(niveauVise);
          if (targetIdx >= 0 && Math.abs(avgLevelIdx - targetIdx) > 1.5) {
            pedagogicalWarnings.push(`Écart de niveau : les références sont en moyenne ${LEVEL_ORDER[Math.round(avgLevelIdx)] || "?"} alors que le niveau cible est ${niveauVise}.`);
          }
        }

        if (competence && topRefs.length > 0) {
          const compMatchCount = topRefs.filter((r: any) => {
            const compMap: Record<string, string> = { CO: "compréhension orale", CE: "compréhension écrite", EE: "expression écrite", EO: "expression orale" };
            return r.competence === competence || (r.category || "").toLowerCase().includes(compMap[competence] || "___");
          }).length;
          if (compMatchCount < topRefs.length * 0.5) {
            pedagogicalWarnings.push(`Moins de 50% des références correspondent à la compétence ${competence}. Résultats potentiellement moins ciblés.`);
          }
        }

        // Structured observability logs
        const scores = topRefs.map((r: any) => r._score);
        const noRefMatch = topRefs.length === 0 || Math.max(...scores) < 30;
        const themeMatchCount = topRefs.filter((r: any) => r._reasons.includes("theme_match")).length;
        console.log(JSON.stringify({
          event: "reference_selection",
          competence_cible: competence,
          niveau_cible: niveauVise,
          theme: pointName || null,
          candidates: activities.length,
          retained: topRefs.length,
          score_min: Math.min(...scores),
          score_max: Math.max(...scores),
          score_avg: Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length),
          theme_match_count: themeMatchCount,
          no_reference_match: noRefMatch,
          warnings_count: pedagogicalWarnings.length,
          warnings: pedagogicalWarnings,
        }));

        const refTexts = topRefs.map((a: any, i: number) => {
          const parts = [`${i + 1}. [score:${a._score}] "${a.title}"`];
          if (a.category) parts.push(`Catégorie : ${a.category}`);
          if (a.objective) parts.push(`Objectif : ${a.objective}`);
          if (a.level_min || a.level_max) parts.push(`Niveau : ${a.level_min || "?"} → ${a.level_max || "?"}`);
          if (a.instructions) parts.push(`Instructions : ${a.instructions.slice(0, 200)}`);
          if (a.tags && Array.isArray(a.tags) && a.tags.length > 0) parts.push(`Tags : ${a.tags.join(", ")}`);
          return parts.join(" | ");
        });

        referencesPrompt = `

═══ RÉFÉRENCES PÉDAGOGIQUES DE LA BANQUE D'ACTIVITÉS ═══
Voici ${topRefs.length} activité(s) pertinente(s) issues de la banque pédagogique (triées par pertinence).
INSPIRE-TOI de ces références pour calibrer la difficulté, les thèmes et les formats.
Tu n'es PAS obligé de les reproduire exactement, mais elles doivent guider ta génération.

${refTexts.join("\n")}
═══════════════════════════════════════════════════════════`;
      } else {
        console.log(JSON.stringify({ event: "reference_selection", competence_cible: competence, niveau_cible: niveauVise, theme: pointName || null, candidates: 0, retained: 0, no_reference_match: true, warnings_count: 0, fallback: true }));
      }
    } catch (refErr) {
      console.error("Error fetching pedagogical references:", refErr);
    }

    // === ENRICHISSEMENT : Récupérer les données élèves si groupId fourni ===
    let studentContextPrompt = "";
    if (groupId) {
      try {
        // 1. Membres du groupe
        const { data: members } = await supabase
          .from("group_members")
          .select("eleve_id, profiles:profiles(nom, prenom)")
          .eq("group_id", groupId);

        if (members?.length) {
          const eleveIds = members.map((m: any) => m.eleve_id);

          // 2. Résultats récents (15 derniers par élève)
          const { data: resultats } = await supabase
            .from("resultats")
            .select("eleve_id, score, correction_detaillee, created_at, exercice:exercices(competence, format, titre, sous_competence)")
            .in("eleve_id", eleveIds)
            .order("created_at", { ascending: false })
            .limit(eleveIds.length * 15);

          // 3. Profils élèves (taux de réussite)
          const { data: profils } = await supabase
            .from("profils_eleves")
            .select("eleve_id, niveau_actuel, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures, priorites_pedagogiques")
            .in("eleve_id", eleveIds);

          // 4. Tests de positionnement
          const { data: testSessions } = await supabase
            .from("test_sessions")
            .select("apprenant_id, score_co, score_ce, score_ee, score_eo, palier_co, palier_ce, palier_ee, palier_eo, profil_final, statut")
            .in("apprenant_id", eleveIds)
            .eq("statut", "termine");

          // 5. Niveaux de compétence validés
          const { data: compLevels } = await supabase
            .from("student_competency_levels")
            .select("eleve_id, competence, niveau_actuel")
            .in("eleve_id", eleveIds);

          // Construire le contexte par élève
          const studentProfiles = members.map((m: any) => {
            const id = m.eleve_id;
            const nom = `${m.profiles?.prenom || ""} ${m.profiles?.nom || ""}`.trim() || "Anonyme";
            const profil = profils?.find((p: any) => p.eleve_id === id);
            const test = testSessions?.find((t: any) => t.apprenant_id === id);
            const results = (resultats || []).filter((r: any) => r.eleve_id === id);
            const levels = (compLevels || []).filter((l: any) => l.eleve_id === id);

            const recentErrors = results
              .filter((r: any) => r.score < 60)
              .slice(0, 5)
              .map((r: any) => `${r.exercice?.competence}/${r.exercice?.sous_competence}: ${r.score}%`);

            return {
              nom,
              niveau: profil?.niveau_actuel || "A0",
              taux: profil ? { CO: profil.taux_reussite_co, CE: profil.taux_reussite_ce, EE: profil.taux_reussite_ee, EO: profil.taux_reussite_eo, Structures: profil.taux_reussite_structures } : null,
              test_positionnement: test ? { CO: test.score_co, CE: test.score_ce, EE: test.score_ee, EO: test.score_eo, profil: test.profil_final } : null,
              niveaux_competences: levels.reduce((acc: any, l: any) => { acc[l.competence] = l.niveau_actuel; return acc; }, {}),
              erreurs_recentes: recentErrors,
              priorites: profil?.priorites_pedagogiques || [],
            };
          });

          studentContextPrompt = `

═══ PROFILS DES APPRENANTS DU GROUPE ═══
Les exercices DOIVENT être calibrés pour ce groupe. Adapte la difficulté, les thèmes et les pièges en fonction de leurs lacunes réelles.

${JSON.stringify(studentProfiles, null, 2)}

RÈGLES D'ADAPTATION :
- Si un élève a un taux < 50% sur une compétence, inclure des exercices de remédiation ciblée
- Si des erreurs récurrentes apparaissent (ex: confusion chiffres, dates), créer des pièges similaires avec feedback
- Varier les contextes IRN en fonction des priorités pédagogiques identifiées
- Respecter le niveau moyen du groupe tout en proposant des variantes (niveau_bas / niveau_haut)
═══════════════════════════════════════════`;
        }
      } catch (ctxErr) {
        console.error("Error fetching student context:", ctxErr);
      }
    }

    // Determine difficulty range description
    const diffLevel = difficultyLevel ?? 5;
    let difficultyDescription = "";
    if (diffLevel <= 2) {
      difficultyDescription = `Niveau de difficulté ${diffLevel}/10 — LITTÉRATIE/ALPHA : reconnaissance de lettres, sons de base, chiffres simples, vocabulaire ultra-basique (bonjour, merci, oui/non). Questions très courtes avec support visuel.
  Niveau A0 (difficulté 1-2/10) :
  - Consignes en 1 mot si possible : "Choisissez.", "Écoutez.", "Regardez."
  - Accompagner chaque consigne d'une icône ou emoji explicatif
  - Questions de 5 mots maximum
  - Options de réponse : maximum 3 mots`;
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


═══════════════════════════════════════════════════
RÈGLES ABSOLUES SUR LA LANGUE — PUBLIC A0/A1 ALLOPHONE
Ces règles s'appliquent à TOUS les textes générés sans exception.
═══════════════════════════════════════════════════

CONSIGNES (instructions données à l'élève) :
✅ Maximum 12 mots par consigne
✅ Structure imposée : Verbe à l'impératif + complément court
✅ Valide : "Écoutez et choisissez.", "Lisez et répondez.", "Regardez l'image."
✅ Valide : "Choisissez la bonne réponse.", "Cochez vrai ou faux."
❌ Interdit : subordonnées relatives ou causales
❌ Interdit : double négation ("ne... pas... sans...")
❌ Interdit : plus de 2 actions dans une même consigne
❌ Interdit : "En vous appuyant sur...", "Après avoir lu...", "En tenant compte de..."

QUESTIONS ET ITEMS :
✅ Phrases courtes : Sujet + Verbe + Complément
✅ Vocabulaire du quotidien : les mots utilisés dans la vie réelle A0
✅ Maximum 20 mots par question
❌ Interdit : vocabulaire abstrait (intégration, démarche administrative complexe...)
❌ Interdit : phrases imbriquées

OPTIONS DE RÉPONSE QCM :
✅ Maximum 6 mots par option
✅ Cohérentes entre elles (même type grammatical)
✅ Les 3 options doivent être plausibles (pas d'option absurde évidente)

EXPLICATIONS (feedback après erreur) :
✅ Maximum 20 mots
✅ Structure : "La bonne réponse est [X] parce que [raison courte]."
✅ Exemple : "La bonne réponse est 'lundi' parce que le texte dit 'cours le lundi'."
❌ Interdit : explications grammaticales techniques pour A0

AVANT de finaliser ta réponse, vérifie chaque consigne générée :
- Compte les mots → si > 12, reformule
- Vérifie la structure impérative → sinon, reformule
- Vérifie qu'il n'y a qu'une seule action demandée → sinon, coupe en 2

Tu DOIS utiliser le tool "generate_exercises" pour retourner le résultat.

═══════════════════════════════════════════════
THÈME STRICT (si pointName fourni) :
═══════════════════════════════════════════════
Si un "pointName" est passé en paramètre, c'est un THÈME CIBLÉ choisi
par le formateur pour un besoin pédagogique précis. Dans ce cas :
1. TOUS les exercices générés DOIVENT porter sur ce thème EXACT
2. AUCUNE dérive thématique autorisée
3. Le vocabulaire, les situations, les personnages doivent refléter ce thème
4. Si le thème est spécifique (ex: "Prendre un RDV à la préfecture"),
   génère des situations précises : prendre le ticket, attendre son tour,
   présenter son dossier, reprendre un second RDV, etc.
═══════════════════════════════════════════════${gabaritPrompt}`;

    // ═══ Anti-redundancy context ═══
    let antiRedundancyPrompt = "";
    if (existingExercises && Array.isArray(existingExercises) && existingExercises.length > 0) {
      const usedContexts = existingExercises.map((e: any) => e.contexte_irn).filter(Boolean);
      const usedFormats = existingExercises.map((e: any) => e.format).filter(Boolean);
      const usedTitles = existingExercises.map((e: any) => e.titre).filter(Boolean);
      const usedCodes = existingExercises.map((e: any) => e.metadata?.code).filter(Boolean);

      antiRedundancyPrompt = `

═══ ANTI-REDONDANCE — EXERCICES DÉJÀ PRÉVUS DANS CETTE SÉANCE ═══
La séance contient déjà ${existingExercises.length} exercice(s). Tu DOIS éviter toute redondance.

Titres existants : ${usedTitles.join(" | ") || "aucun"}
Codes TCF utilisés : ${usedCodes.join(", ") || "aucun"}
Formats déjà utilisés : ${[...new Set(usedFormats)].join(", ") || "aucun"}
Contextes IRN déjà utilisés : ${[...new Set(usedContexts)].join(", ") || "aucun"}

RÈGLES ANTI-REDONDANCE STRICTES :
1. NE RÉUTILISE PAS les mêmes contextes IRN — choisis parmi : Préfecture, Titre de séjour, Emploi, CAF, Médical, Logement, Transport, Citoyenneté, Commerce
2. VARIE les formats d'exercice pour une même compétence (si QCM existe déjà, privilégie appariement, texte_lacunaire, vrai_faux, etc.)
3. VARIE les codes TCF (si CO1 existe, utilise CO2/CO3/CO4)
4. NE RÉPÈTE PAS les mêmes thèmes, supports textuels ou situations
5. Chaque exercice doit apporter un contexte de vie quotidienne DIFFÉRENT
═══════════════════════════════════════════════════════════════════`;
    }

    const userPrompt = `Génère ${count} exercices pour :
- Point à maîtriser : "${pointName}"
- Compétence : ${competence}
- Niveau visé : ${niveauVise}
- Difficulté calibrée : ${diffLevel}/10${gabarit ? `\n- Gabarit séance : ${gabarit.titre} (n°${gabarit.numero})` : ""}
${studentContextPrompt}${antiRedundancyPrompt}${referencesPrompt}
Choisis les codes les plus adaptés dans la cartographie (ex: pour CO → CO1/CO2/CO3/CO4, varier les codes).`;

    const data = await callAI({
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
                          texte: { type: "string", description: "Texte support / document à lire avant les questions (OBLIGATOIRE pour CE)." },
                          script_audio: { type: "string", description: "Script audio pour CO (OBLIGATOIRE pour CO)" },
                          image_description: { type: "string", description: "Description de l'image à générer automatiquement (pour EO)" },
                          type_reponse: { type: "string", enum: ["ecrit", "oral"] },
                          criteres_evaluation: { type: "object", description: "Critères d'évaluation pour les productions orales/écrites" },
                          mots_cles_attendus: { type: "array", items: { type: "string" } },
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
                        properties: {
                          consigne: { type: "string" },
                          aide: { type: "string" },
                          nb_items_reduit: { type: "number" },
                        },
                        required: ["consigne", "aide", "nb_items_reduit"],
                      },
                      variante_niveau_haut: {
                        type: "object",
                        properties: {
                          consigne: { type: "string" },
                          extension: { type: "string" },
                        },
                        required: ["consigne", "extension"],
                      },
                      animation_guide: {
                        type: "object",
                        properties: {
                          scenario: { type: "string" },
                          jeu: { type: "string" },
                          materiel: { type: "string" },
                          objectif_oral: { type: "string" },
                          documentation_fournie: {
                            type: "object",
                            properties: {
                              guide_formateur: { type: "string" },
                              fiches_eleves: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    titre_fiche: { type: "string" },
                                    contenu_fiche: { type: "string" },
                                    lexique_cles: { type: "array", items: { type: "string" } },
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
    });

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

    // Attach references, scores, metadata, and warnings to the response
    const responsePayload = {
      ...exercises,
      references_utilisees: referencesUtilisees,
      reference_scores: referenceScores,
      selection_metadata: selectionMetadata,
      ...(pedagogicalWarnings.length > 0 ? { pedagogical_warnings: pedagogicalWarnings } : {}),
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-exercises error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
