import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAndFix } from "../_shared/exercise-validator.ts";
import { QA_REVIEW_BLOCK } from "../_shared/qa-prompt.ts";
import { checkConsentBatch, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth } from "../_shared/check-consent.ts";
import { formatPedagogicalDirectives, type PedagogicalDirectives } from "../_shared/pedagogical-directives.ts";
import { computeProgressionForEleves, type ProgressionMode } from "../_shared/progression.ts";
import { bigramJaccard } from "../_shared/text-similarity.ts";
import {
  assignClusterVariant,
  deriveFormatsForCluster,
  formatReferentialPromptBlock,
  formatDifferentiationTransformationPrompt,
  getDifferentiationTransformationRule,
  normalizeDifferentiationLevel,
  validateDifferentiationVariantContract,
  getClusterVariantRules,
  getSessionMinimumsForDuration,
  getEnrichedSession,
  getThemeTemplate,
  inferThemeFromText,
  resolvePlanCadreThemeId,
  type ClusterVariantId,
  type DifferentiationLevel,
  type ThemeSessionTemplate,
} from "../_shared/referential-loader.ts";

const VARIANT_JACCARD_THRESHOLD = 0.3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DifferentiationCluster {
  key: string;
  target_level: DifferentiationLevel;
  cluster_id: ClusterVariantId;
  niveau_variante: PedagogicalDirectives["niveau_variante"];
  niveau_etayage: PedagogicalDirectives["niveau_etayage"];
  mode_adaptation: ProgressionMode;
  competence_cible: string | null;
  directives: PedagogicalDirectives;
  formats_autorises: string[];
  eleve_ids: string[];
}

function mergeClustersToConfiguredMax(clusters: DifferentiationCluster[]): DifferentiationCluster[] {
  const maxClusters = getClusterVariantRules().max_clusters_per_session ?? 4;
  if (clusters.length <= maxClusters) return clusters;

  const byTargetLevel = new Map<DifferentiationLevel, DifferentiationCluster>();
  for (const cluster of clusters) {
    if (!byTargetLevel.has(cluster.target_level)) {
      byTargetLevel.set(cluster.target_level, { ...cluster, eleve_ids: [...cluster.eleve_ids] });
    } else {
      byTargetLevel.get(cluster.target_level)!.eleve_ids.push(...cluster.eleve_ids);
    }
  }
  return Array.from(byTargetLevel.values()).slice(0, maxClusters);
}
function summarizeExercise(exercise: any): string {
  return String(exercise?.titre || exercise?.exercice?.consigne || exercise?.consigne || "Variante").slice(0, 140);
}

function normalizeVariantPayload(exercise: any, commonExercise: any, context: {
  titre: string;
  objectifs?: string;
  competence: string;
  niveau: string;
  sourceLevel: DifferentiationLevel;
  targetLevel: DifferentiationLevel;
  transformationId: string;
  directives: PedagogicalDirectives;
}) {
  const differentiationContract = {
    schema_version: "1.0",
    source_level: context.sourceLevel,
    target_level: context.targetLevel,
    competence_invariante: context.competence,
    transformation_id: context.transformationId,
  };

  if (exercise?.support && exercise?.exercice && exercise?.attendus) {
    return {
      ...exercise,
      tronc_commun: {
        ...(exercise.tronc_commun ?? {}),
        objectif: exercise.tronc_commun?.objectif ?? context.objectifs ?? context.titre,
        theme: exercise.tronc_commun?.theme ?? context.titre,
        competence: context.competence,
      },
      exercice: {
        ...exercise.exercice,
        competence: context.competence,
      },
      differentiation_contract: differentiationContract,
    };
  }

  return {
    differentiation_contract: differentiationContract,
    tronc_commun: {
      objectif: context.objectifs || context.titre,
      theme: context.titre,
      competence: context.competence,
    },
    support: {
      type: commonExercise?.competence === "CO" ? "script_audio" : "texte",
      contenu: exercise?.contenu?.texte || exercise?.contenu?.script_audio || commonExercise?.contenu?.texte || "",
      aides_lexicales: exercise?.support?.aides_lexicales || [],
      longueur: context.directives.niveau_etayage === "fort" ? "courte" : context.directives.niveau_etayage === "moyen" ? "standard" : "developpee",
      niveau_lisible: context.niveau,
    },
    exercice: {
      titre: exercise?.titre || commonExercise?.titre || "Exercice adapte",
      consigne: exercise?.consigne || commonExercise?.consigne || "",
      format: exercise?.format || commonExercise?.format || "qcm",
      competence: exercise?.competence || commonExercise?.competence || context.competence,
      difficulte: exercise?.difficulte || commonExercise?.difficulte || 3,
      contenu: exercise?.contenu || commonExercise?.contenu || { items: [] },
      nombre_items: exercise?.contenu?.items?.length ?? commonExercise?.contenu?.items?.length ?? 0,
      type_questions: exercise?.type_questions || [],
    },
    attendus: {
      production_minimale: exercise?.attendus?.production_minimale || "Reussir les items avec les aides proposees.",
      niveau_autonomie: context.directives.niveau_etayage === "fort" ? "guide" : context.directives.niveau_etayage === "moyen" ? "semi-guide" : "autonome",
      criteres_reussite: exercise?.attendus?.criteres_reussite || ["Comprendre la consigne", "Identifier les informations utiles"],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const _triggeredBy = await getUserIdFromAuth(req);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);
    const _secretBlock = await ensurePseudonymSecretOrLog("generate-session-content", corsHeaders, null);
    if (_secretBlock) return _secretBlock;
    await logAICall({ function_name: "generate-session-content", triggered_by_user_id: _triggeredBy, status: "ok", data_categories: [], pseudonymization_level: "none" });
    const { titre, objectifs, competences_cibles, niveau_cible, duree_minutes, exercices_suggeres, gabaritNumero, micro_competences, selected_activities, groupId, eleveIds, formateurId, sessionId, theme_id, type_demarche } = await req.json();
    // AI key check moved to shared ai-client

    if (!titre || !competences_cibles || competences_cibles.length === 0) {
      return new Response(
        JSON.stringify({ error: "titre et competences_cibles sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const niveau = niveau_cible || "A1";
    const duree = duree_minutes || 180;
    const nbExercices = Math.max(8, Math.round(duree / 18));

    // Theme template (explicit theme_id or inferred from title/domain)
    let themeTemplate: ThemeSessionTemplate | null = null;
    if (theme_id) {
      themeTemplate = getThemeTemplate(theme_id);
    }
    if (!themeTemplate && gabaritNumero != null && gabaritNumero >= 8 && gabaritNumero <= 20) {
      const planSession = getEnrichedSession(gabaritNumero);
      if (planSession) {
        themeTemplate = getThemeTemplate(resolvePlanCadreThemeId(planSession));
      }
    }
    if (!themeTemplate) {
      themeTemplate = inferThemeFromText(`${titre} ${objectifs ?? ""} ${competences_cibles?.join(" ") ?? ""}`);
    }

    const referentialBlock = formatReferentialPromptBlock({
      theme: themeTemplate,
      dureeMinutes: duree,
      typeDemarche: type_demarche,
    });

    const sessionMinimums = getSessionMinimumsForDuration(duree);
    let minimumsWarning = "";
    if (sessionMinimums) {
      const minLines = Object.entries(sessionMinimums)
        .map(([comp, min]) => `${comp}: minimum ${min} exercice(s)`)
        .join("; ");
      minimumsWarning = `\nVALIDATION MINIMUMS SEANCE: ${minLines}. Avertir si non respecte.`;
    }

    // Load gabarit if provided
    let gabarit: any = null;
    if (gabaritNumero != null) {
      const { data } = await sb
        .from("gabarits_pedagogiques")
        .select("*")
        .eq("numero", gabaritNumero)
        .maybeSingle();
      gabarit = data;
    }

    let gabaritBlock = "";
    if (gabarit) {
      const lexique = Array.isArray(gabarit.lexique_cibles) ? gabarit.lexique_cibles.join(", ") : (gabarit.lexique_cibles || "");
      gabaritBlock = `

GABARIT SÉANCE TCF IRN v2.0 :
SÉANCE : ${gabarit.titre}
BLOC : ${gabarit.bloc || "Non spécifié"}
PALIER : ${gabarit.palier_cecrl || "Non spécifié"}
OBJECTIF : ${gabarit.objectif_principal || "Non spécifié"}
LEXIQUE OBLIGATOIRE : ${lexique}
CONSIGNES TECHNIQUES : ${gabarit.consignes_generation || "Aucune"}
CRITÈRES DE RÉUSSITE : ${gabarit.criteres_reussite || "Non spécifiés"}

RÈGLES DU GABARIT :
1. N'utilise QUE le lexique listé ci-dessus
2. Respecte les formats indiqués dans les consignes techniques
3. Contextes administratifs / vie quotidienne primo-arrivant uniquement
4. Niveau : ${gabarit.palier_cecrl || niveau} — adapter la complexité
5. Pas de situations hors contexte IRN`;
    }

    // ── Banque pédagogique (RAG structuré) ──
    let banqueBlock = "";
    if (Array.isArray(selected_activities) && selected_activities.length > 0) {
      const lignes = selected_activities.map((a: any, i: number) => {
        const dur = (a.duration_min || a.duration_max)
          ? `${a.duration_min ?? "?"}–${a.duration_max ?? "?"} min`
          : "durée libre";
        const mat = Array.isArray(a.materials_needed) && a.materials_needed.length ? a.materials_needed.join(", ") : "aucun";
        const tags = Array.isArray(a.tags) && a.tags.length ? a.tags.join(", ") : "—";
        return `[${i + 1}] ${a.title}
  - source_pdf: ${a.source_pdf ?? "?"}
  - document_id: ${a.document_id ?? "?"}
  - catégorie: ${a.category ?? "?"} | niveau ${a.level_min ?? "?"}→${a.level_max ?? "?"} | ${dur}
  - objectif: ${a.objective ?? "—"}
  - matériel: ${mat}
  - tags: ${tags}
  - consignes: ${(a.instructions ?? "").slice(0, 500)}`;
      }).join("\n\n");

      banqueBlock = `

═══════════════════════════════════════════════════
BANQUE PÉDAGOGIQUE — ACTIVITÉS FOURNIES PAR LE FORMATEUR
Ces activités sont issues de la base interne (PDF Wilson). Elles sont prioritaires.
═══════════════════════════════════════════════════

RÈGLES STRICTES :
1. INTERDICTION d'inventer une nouvelle activité si une activité fournie couvre déjà le besoin pédagogique de l'exercice. Tu DOIS la réutiliser et l'adapter.
2. Pour chaque exercice généré qui s'inspire d'une activité fournie, ajoute dans son champ "source_reference" : { "source_pdf": "...", "document_id": "...", "activity_index": <N> } repris EXACTEMENT du bloc ci-dessous.
3. Tu peux compléter avec des exercices originaux uniquement si les activités fournies ne couvrent pas toutes les compétences ciblées.
4. Conserve les objectifs et le matériel listés dans l'activité source quand tu l'adaptes.

ACTIVITÉS DISPONIBLES :
${lignes}`;
    }

    const systemPrompt = `Tu es un expert FLE spécialisé TCF IRN. Tu dois générer le contenu complet d'une séance de ${duree} minutes pour un cours collectif d'adultes primo-arrivants.

Pour CHAQUE exercice, tu dois fournir :
1. L'exercice numérique (visible par l'élève) : titre, consigne, format, items avec options et réponses
2. L'atelier ludique associé (visible uniquement par le formateur) : mise en situation, jeu, matériel, objectif oral
3. La documentation_fournie : tout le matériel pédagogique nécessaire au formateur et aux élèves pour réaliser l'atelier ludique

RÈGLES :
- Génère exactement ${nbExercices} paires [exercice + atelier ludique]
- Niveau : ${niveau}
- Compétences à couvrir : ${competences_cibles.join(", ")}
- Contextes IRN : préfecture, CAF, emploi, logement, transport, santé, citoyenneté
- Varier les formats : qcm, vrai_faux, texte_lacunaire, appariement, transformation
- Chaque exercice doit être ORIGINAL
- IMPORTANT : pour les exercices de CE (compréhension écrite), tu DOIS OBLIGATOIREMENT inclure un champ "texte" dans contenu avec le paragraphe/document à lire AVANT les questions. Sans ce texte, l'exercice est inutilisable.
- Pour les exercices de CO, inclus aussi un champ "texte" avec le script audio/dialogue à écouter.
- Les ateliers ludiques doivent être réalistes et réalisables en classe (jeu de rôle, mime, Jacques a dit, cartes, etc.)

DOCUMENTATION_FOURNIE (OBLIGATOIRE pour chaque atelier ludique) :
- guide_formateur : instructions pas-à-pas claires pour animer l'activité en classe
- fiches_eleves : un tableau de fiches physiques. Chaque fiche = un rôle ou une mission (ex: "Fiche A : Le Vendeur", "Fiche B : Le Client")
  - titre_fiche : titre de la fiche
  - contenu_fiche : description du rôle, mission spécifique, vocabulaire imposé, budget/prix/données concrètes
  - lexique_cles : liste de 5-10 mots/phrases de niveau A1 à utiliser pendant le jeu
- Le formateur doit avoir 100% du matériel textuel nécessaire. AUCUNE recherche externe permise.
- Si c'est un jeu de rôle au marché, génère les prix, la liste des produits, le budget de l'acheteur.
- Si c'est une simulation médicale, génère les symptômes, le vocabulaire du corps, les phrases types.
${objectifs ? `- Objectifs de la séance : ${objectifs}` : ""}
${exercices_suggeres?.length ? `- Types d'exercices suggérés : ${exercices_suggeres.join(", ")}` : ""}
${(() => {
  if (!micro_competences || !Array.isArray(micro_competences) || micro_competences.length === 0) return "";
  const lines = micro_competences.map((mc: any, i: number) => `${i + 1}. ${mc.texte} — statut : ${mc.statut === "a_renforcer" ? "à_renforcer" : "normal"} (${mc.competence_globale})`).join("\n");
  return `
MICRO-COMPÉTENCES CIBLÉES (ordre de priorité du formateur) :
${lines}

Instructions de pondération :
- Compétences marquées 'à_renforcer' : générer 40% de questions supplémentaires sur ces points, ou augmenter la difficulté d'un palier.
- Compétences en position 1 et 2 : priorité maximale dans la génération.
- Compétences en position 3 et suivantes : volume standard.`;
})()}
${gabaritBlock}
${banqueBlock}
${referentialBlock}
${minimumsWarning}

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

Utilise le tool fourni pour retourner le résultat.` + QA_REVIEW_BLOCK;

    const userPrompt = `Génère le contenu complet de la séance "${titre}" (${duree} min, niveau ${niveau}, compétences : ${competences_cibles.join(", ")}).`;

    const data = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_session_content",
              description: "Crée le contenu complet de la séance avec exercices et ateliers ludiques",
              parameters: {
                type: "object",
                properties: {
                  exercices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titre: { type: "string" },
                        consigne: { type: "string" },
                        format: { type: "string", enum: ["qcm", "vrai_faux", "texte_lacunaire", "appariement", "transformation"] },
                        competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                        difficulte: { type: "number" },
                        contenu: {
                          type: "object",
                          properties: {
                            texte: { type: "string", description: "Texte support / paragraphe à lire avant les questions (obligatoire pour CE, facultatif sinon)" },
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
                        atelier_ludique: {
                          type: "object",
                          properties: {
                            scenario: { type: "string", description: "Mise en situation concrète pour le formateur" },
                            jeu: { type: "string", description: "Règle de jeu ludique détaillée" },
                            materiel: { type: "string", description: "Matériel à préparer" },
                            objectif_oral: { type: "string", description: "Structure de phrase cible à l'oral" },
                            duree_minutes: { type: "number", description: "Durée estimée de l'atelier" },
                            variante: { type: "string", description: "Variante possible pour adapter" },
                            documentation_fournie: {
                              type: "object",
                              description: "Matériel pédagogique complet pour le formateur et les élèves",
                              properties: {
                                guide_formateur: { type: "string", description: "Instructions pas-à-pas pour animer l'activité" },
                                fiches_eleves: {
                                  type: "array",
                                  description: "Fiches physiques à distribuer aux élèves",
                                  items: {
                                    type: "object",
                                    properties: {
                                      titre_fiche: { type: "string", description: "Ex: Fiche A — Le Vendeur" },
                                      contenu_fiche: { type: "string", description: "Rôle, mission, vocabulaire imposé, données concrètes" },
                                      lexique_cles: { type: "array", items: { type: "string" }, description: "5-10 mots/phrases A1 à utiliser" },
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
                      required: ["titre", "consigne", "format", "competence", "difficulte", "contenu", "atelier_ludique"],
                    },
                  },
                },
                required: ["exercices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_session_content" } },
      });
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("L'IA n'a pas pu générer le contenu de la séance");

    const parsed = JSON.parse(toolCall.function.arguments);

    // Remap atelier_ludique → animation_guide for DB column compatibility
    const exercicesRaw = (parsed.exercices || []).map((ex: any) => {
      if (ex.atelier_ludique) {
        ex.animation_guide = ex.atelier_ludique;
        delete ex.atelier_ludique;
      }
      return ex;
    });

    // ── Validation item-par-item via validateAndFix ──
    const exercices: any[] = [];
    const excluded: { titre: string; reason: string }[] = [];
    for (const ex of exercicesRaw) {
      const validated = await validateAndFix(ex, { niveau });
      if (!validated) {
        excluded.push({ titre: ex.titre || "?", reason: "validation_failed_after_3_attempts" });
        console.warn(`[QA_AUTO][session-content] Excluded: ${ex.titre}`);
        continue;
      }
      // Préserve les champs additionnels (animation_guide, etc.) du brut
      exercices.push({ ...ex, ...validated.exercise });
    }

    const initial = exercicesRaw.length;
    const ratio = initial > 0 ? exercices.length / initial : 1;
    if (initial > 0 && ratio < 0.6) {
      console.warn(`[QA_AUTO][session-content] Low ratio ${(ratio * 100).toFixed(0)}%`);
      return new Response(
        JSON.stringify({
          error: `QA bloquée : seulement ${exercices.length}/${initial} exercices valides (<60%)`,
          excluded,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groupId) {
      return new Response(JSON.stringify({ exercices, excluded, totalExcluded: excluded.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "missing_session_id", message: "sessionId est requis pour enregistrer les variantes de groupe." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let resolvedEleveIds = Array.isArray(eleveIds) ? eleveIds.filter(Boolean) : [];
    if (resolvedEleveIds.length === 0) {
      const { data: members, error: membersError } = await sb
        .from("group_members")
        .select("eleve_id")
        .eq("group_id", groupId);
      if (membersError) throw membersError;
      resolvedEleveIds = (members ?? []).map((member: any) => member.eleve_id).filter(Boolean);
    }

    const consent = await checkConsentBatch(resolvedEleveIds);
    const eligibleEleveIds = consent.allowedIds;
    const differentiationExcluded = consent.excludedIds.map((eleve_id) => ({ eleve_id, raison: "consent_missing" }));

    if (eligibleEleveIds.length === 0) {
      await logAICall({
        function_name: "generate-session-content",
        triggered_by_user_id: _triggeredBy,
        status: "blocked_no_consent",
        data_categories: ["profile", "results"],
        pseudonymization_level: "hmac_sha256",
      });
      return new Response(JSON.stringify({
        exercices,
        excluded,
        totalExcluded: excluded.length,
        differentiation: {
          generation_run_id: null,
          clusters: [],
          variants_per_eleve: {},
          excluded: differentiationExcluded,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await logAICall({
      function_name: "generate-session-content",
      triggered_by_user_id: _triggeredBy,
      status: "ok",
      data_categories: ["profile", "results"],
      pseudonymization_level: "hmac_sha256",
    });

    const targetCompetence = Array.isArray(competences_cibles) ? competences_cibles[0] : null;
    const progressionProfiles = await computeProgressionForEleves(sb, eligibleEleveIds, {
      sessionId,
      targetCompetence,
    });

    const sourceLevel = normalizeDifferentiationLevel(niveau);
    const clusterMap = new Map<string, DifferentiationCluster>();
    for (const eleveId of eligibleEleveIds) {
      const profile = progressionProfiles[eleveId];
      if (!profile) continue;
      const directives = profile.directives;
      const clusterVariant = assignClusterVariant(
        profile.profile?.niveau_actuel ?? niveau,
        directives.niveau_variante,
      );
      const clusterId = clusterVariant?.id ?? directives.niveau_variante;
      const targetLevel = normalizeDifferentiationLevel(profile.profile?.niveau_actuel ?? niveau);
      const key = `${clusterId}:${targetLevel}`;
      const targetComp = targetCompetence ?? directives.competence_cible ?? "CE";
      const formatDerivation = deriveFormatsForCluster(
        profile.profile?.niveau_actuel ?? niveau,
        directives.niveau_variante,
        targetComp,
        profile.progression,
        type_demarche,
      );
      if (!clusterMap.has(key)) {
        clusterMap.set(key, {
          key,
          target_level: targetLevel,
          cluster_id: clusterId,
          niveau_variante: directives.niveau_variante,
          niveau_etayage: directives.niveau_etayage,
          mode_adaptation: profile.progression,
          competence_cible: directives.competence_cible,
          directives,
          formats_autorises: formatDerivation.formats,
          eleve_ids: [],
        });
      }
      clusterMap.get(key)!.eleve_ids.push(eleveId);
    }

    const clusters = mergeClustersToConfiguredMax(Array.from(clusterMap.values()));
    if (clusters.length > 8) {
      return new Response(
        JSON.stringify({ error: "too_many_clusters", clusters: clusters.length }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const generationRunId = crypto.randomUUID();
    const variantsPerEleve: Record<string, any> = {};
    const rowsToInsert: any[] = [];

    for (const cluster of clusters) {
      const directivesBlock = formatPedagogicalDirectives(cluster.directives);
      const clusterCompetence = targetCompetence ?? cluster.competence_cible ?? "CE";
      const transformation = getDifferentiationTransformationRule(sourceLevel, cluster.target_level);
      if (!transformation) {
        return new Response(
          JSON.stringify({
            error: "DIFF_TRANSFORMATION_NOT_SUPPORTED",
            source_level: sourceLevel,
            target_level: cluster.target_level,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const differentiationContractBlock = formatDifferentiationTransformationPrompt(
        sourceLevel,
        cluster.target_level,
        clusterCompetence,
      );
      const clusterReferentialBlock
      const clusterReferentialBlock = formatReferentialPromptBlock({
        theme: themeTemplate,
        dureeMinutes: duree,
        clusterVariants: [cluster.cluster_id],
        typeDemarche: type_demarche,
      });
      const variantPrompt = `Tu produis des variantes pedagogiques d'une seance FLE TCF IRN.

Tu dois conserver le meme objectif, le meme theme, la meme situation de communication et la meme competence.
Tu dois garder le support source du tronc commun comme support commun.
Tu peux uniquement le segmenter, le simplifier legerement, ajouter des aides lexicales, un exemple, une consigne audio ou une aide visuelle.
Tu ne dois jamais remplacer le support par un autre document, un autre texte, une autre situation ou un autre scenario.
Tu dois adapter l'exercice et les attendus selon les directives.

INVARIANTS CLUSTER (OBLIGATOIRES — identiques entre variantes):
- situation_type, noms des personnages, lieux, donnees chiffrees, lexique_noyau du theme
- Ne jamais modifier les faits du support commun (horaires, noms, chiffres)

FORMATS AUTORISES POUR CE CLUSTER: ${cluster.formats_autorises.join(", ")}

${clusterReferentialBlock}

${differentiationContractBlock}

DIRECTIVES DU CLUSTER:
${directivesBlock}

TRONC COMMUN:
${JSON.stringify({ titre, objectifs, niveau, competences_cibles, exercices }, null, 2)}

Retourne exactement ${exercices.length} variantes, dans le meme ordre que les exercices du tronc commun.
Chaque variante doit contenir:
- tronc_commun: objectif, theme, competence
- support: type, contenu, aides_lexicales, longueur, niveau_lisible
- exercice: titre, consigne, format, competence, difficulte, contenu, nombre_items, type_questions
- attendus: production_minimale, niveau_autonomie, criteres_reussite
- differentiation_contract: schema_version, source_level, target_level, competence_invariante, transformation_id
Ne cree pas une activite differente: differencie le chemin d'acces.
Si le support.contenu change, il doit rester une version etayee du support commun, pas un nouveau support.`;

      const variantData = await callAI({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: variantPrompt + QA_REVIEW_BLOCK },
          { role: "user", content: `Genere les variantes pour le niveau CECRL ${cluster.target_level}, cluster ${cluster.niveau_variante}/${cluster.niveau_etayage}, transformation ${transformation.id}.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_session_variants",
              description: "Cree les variantes pedagogiques de chaque exercice de la seance",
              parameters: {
                type: "object",
                properties: {
                  variantes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        differentiation_contract: { type: "object" },
                        tronc_commun: { type: "object" },
                        support: { type: "object" },
                        exercice: { type: "object" },
                        attendus: { type: "object" },
                      },
                      required: ["differentiation_contract", "support", "exercice", "attendus"],
                    },
                  },
                },
                required: ["variantes"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_session_variants" } },
      });

      const variantToolCall = variantData.choices?.[0]?.message?.tool_calls?.[0];
      if (!variantToolCall) throw new Error("L'IA n'a pas pu generer les variantes de seance");
      const parsedVariants = JSON.parse(variantToolCall.function.arguments);
      const rawVariants = Array.isArray(parsedVariants.variantes) ? parsedVariants.variantes : [];

      const normalizedVariants: any[] = [];
      for (let index = 0; index < exercices.length; index++) {
        const rawVariant = rawVariants[index] ?? exercices[index];
        const rawExercise = rawVariant.exercice ?? rawVariant;
        const expectedCompetence = exercices[index]?.competence || targetCompetence || "CE";
        const rawContractValidation = validateDifferentiationVariantContract({
          variant: rawVariant,
          sourceLevel,
          targetLevel: cluster.target_level,
          competence: expectedCompetence,
        });
        if (!rawContractValidation.valid) {
          return new Response(
            JSON.stringify({
              error: "differentiation_contract_failed",
              codes: rawContractValidation.errors,
              warnings: rawContractValidation.warnings,
              exercice_index: index,
              source_level: sourceLevel,
              target_level: cluster.target_level,
            }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const validated = await validateAndFix(rawExercise, { niveau: cluster.target_level });
        const safeExercise = validated?.exercise ? { ...rawExercise, ...validated.exercise } : rawExercise;
        const variant = normalizeVariantPayload(
          { ...rawVariant, exercice: safeExercise },
          exercices[index],
          {
            titre,
            objectifs,
            competence: expectedCompetence,
            niveau: cluster.target_level,
            sourceLevel,
            targetLevel: cluster.target_level,
            transformationId: transformation.id,
            directives: cluster.directives,
          },
        );

        // Garde-fou anti-hallucination : le support de la variante doit rester
        // proche du support du tronc commun. On logge pour calibrage et on
        // marque les variantes divergentes SANS bloquer la génération.
        const troncSupport =
          exercices[index]?.support?.contenu ??
          exercices[index]?.contenu?.texte ??
          exercices[index]?.contenu?.script_audio ??
          "";
        const variantSupport = variant?.support?.contenu ?? "";
        const jaccard = bigramJaccard(troncSupport, variantSupport);
        console.log("[metric] jaccard", {
          session_id: sessionId,
          cluster: cluster.key,
          exercice_index: index,
          value: jaccard,
          threshold: VARIANT_JACCARD_THRESHOLD,
          status: jaccard === null
            ? "too_short"
            : jaccard < VARIANT_JACCARD_THRESHOLD
              ? "divergent"
              : "ok",
        });
        if (jaccard !== null && jaccard < VARIANT_JACCARD_THRESHOLD) {
          variant._quality = { jaccard, status: "divergent_support" };
        }

        normalizedVariants.push(variant);
      }

      for (const eleveId of cluster.eleve_ids) {
        variantsPerEleve[eleveId] = {
          niveau_variante: cluster.niveau_variante,
          target_level: cluster.target_level,
          source_level: sourceLevel,
          transformation_id: getDifferentiationTransformationRule(sourceLevel, cluster.target_level)?.id ?? null,
          niveau_etayage: cluster.niveau_etayage,
          mode_adaptation: cluster.mode_adaptation,
          exercices: normalizedVariants,
        };

        normalizedVariants.forEach((variant, exerciceIndex) => {
          rowsToInsert.push({
            session_id: sessionId,
            eleve_id: eleveId,
            exercice_index: exerciceIndex,
            variant_payload: variant,
            niveau_variante: cluster.niveau_variante,
            niveau_etayage: cluster.niveau_etayage,
            mode_adaptation: cluster.mode_adaptation,
            competence_cible: cluster.competence_cible,
            generation_run_id: generationRunId,
            generated_by: formateurId ?? _triggeredBy,
          });
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await sb.from("session_exercise_variants").insert(rowsToInsert);
      if (insertError) throw insertError;

      // Auto-publication du nouveau run (atomique côté DB)
      const { error: publishError } = await sb.rpc("publish_session_variants_run", {
        p_session_id: sessionId,
        p_generation_run_id: generationRunId,
      });
      if (publishError) {
        // Log mais ne fail pas tout : les variantes existent, juste pas actives
        console.error("[generate-session-content] publish failed", publishError);
      }
    }

    return new Response(JSON.stringify({
      exercices,
      excluded,
      totalExcluded: excluded.length,
      differentiation: {
        generation_run_id: generationRunId,
        clusters: clusters.map((cluster) => ({
          cluster_id: cluster.cluster_id,
          niveau_variante: cluster.niveau_variante,
          target_level: cluster.target_level,
          source_level: sourceLevel,
          transformation_id: getDifferentiationTransformationRule(sourceLevel, cluster.target_level)?.id ?? null,
          niveau_etayage: cluster.niveau_etayage,
          mode_adaptation: cluster.mode_adaptation,
          formats_autorises: cluster.formats_autorises,
          eleve_ids: cluster.eleve_ids,
        })),
        theme_id: themeTemplate?.theme_id ?? null,
        variants_per_eleve: variantsPerEleve,
        excluded: differentiationExcluded,
        summaries: Object.fromEntries(Object.entries(variantsPerEleve).map(([eleveId, value]: [string, any]) => [
          eleveId,
          value.exercices.map((variant: any) => summarizeExercise(variant)),
        ])),
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-session-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
