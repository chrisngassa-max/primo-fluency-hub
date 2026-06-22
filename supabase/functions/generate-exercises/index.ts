import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODEL } from "../_shared/system-prompt.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { validateAndFix } from "../_shared/exercise-validator.ts";
import { QA_REVIEW_BLOCK } from "../_shared/qa-prompt.ts";
import { buildPedagogicalDirectives, formatPedagogicalDirectives } from "../_shared/pedagogical-directives.ts";
import type { PedagogicalDirectives } from "../_shared/pedagogical-directives.ts";
import { hasBlockingReviewIssue, reviewExercise } from "../_shared/review-exercise.ts";
import type { ExerciseReviewIssue, ExerciseReviewResult } from "../_shared/review-exercise.ts";
import { ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";
import { buildDurationPrompt, buildFallbackExercise, buildFocusPrompt, parseTargetDurationMinutes } from "./logic.ts";
import {
  findReusableExercises,
  scoreGeneratedExercise,
  GENERATE_SCORE_MIN,
  REUSE_SCORE_MIN,
} from "../_shared/exercise-search.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Schéma du tool de génération — partagé entre l'appel initial et la régénération QA.
const EXERCISES_TOOL = [
  {
    type: "function" as const,
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
                    aides_disponibles: {
                      type: "array",
                      items: { type: "string" },
                      description: "Aides autorisées : lexique, indice, exemple ou transcription",
                    },
                    nombre_ecoutes_max: {
                      type: "number",
                      minimum: 1,
                      maximum: 10,
                      description: "Nombre maximal d'écoutes pour un exercice audio",
                    },
                    transcription_verrouillee: { type: "boolean" },
                    objectif_tcf: {
                      type: "string",
                      description: "Objectif pédagogique précis, par exemple comprendre_info_explicite",
                    },
                    type_differenciation: {
                      type: "string",
                      enum: ["demarrage", "remediation", "consolidation", "approfondissement", "bonus"],
                    },
                  },
                  required: [
                    "code", "skill", "sub_skill", "time_limit_seconds", "aides_disponibles",
                    "transcription_verrouillee", "objectif_tcf", "type_differenciation"
                  ],
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
];

/**
 * Régénère UN exercice rejeté par la QA pédagogique en réinjectant les motifs de
 * rejet et les directives, pour que l'IA corrige plutôt que de reproduire l'erreur.
 * Retourne l'ébauche corrigée (objet exercice brut) ou null si l'appel IA échoue.
 */
async function regenerateExerciseForQA(params: {
  systemPrompt: string;
  rejected: Record<string, unknown>;
  issues: ExerciseReviewIssue[];
  directives: PedagogicalDirectives;
  competence: string;
  niveauVise: string;
  diffLevel: number;
}): Promise<Record<string, unknown> | null> {
  const issuesText = params.issues.length
    ? params.issues
        .map((i) => `- [${i.code}] ${i.message}${i.correction ? ` → CORRECTION ATTENDUE : ${i.correction}` : ""}`)
        .join("\n")
    : "- (motif non détaillé) l'exercice n'a pas passé la revue pédagogique.";
  const directivesText = formatPedagogicalDirectives(params.directives);

  try {
    const data = await callAI({
      model: MODEL,
      messages: [
        { role: "system", content: params.systemPrompt + QA_REVIEW_BLOCK },
        {
          role: "user",
          content: `Ta tentative précédente a été REJETÉE par la passerelle QA pédagogique. Tu dois régénérer UN SEUL exercice corrigé et conforme.

EXERCICE REJETÉ :
${JSON.stringify(params.rejected, null, 2)}

MOTIFS DE REJET QA (tu DOIS TOUS les corriger, sans exception) :
${issuesText}

${directivesText}

CONTRAINTES IMPÉRATIVES POUR LA CORRECTION :
- Compétence : ${params.competence} | Niveau visé : ${params.niveauVise} | Difficulté : ${params.diffLevel}/10.
- Respecte STRICTEMENT formats_autorises ci-dessus et n'utilise JAMAIS un format listé dans formats_interdits.
- S'il existe une règle de descente de compétence (descente_competence), NE DEMANDE PLUS de production écrite/orale libre : utilise impérativement qcm, vrai_faux, appariement, texte_lacunaire ou transformation simple, avec étayage (banque de mots, exemple résolu, support audio/image).
- Respecte la longueur max de consigne et le nombre max d'items indiqués dans les directives.
- Retourne EXACTEMENT 1 exercice via le tool generate_exercises.`,
        },
      ],
      tools: EXERCISES_TOOL,
      tool_choice: { type: "function", function: { name: "generate_exercises" } },
    });

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed?.exercises?.[0] ?? null;
  } catch (e) {
    console.error("[generate-exercises] regenerateExerciseForQA failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const _triggeredBy = await getUserIdFromAuth(req);
    const _secretBlock = await ensurePseudonymSecretOrLog("generate-exercises", corsHeaders, null);
    if (_secretBlock) return _secretBlock;
    await logAICall({ function_name: "generate-exercises", triggered_by_user_id: _triggeredBy, status: "ok", data_categories: [], pseudonymization_level: "none" });
    const { pointName, competence, niveauVise, count: requestedCount = 10, difficultyLevel, targetDurationMinutes, gabaritNumero, type_demarche, niveau_depart, niveau_arrivee, groupId, existingExercises, focus_pedagogique, themeId, eleveIds: eleveIdsParam, excludeExerciceIds, reuseScoreMin, freshnessWindowDays, searchFirst } = await req.json();
    const count = Math.min(30, Math.max(1, Math.round(Number(requestedCount) || 1)));
    const demarche = type_demarche || "titre_sejour";
    // Le moteur search-first est actif par défaut ; on peut le désactiver (searchFirst === false).
    const useSearchFirst = searchFirst !== false;
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
    const selectionMetadata: any = { competence_cible: competence || null, niveau_cible: niveauVise || null, theme_normalise: pointName || null, nb_candidates: 0, nb_retenues: 0 };
    const pedagogicalWarnings: string[] = [];
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

      const queryRes = await query;
      let activities = queryRes.data;
      const actError = queryRes.error;
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
    const groupReviewDirectives: any[] = [];
    // Élèves concernés (pour le croisement de fraîcheur du search-first).
    let eleveIdsForFreshness: string[] = Array.isArray(eleveIdsParam) ? eleveIdsParam : [];
    if (groupId) {
      try {
        // 1. Membres du groupe
        const { data: members } = await supabase
          .from("group_members")
          .select("eleve_id, profiles:profiles(nom, prenom)")
          .eq("group_id", groupId);

        if (members?.length) {
          const eleveIds = members.map((m: any) => m.eleve_id);
          if (eleveIdsForFreshness.length === 0) eleveIdsForFreshness = eleveIds;

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
            .select("eleve_id, niveau_actuel, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures, priorites_pedagogiques, vitesse_lecture, langue_maternelle, autres_langues, niveau_scolarisation, aisance_numerique, projet_personnel, objectif_tcf, date_cible_tcf, preferences_apprentissage, besoins_accessibilite, disponibilite_hors_seance")
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
            const pedagogicalDirectives = buildPedagogicalDirectives({
              profile: profil,
              weakCompetences: recentErrors.map((error: string) => error.split("/")[0]),
              targetCompetence: competence,
            });
            groupReviewDirectives.push(pedagogicalDirectives);

            return {
              nom,
              niveau: profil?.niveau_actuel || "A0",
              taux: profil ? { CO: profil.taux_reussite_co, CE: profil.taux_reussite_ce, EE: profil.taux_reussite_ee, EO: profil.taux_reussite_eo, Structures: profil.taux_reussite_structures } : null,
              test_positionnement: test ? { CO: test.score_co, CE: test.score_ce, EE: test.score_ee, EO: test.score_eo, profil: test.profil_final } : null,
              niveaux_competences: levels.reduce((acc: any, l: any) => { acc[l.competence] = l.niveau_actuel; return acc; }, {}),
              erreurs_recentes: recentErrors,
              priorites: profil?.priorites_pedagogiques || [],
              langue_maternelle: profil?.langue_maternelle || null,
              autres_langues: profil?.autres_langues || [],
              niveau_scolarisation: profil?.niveau_scolarisation || null,
              aisance_numerique: profil?.aisance_numerique || null,
              projet_personnel: profil?.projet_personnel || null,
              objectif_tcf: profil?.objectif_tcf || null,
              date_cible_tcf: profil?.date_cible_tcf || null,
              preferences_apprentissage: profil?.preferences_apprentissage || [],
              besoins_accessibilite: profil?.besoins_accessibilite || [],
              disponibilite_hors_seance: profil?.disponibilite_hors_seance || null,
              directives_pedagogiques: pedagogicalDirectives,
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
- Les champs directives_pedagogiques sont contraignants: respecte formats_autorises, formats_interdits, supports_obligatoires, limites consigne/items et feedback_type
- Si une directive contient descente_competence, la variante_niveau_bas doit redescendre vers competence_cible au lieu de demander une production libre
- Si aisance_numerique vaut faible, utilise seulement des interactions simples: QCM, vrai/faux ou reponse orale.
- Utilise contexte_prioritaire pour ancrer les situations dans le projet personnel, sans exposer de donnee sensible.
- Adapte les situations au champ objectif_tcf lorsqu'il est renseigne.
═══════════════════════════════════════════`;
        }
      } catch (ctxErr) {
        console.error("Error fetching student context:", ctxErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SEARCH-FIRST : chercher d'abord dans la banque `exercices` et ne
    // générer par IA que le complément. Juge unique = scoreExerciseCandidate.
    // ═══════════════════════════════════════════════════════════════════
    let reusedExercises: any[] = [];
    let searchReport: any = null;
    if (useSearchFirst && competence) {
      try {
        const search = await findReusableExercises(supabase, {
          competence,
          niveauVise: niveauVise || "A1",
          count,
          typeDemarche: demarche,
          themeId: themeId ?? null,
          eleveIds: eleveIdsForFreshness,
          excludeExerciceIds: Array.isArray(excludeExerciceIds) ? excludeExerciceIds : [],
          reuseScoreMin: typeof reuseScoreMin === "number" ? reuseScoreMin : undefined,
          freshnessWindowDays: typeof freshnessWindowDays === "number" ? freshnessWindowDays : undefined,
        });
        reusedExercises = search.reusable.map((c) => ({
          id: c.id,
          source: "banque",
          score: c.score,
          titre: c.titre,
          competence: c.competence,
          format: c.format,
          niveau_vise: c.niveau_vise,
          difficulte: c.difficulte,
          matched_rules: c.matchedRules,
          recent_occurrences: c.recentOccurrences,
        }));
        searchReport = search.report;
        console.log(JSON.stringify({ event: "search_first", competence, niveauVise, ...search.report }));
      } catch (searchErr) {
        console.error("[generate-exercises] search-first failed, full generation fallback:", searchErr);
      }
    }
    // Nombre d'exercices restant à GÉNÉRER après réutilisation depuis la banque.
    const generationCount = Math.max(0, count - reusedExercises.length);

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

    const focusPrompt = buildFocusPrompt(competence, focus_pedagogique);
    const durationPrompt = buildDurationPrompt(parseTargetDurationMinutes(targetDurationMinutes));

    const systemPrompt = `Tu es un expert en FLE (Français Langue Étrangère) spécialisé dans la préparation au TCF IRN (Intégration et Résidence en France).
Tu dois générer exactement ${generationCount} exercices pour le point à maîtriser suivant.
${focusPrompt}

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

${durationPrompt}

Repères pour adapter le nombre d'items :
- CO : environ 45 secondes par item.
- CE : environ 80 secondes par item.
- Structures : environ 90 secondes par item.
- EE : environ 5 à 10 minutes par tâche.
- EO : environ 3 à 5 minutes par tâche.

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
- Si les profils du groupe contiennent directives_pedagogiques, construis la variante_niveau_bas pour les etayages forts: banque de mots, image/audio, peu d'items, feedback phonologique ou structurel.
- Si competence_cible vaut Structures apres une faiblesse EE, evite la redaction libre dans la variante_niveau_bas: propose texte_lacunaire, appariement ou transformation simple.
- Si vitesse_lecture vaut lente, evite les textes longs et reduis la consigne au maximum indique.


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

    const userPrompt = `Génère ${generationCount} exercices pour :
- Point à maîtriser : "${pointName}"
- Compétence : ${competence}
- Niveau visé : ${niveauVise}
- Difficulté calibrée : ${diffLevel}/10${gabarit ? `\n- Gabarit séance : ${gabarit.titre} (n°${gabarit.numero})` : ""}
${studentContextPrompt}${antiRedundancyPrompt}${referencesPrompt}
Choisis les codes les plus adaptés dans la cartographie (ex: pour CO → CO1/CO2/CO3/CO4, varier les codes).`;

    // On n'appelle l'IA que s'il reste des exercices à générer (la banque a pu
    // tout fournir via le search-first).
    const exercises: any = { exercises: [] };
    if (generationCount > 0) {
      const data = await callAI({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt + QA_REVIEW_BLOCK },
          { role: "user", content: userPrompt },
        ],
        tools: EXERCISES_TOOL,
        tool_choice: { type: "function", function: { name: "generate_exercises" } },
      });

      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No tool call in AI response");

      const parsed = JSON.parse(toolCall.function.arguments);
      exercises.exercises = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
    }

    const defaultReviewDirective = buildPedagogicalDirectives({
      targetCompetence: competence,
    });
    const reviewDirective = groupReviewDirectives.find((d: any) => d?.niveau_etayage === "fort")
      ?? groupReviewDirectives[0]
      ?? defaultReviewDirective;

    // ── Validation + relecture pédagogique + régénération QA + filet de sécurité ──
    // Objectif : garantir TOUJOURS `count` exercices non vides, même quand l'IA
    // échoue la passerelle QA au premier coup (ex: descente de compétence EE faible).
    const QA_MAX_RETRIES = 2; // jusqu'à 2 régénérations après la 1re passe = 3 passes IA max par slot

    const attachReviewMeta = (validExercise: any, review: ExerciseReviewResult, extra: Record<string, unknown> = {}) => ({
      ...validExercise,
      metadata: {
        ...(validExercise.metadata ?? {}),
        ...extra,
        pedagogical_review: {
          source: review.source,
          niveau_ok: review.niveau_ok,
          pedagogie_ok: review.pedagogie_ok,
          directives_ok: review.directives_ok,
          warnings: review.issues.filter((issue) => issue.severity === "warning"),
          suggestions: review.suggestions,
        },
      },
    });

    const validatedList: any[] = [];
    const excludedList: { titre: string; reason: string; details?: unknown }[] = [];
    let aiPassedCount = 0;
    let retryAttempts = 0;
    let fallbackCount = 0;

    const drafts: any[] = Array.isArray(exercises.exercises) ? exercises.exercises : [];

    for (const draft of drafts) {
      if (validatedList.length >= generationCount) break; // on a déjà assez d'exercices
      let current: any = draft;
      let accepted: any = null;
      let lastIssues: ExerciseReviewIssue[] = [];

      for (let attempt = 0; attempt <= QA_MAX_RETRIES; attempt++) {
        const validated = await validateAndFix(current, { niveau: current?.niveau_vise ?? niveauVise });
        if (validated) {
          const validExercise = { ...current, ...validated.exercise };
          const review = await reviewExercise({
            exercise: validExercise,
            pedagogicalDirectives: reviewDirective,
            niveau: validExercise.niveau_vise ?? niveauVise,
            competence: validExercise.competence ?? competence,
            contexte: "generate-exercises",
          });
          if (!hasBlockingReviewIssue(review)) {
            accepted = attachReviewMeta(validExercise, review, { qa_retries: attempt });
            break;
          }
          lastIssues = review.issues.filter((issue) => issue.severity === "error");
        } else {
          lastIssues = [{ code: "validation_failed_after_3_attempts", severity: "error", message: "Validation structurelle échouée après 3 tentatives." }];
        }

        // Encore des tentatives disponibles → on régénère ce slot avec le feedback QA.
        if (attempt < QA_MAX_RETRIES) {
          retryAttempts++;
          console.warn(`[generate-exercises] QA reject (slot "${current?.titre ?? "?"}", tentative ${attempt + 1}):`, lastIssues.map((i) => i.code).join(", "));
          const regen = await regenerateExerciseForQA({
            systemPrompt,
            rejected: current,
            issues: lastIssues,
            directives: reviewDirective,
            competence,
            niveauVise,
            diffLevel,
          });
          if (!regen) break; // l'IA n'a pas répondu → on bascule sur le filet de sécurité
          current = regen;
        }
      }

      if (accepted) {
        aiPassedCount++;
        validatedList.push(accepted);
      } else {
        excludedList.push({
          titre: current?.titre || "?",
          reason: "pedagogical_review_failed_after_retries",
          details: lastIssues,
        });
        console.warn(`[generate-exercises] Slot abandonné après ${QA_MAX_RETRIES} régénérations:`, lastIssues.map((i) => i.code).join(", "));
      }
    }

    // ── FILET DE SÉCURITÉ : compléter jusqu'à `generationCount` avec des exercices de repli ──
    // garantis conformes (jamais de liste vide ni de séance sous-dotée).
    // (Si la banque a fourni des réutilisations, on ne complète que le solde à générer.)
    while (validatedList.length < generationCount) {
      const fb = buildFallbackExercise({ competence, niveauVise, diffLevel, pointName, directives: reviewDirective });
      const review = await reviewExercise({
        exercise: fb,
        pedagogicalDirectives: reviewDirective,
        niveau: niveauVise,
        competence,
        contexte: "generate-exercises-fallback",
        useAI: false,
      });
      validatedList.push(attachReviewMeta(fb, review, { is_fallback: true }));
      fallbackCount++;
      console.warn(`[generate-exercises] Fallback exercise ${fallbackCount} added to guarantee generationCount=${generationCount}`);
    }

    // Chaque exercice GÉNÉRÉ est noté par le MÊME juge unique que la banque,
    // puis marqué `source: 'genere'` (cohérence du scoring global).
    for (const ex of validatedList) {
      try {
        const s = scoreGeneratedExercise(
          { competence: ex.competence ?? competence, niveau_vise: ex.niveau_vise ?? niveauVise, format: ex.format, contexte_irn: ex.contexte_irn },
          { competence, niveauVise: niveauVise || "A1", typeDemarche: demarche, themeId: themeId ?? null },
        );
        ex.source = "genere";
        ex.search_score = s.score;
      } catch (_scoreErr) {
        ex.source = "genere";
      }
    }

    exercises.exercises = validatedList;
    if (excludedList.length > 0) {
      (exercises as any).excluded = excludedList;
      (exercises as any).totalExcluded = excludedList.length;
    }

    // Rapport de génération : demandés vs repris de la banque vs générés vs repli.
    const generationReport = {
      requested: count,
      reused_from_bank: reusedExercises.length,
      generated: validatedList.length,
      ai_passed: aiPassedCount,
      fallback_used: fallbackCount,
      retry_attempts: retryAttempts,
      excluded: excludedList.length,
      reuse_score_min: typeof reuseScoreMin === "number" ? reuseScoreMin : REUSE_SCORE_MIN,
      generate_score_min: GENERATE_SCORE_MIN,
    };
    (exercises as any).generation_report = generationReport;
    if (fallbackCount > 0) {
      (exercises as any).qa_warning = `${fallbackCount}/${generationCount} exercice(s) de repli généré(s) après échec QA (le reste a passé la QA).`;
    }
    console.log(JSON.stringify({ event: "generation_report", ...generationReport }));

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
      // Exercices RÉUTILISÉS depuis la banque (références à des exercices existants).
      reused: reusedExercises,
      search_report: searchReport,
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
