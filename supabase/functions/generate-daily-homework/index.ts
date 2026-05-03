import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { validateAndFix } from "../_shared/exercise-validator.ts";
import { QA_REVIEW_BLOCK, logQaAuto } from "../_shared/qa-prompt.ts";
import { buildPedagogicalDirectives, formatPedagogicalDirectives } from "../_shared/pedagogical-directives.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkConsentBatch, ensurePseudonymSecretOrLog, logAICall, getUserIdFromAuth, consentBlockedResponse } from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AI key check moved to shared ai-client

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sessionId, dailyDuration, targetDays, targetWeaknesses, formateurId, type_demarche } = await req.json();

    if (!sessionId || !dailyDuration || !targetDays || !formateurId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch session info
    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("*, group:groups(id, nom, niveau)")
      .eq("id", sessionId)
      .single();
    if (sessErr || !session) throw new Error("Session not found");

    const groupId = session.group_id;
    const niveauCible = session.niveau_cible || "A1";
    // type_demarche : depuis la requête ou depuis le groupe
    let demarche = type_demarche;
    if (!demarche) {
      const { data: grp } = await supabase.from("groups").select("type_demarche").eq("id", groupId).maybeSingle();
      demarche = grp?.type_demarche || "titre_sejour";
    }
    const epreuvesOblgatoires = demarche === "naturalisation" ? "CO, CE, EE, EO" : "CO, CE";

    // 2. Fetch group members with profiles
    const { data: members } = await supabase
      .from("group_members")
      .select("eleve_id, profiles:profiles(nom, prenom)")
      .eq("group_id", groupId);
    if (!members?.length) throw new Error("No students in group");

    let eleveIds = members.map((m: any) => m.eleve_id);

    // RGPD: bloquer si secret de pseudonymisation absent, puis filtrer les élèves non consentants.
    const triggeredBy = await getUserIdFromAuth(req);
    const _secretBlock = await ensurePseudonymSecretOrLog("generate-daily-homework", corsHeaders, null);
    if (_secretBlock) return _secretBlock;
    const consentBatch = await checkConsentBatch(eleveIds);
    const excludedIds = consentBatch.excludedIds;
    eleveIds = consentBatch.allowedIds;
    if (eleveIds.length === 0) {
      await logAICall({ function_name: "generate-daily-homework", triggered_by_user_id: triggeredBy, status: "blocked_no_consent", data_categories: ["profile", "results"], pseudonymization_level: "hmac_sha256" });
      return new Response(JSON.stringify({ error: "consent_required", excludedIds, degraded_mode: true, message: "Aucun élève consentant dans ce groupe." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await logAICall({ function_name: "generate-daily-homework", triggered_by_user_id: triggeredBy, status: "ok", data_categories: ["profile", "results"], pseudonymization_level: "hmac_sha256" });

    // 3. Fetch session exercises (what was taught)
    const { data: sessionExercices } = await supabase
      .from("session_exercices")
      .select("statut, exercice:exercices(id, competence, format, difficulte, titre, contenu)")
      .eq("session_id", sessionId);

    const allSessionExercises = (sessionExercices ?? []).filter((se: any) => se.exercice);
    const taughtExercises = allSessionExercises.filter((se: any) => se.statut === "traite_en_classe").map((se: any) => se.exercice);
    const untreatedExercises = allSessionExercises.filter((se: any) => se.statut === "planifie" || se.statut === "reporte").map((se: any) => se.exercice);

    // 4. Fetch individual student results (last 15 results per student for error analysis)
    const { data: studentResults } = await supabase
      .from("resultats")
      .select("eleve_id, exercice_id, score, correction_detaillee, created_at, exercice:exercices(competence, format, titre, sous_competence)")
      .in("eleve_id", eleveIds)
      .order("created_at", { ascending: false })
      .limit(eleveIds.length * 15);

    // 5. Fetch student profiles (taux de réussite par compétence)
    const { data: studentProfiles } = await supabase
      .from("profils_eleves")
      .select("eleve_id, niveau_actuel, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures, priorites_pedagogiques")
      .in("eleve_id", eleveIds);

    const { data: studentOutcomes } = await supabase
      .from("session_student_outcomes")
      .select("eleve_id, objectif_status, besoin_pedagogique")
      .eq("session_id", sessionId)
      .in("eleve_id", eleveIds);

    const outcomeByEleve = new Map<string, any>();
    (studentOutcomes ?? []).forEach((outcome: any) => outcomeByEleve.set(outcome.eleve_id, outcome));

    // 6. Fetch bilan test results if targeting weaknesses
    let bilanWeaknesses: Record<string, Record<string, number>> = {};
    if (targetWeaknesses) {
      const { data: bilanTests } = await supabase
        .from("bilan_tests")
        .select("id")
        .eq("session_id", sessionId)
        .eq("statut", "envoye")
        .limit(1);

      if (bilanTests?.length) {
        const { data: results } = await supabase
          .from("bilan_test_results")
          .select("eleve_id, scores_par_competence")
          .eq("bilan_test_id", bilanTests[0].id);

        (results ?? []).forEach((r: any) => {
          const scores: Record<string, number> = {};
          if (r.scores_par_competence && typeof r.scores_par_competence === "object") {
            for (const [comp, info] of Object.entries(r.scores_par_competence as Record<string, any>)) {
              scores[comp] = info.pct ?? 0;
            }
          }
          bilanWeaknesses[r.eleve_id] = scores;
        });
      }
    }

    // 7. Fetch student competency levels
    const { data: studentLevels } = await supabase
      .from("student_competency_levels")
      .select("eleve_id, competence, niveau_actuel")
      .in("eleve_id", eleveIds);

    const levelMap: Record<string, Record<string, number>> = {};
    (studentLevels ?? []).forEach((sl: any) => {
      if (!levelMap[sl.eleve_id]) levelMap[sl.eleve_id] = {};
      levelMap[sl.eleve_id][sl.competence] = sl.niveau_actuel;
    });

    // 8. Fetch a default point_a_maitriser for exercise creation
    const { data: defaultPoint } = await supabase
      .from("points_a_maitriser")
      .select("id")
      .limit(1)
      .single();
    if (!defaultPoint) throw new Error("No points_a_maitriser found");

    // ── Build per-student error profiles ──
    const studentErrorProfiles: Record<string, any> = {};
    for (const m of members) {
      const eleveId = m.eleve_id;
      const name = m.profiles ? `${(m.profiles as any).prenom} ${(m.profiles as any).nom}`.trim() : eleveId.slice(0, 8);
      
      // Individual results
      const myResults = (studentResults ?? []).filter((r: any) => r.eleve_id === eleveId);
      
      // Identify failed competences from recent exercises
      const failedByCompetence: Record<string, { count: number; avgScore: number; examples: string[] }> = {};
      for (const r of myResults) {
        const comp = r.exercice?.competence;
        if (!comp) continue;
        if (!failedByCompetence[comp]) failedByCompetence[comp] = { count: 0, avgScore: 0, examples: [] };
        failedByCompetence[comp].count++;
        failedByCompetence[comp].avgScore += r.score;
        if (r.score < 70 && failedByCompetence[comp].examples.length < 3) {
          // Extract specific errors from correction_detaillee
          const details = r.correction_detaillee;
          if (details && typeof details === "object") {
            const items = Array.isArray(details) ? details : (details as any).items || [];
            const wrongItems = items.filter((item: any) => !item.correct && !item.est_correct).slice(0, 2);
            for (const wi of wrongItems) {
              failedByCompetence[comp].examples.push(
                wi.question || wi.consigne || r.exercice?.titre || "Exercice raté"
              );
            }
          }
        }
      }
      // Compute averages
      for (const comp of Object.keys(failedByCompetence)) {
        failedByCompetence[comp].avgScore = Math.round(failedByCompetence[comp].avgScore / failedByCompetence[comp].count);
      }

      // Profile data
      const profile = (studentProfiles ?? []).find((p: any) => p.eleve_id === eleveId);
      const weakCompetencesForDirectives = Object.entries(failedByCompetence)
        .filter(([, data]: [string, any]) => data.avgScore < 70)
        .sort(([, a]: [string, any], [, b]: [string, any]) => a.avgScore - b.avgScore)
        .map(([comp]) => comp);
      const directives = buildPedagogicalDirectives({
        profile,
        outcome: outcomeByEleve.get(eleveId),
        weakCompetences: weakCompetencesForDirectives,
        targetCompetence: weakCompetencesForDirectives[0] ?? null,
      });

      // Bilan weaknesses
      const bilan = bilanWeaknesses[eleveId];

      studentErrorProfiles[eleveId] = {
        name,
        levels: levelMap[eleveId] || {},
        profile: profile ? {
          niveau: profile.niveau_actuel,
          CO: profile.taux_reussite_co,
          CE: profile.taux_reussite_ce,
          EE: profile.taux_reussite_ee,
          EO: profile.taux_reussite_eo,
          Structures: profile.taux_reussite_structures,
          priorites: profile.priorites_pedagogiques,
        } : null,
        directives,
        recentErrors: failedByCompetence,
        bilanScores: bilan || null,
        nbResultats: myResults.length,
      };
    }

    // ── Build AI prompt ──
    const competencesUsed = [...new Set(taughtExercises.map((e: any) => e.competence))];
    const exerciseSummary = taughtExercises.map((e: any) =>
      `- ${e.titre} (${e.competence}, ${e.format}, diff ${e.difficulte}/5)`
    ).join("\n");
    const untreatedSummary = untreatedExercises.map((e: any) =>
      `- ${e.titre} (${e.competence}, ${e.format}, diff ${e.difficulte}/5)`
    ).join("\n");

    const studentProfilesBlock = Object.entries(studentErrorProfiles).map(([eleveId, p]: [string, any]) => {
      const lines = [`ÉLÈVE "${p.name}" (id: ${eleveId.slice(0, 8)})`];
      if (p.profile) {
        lines.push(`  Niveau actuel: ${p.profile.niveau} | Taux réussite: CO=${p.profile.CO}% CE=${p.profile.CE}% EE=${p.profile.EE}% EO=${p.profile.EO}% Struct=${p.profile.Structures}%`);
      }
      if (p.directives) {
        lines.push(formatPedagogicalDirectives(p.directives).split("\n").map((line) => `  ${line}`).join("\n"));
      }
      if (p.bilanScores) {
        const weakComps = Object.entries(p.bilanScores).filter(([, pct]) => (pct as number) < 70);
        if (weakComps.length > 0) {
          lines.push(`  Faiblesses bilan séance: ${weakComps.map(([c, pct]) => `${c}=${pct}%`).join(", ")}`);
        }
      }
      const weakCompetences = Object.entries(p.recentErrors)
        .filter(([, data]: [string, any]) => data.avgScore < 70)
        .sort(([, a]: [string, any], [, b]: [string, any]) => a.avgScore - b.avgScore);
      if (weakCompetences.length > 0) {
        lines.push(`  Lacunes persistantes:`);
        for (const [comp, data] of weakCompetences as [string, any][]) {
          lines.push(`    - ${comp}: ${data.avgScore}% moy (${data.count} exercices)`);
          if (data.examples.length > 0) {
            lines.push(`      Erreurs types: ${data.examples.slice(0, 3).join(" | ")}`);
          }
        }
      }
      if (p.profile?.priorites) {
        const prio = p.profile.priorites;
        if (Array.isArray(prio) && prio.length > 0) {
          lines.push(`  Priorités pédagogiques: ${prio.join(", ")}`);
        } else if (typeof prio === "object" && prio !== null) {
          const parts: string[] = [];
          if (prio.vitesse_progression) parts.push(`vitesse=${prio.vitesse_progression}`);
          if (prio.score_progression_delta != null) parts.push(`delta=${prio.score_progression_delta > 0 ? "+" : ""}${Math.round(prio.score_progression_delta)}%`);
          if (parts.length > 0) lines.push(`  Progression: ${parts.join(", ")}`);
        }
      }
      return lines.join("\n");
    }).join("\n\n");

    const systemPrompt = `Tu es un expert en didactique du FLE spécialisé dans la préparation au TCF IRN.
Tu dois concevoir un programme de devoirs quotidiens PERSONNALISÉ par élève, étalé sur ${targetDays} jour(s).

DIFFÉRENCIATION INDIVIDUELLE OBLIGATOIRE :
- Chaque élève reçoit des exercices adaptés à SES lacunes spécifiques
- Les erreurs récentes de chaque élève doivent être ciblées en priorité
- Les compétences faibles persistantes doivent être travaillées en spiralaire
- Un élève fort en CO mais faible en EE doit avoir plus d'EE et moins de CO

REGLES DE DIRECTIVES PEDAGOGIQUES :
- Les DIRECTIVES PEDAGOGIQUES CONTRAIGNANTES de chaque eleve priment sur les preferences generales.
- Si une directive interdit redaction_libre, texte_long ou production_ecrite_longue, ne genere pas ce format pour cet eleve.
- Si descente_competence est presente, travaille d'abord la competence_cible avant de revenir a la competence ratee.
- Respecte les limites consigne/items et les supports_obligatoires indiques pour chaque eleve.

CONTRAINTES TEMPORELLES STRICTES :
- Budget quotidien PAR ÉLÈVE : ${dailyDuration} minutes par jour
- Durées estimées par type d'exercice :
  * CO : 45s par item + 30s de lecture | CE : 3 min | EE : 3 min
  * EO : 2 min | Structures : 1.5 min | QCM/vrai_faux : 30s par item
  * Appariement/texte lacunaire : 2 min

STRATÉGIE DE GÉNÉRATION :
1. Exercices non traités en classe → tronc commun pour tous
2. Exercices ratés individuellement → remédiation ciblée par élève
3. Lacunes persistantes (historique < 70%) → renforcement spiralaire
4. Compétences du bilan de séance < 70% → consolidation immédiate
5. Progression : jour 1 = consolidation, jour 2+ = variation et remédiation approfondie

FORMATS SUPPORTÉS : qcm, vrai_faux, appariement, texte_lacunaire, transformation
Pour CO : ajouter "script_audio" | Pour EO : format "production_orale"

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

STRUCTURE DE SORTIE :
Un tableau "eleves" contenant pour chaque élève un objet avec son id et ses jours de devoirs.
Chaque jour contient les exercices personnalisés.` + QA_REVIEW_BLOCK;

    const userPrompt = `Séance "${session.titre}" — Niveau ${niveauCible}
Démarche IRN : ${demarche} — Épreuves obligatoires : ${epreuvesOblgatoires}
Compétences travaillées : ${competencesUsed.join(", ")}

EXERCICES TRAITÉS EN CLASSE :
${exerciseSummary || "(aucun)"}

EXERCICES NON TRAITÉS (à donner en tronc commun) :
${untreatedSummary || "(aucun)"}

PROFILS INDIVIDUELS DES ÉLÈVES :
${studentProfilesBlock}

Génère un programme PERSONNALISÉ de ${targetDays} jour(s) à ${dailyDuration} min/jour/élève.
Pour chaque élève, cible ses faiblesses spécifiques. Les exercices de tronc commun (non traités en classe) sont les mêmes pour tous, les exercices de remédiation sont individualisés.`;

    // 9. Call AI
    const data = await callAI({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_personalized_plan",
              description: "Generate personalized daily homework for each student based on their individual weaknesses",
              parameters: {
                type: "object",
                properties: {
                  eleves: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        eleve_id: { type: "string", description: "First 8 chars of student UUID" },
                        jours: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              jour: { type: "integer" },
                              duree_totale_minutes: { type: "number" },
                              exercices: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    titre: { type: "string" },
                                    consigne: { type: "string" },
                                    competence: { type: "string", enum: ["CO", "CE", "EE", "EO", "Structures"] },
                                    format: { type: "string", enum: ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_ecrite", "production_orale"] },
                                    difficulte: { type: "integer", minimum: 1, maximum: 5 },
                                    duree_estimee_minutes: { type: "number" },
                                    raison: { type: "string", enum: ["tronc_commun", "remediation", "consolidation"], description: "Why this exercise is assigned" },
                                    contenu: {
                                      type: "object",
                                      properties: {
                                        items: {
                                          type: "array",
                                          items: {
                                            type: "object",
                                            properties: {
                                              question: { type: "string" },
                                              options: { type: "array", items: { type: "string" } },
                                              bonne_reponse: { type: "string" },
                                              explication: { type: "string" },
                                              script_audio: { type: "string" },
                                            },
                                            required: ["question", "bonne_reponse"],
                                          },
                                        },
                                      },
                                      required: ["items"],
                                    },
                                  },
                                  required: ["titre", "consigne", "competence", "format", "difficulte", "contenu", "raison"],
                                },
                              },
                            },
                            required: ["jour", "exercices"],
                          },
                        },
                      },
                      required: ["eleve_id", "jours"],
                    },
                  },
                },
                required: ["eleves"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_personalized_plan" } },
      });

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const plan = JSON.parse(toolCall.function.arguments);
    const aiEleves = plan.eleves || [];

    // Build a map from short ID to full UUID
    const shortToFull: Record<string, string> = {};
    for (const eid of eleveIds) {
      shortToFull[eid.slice(0, 8)] = eid;
    }

    // 10. Insert exercises and devoirs per student
    const sessionDate = new Date(session.date_seance);
    let totalDevoirs = 0;
    let totalExercices = 0;
    let totalExcluded = 0;
    let totalInitial = 0;
    const excludedReport: { eleve: string; titre: string; reason: string }[] = [];

    // Cache for tronc commun exercises (same content → share exercise row)
    const troncCommunCache: Record<string, string> = {}; // key = jour_titre → exercice_id

    for (const aiEleve of aiEleves) {
      const fullEleveId = shortToFull[aiEleve.eleve_id];
      if (!fullEleveId) {
        console.error("Unknown student short ID:", aiEleve.eleve_id);
        continue;
      }

      for (const jour of aiEleve.jours || []) {
        const dayOffset = jour.jour || 1;
        const deadline = new Date(sessionDate);
        deadline.setDate(deadline.getDate() + dayOffset);
        deadline.setHours(23, 59, 59, 0);

        for (const ex of jour.exercices || []) {
          totalInitial++;
          // ── VALIDATION & RÉGÉNÉRATION ──
          const validated = await validateAndFix(
            { ...ex, niveau_vise: niveauCible },
            { niveau: niveauCible, demarche }
          );
          if (!validated) {
            totalExcluded++;
            excludedReport.push({ eleve: aiEleve.eleve_id, titre: ex.titre || "?", reason: "validation_failed_after_3_attempts" });
            console.warn(`[QA_AUTO][homework] Excluded: ${ex.titre} for ${aiEleve.eleve_id}`);
            continue;
          }
          const validEx = validated.exercise;

          const raison = ex.raison === "tronc_commun" ? "consolidation" : (ex.raison === "remediation" ? "remediation" : "consolidation");
          const sourceLabel = ex.raison === "tronc_commun" ? "tronc_commun" : "individualise";
          const cacheKey = ex.raison === "tronc_commun" ? `j${dayOffset}_${validEx.titre}` : "";

          let exerciceId: string;

          // Reuse tronc commun exercises across students
          if (cacheKey && troncCommunCache[cacheKey]) {
            exerciceId = troncCommunCache[cacheKey];
          } else {
            const { data: inserted, error: insertErr } = await supabase
              .from("exercices")
              .insert({
                titre: validEx.titre,
                consigne: validEx.consigne,
                competence: validEx.competence,
                format: validEx.format || "qcm",
                difficulte: validEx.difficulte || 3,
                contenu: validEx.contenu || { items: [] },
                niveau_vise: niveauCible,
                formateur_id: formateurId,
                point_a_maitriser_id: defaultPoint.id,
                is_ai_generated: true,
                is_template: false,
                is_devoir: true,
                eleve_id: sourceLabel === "individualise" ? fullEleveId : null,
              })
              .select("id")
              .single();

            if (insertErr) {
              console.error("Insert exercise error:", insertErr);
              continue;
            }
            exerciceId = inserted.id;
            totalExercices++;
            if (cacheKey) troncCommunCache[cacheKey] = exerciceId;
          }

          // Create devoir for this student
          const { error: devoirErr } = await supabase.from("devoirs").insert({
            eleve_id: fullEleveId,
            exercice_id: exerciceId,
            formateur_id: formateurId,
            raison,
            statut: "en_attente",
            session_id: sessionId,
            source_label: `${sourceLabel}_jour_${dayOffset}`,
            date_echeance: deadline.toISOString(),
          });
          if (devoirErr) {
            console.error("Insert devoir error:", devoirErr);
            continue;
          }
          totalDevoirs++;
        }
      }
    }

    // ── QA gate global : ≥60% des exercices initiaux doivent rester valides ──
    const validRatio = totalInitial > 0 ? (totalInitial - totalExcluded) / totalInitial : 1;
    if (totalInitial > 0 && validRatio < 0.6) {
      // Signalement global (formateurId disponible mais pas un eleve_id unique → log seul)
      await logQaAuto(supabase, {
        formateur_id: formateurId,
        context: "qa_auto_daily_homework",
        excluded: excludedReport,
        action_taken: `low_quality_ratio_${(validRatio * 100).toFixed(0)}pct`,
      });
      console.warn(`[QA_AUTO][homework] Low ratio ${(validRatio * 100).toFixed(0)}% — devoirs déjà insérés mais avertissement remonté`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalEleves: aiEleves.length,
        totalExercices,
        totalDevoirs,
        totalExcluded,
        excludedReport,
        excludedIds, // RGPD: élèves exclus pour absence de consentement IA
        plan: aiEleves.map((e: any) => ({
          eleve_id: shortToFull[e.eleve_id] || e.eleve_id,
          jours: (e.jours || []).map((j: any) => ({
            jour: j.jour,
            duree: j.duree_totale_minutes,
            exercices: (j.exercices || []).length,
          })),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-daily-homework error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
