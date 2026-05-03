// generate-next-homework-series
// Génère la prochaine SÉRIE de devoirs pour une liste d'élèves.
// - Pas d'obligation quotidienne ; échéance souple.
// - Anti-doublon en base + anti-répétition côté prompt IA.
// - validateAndFix conservé.
// - RGPD : consentement IA requis ; pseudonymisation HMAC.
//
// Entrée :
// {
//   eleveIds: string[],
//   formateurId: string,
//   sessionId?: string,
//   targetCount?: number = 5,
//   estimatedDuration?: number = 30,
//   force?: boolean = false,   // réservé formateur/admin
//   type_demarche?: 'titre_sejour' | 'naturalisation'
// }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/ai-client.ts";
import { validateAndFix } from "../_shared/exercise-validator.ts";
import { QA_REVIEW_BLOCK } from "../_shared/qa-prompt.ts";
import { buildPedagogicalDirectives, formatPedagogicalDirectives } from "../_shared/pedagogical-directives.ts";
import {
  checkConsentBatch,
  ensurePseudonymSecretOrLog,
  logAICall,
  getUserIdFromAuth,
} from "../_shared/check-consent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  eleveIds: string[];
  formateurId: string;
  sessionId?: string;
  targetCount?: number;
  estimatedDuration?: number;
  force?: boolean;
  type_demarche?: "titre_sejour" | "naturalisation";
}

interface DuplicateRow { eleve_id: string; titre: string; raison: string; }
interface ExcludedRow { eleve_id: string; raison: string; }
interface AdaptationEntry {
  progression: "augmente" | "consolide" | "remediation" | "demarrage";
  competencesCiblees: string[];
  serie: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
    const eleveIdsInput = Array.isArray(body.eleveIds) ? body.eleveIds.filter(Boolean) : [];
    const formateurId = body.formateurId;
    const sessionId = body.sessionId ?? null;
    const targetCount = Math.min(Math.max(body.targetCount ?? 5, 1), 10);
    const estimatedDuration = Math.min(Math.max(body.estimatedDuration ?? 30, 10), 120);
    const force = body.force === true;

    if (eleveIdsInput.length === 0 || !formateurId) {
      return new Response(
        JSON.stringify({ error: "missing_required_fields", message: "eleveIds et formateurId requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sécurité : seul un formateur/admin peut utiliser force=true
    const triggeredBy = await getUserIdFromAuth(req);
    if (force) {
      if (!triggeredBy) {
        return new Response(JSON.stringify({ error: "unauthorized", reason: "force_requires_auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", triggeredBy);
      const isPriv = (roles ?? []).some((r: any) => r.role === "formateur" || r.role === "admin");
      if (!isPriv) {
        return new Response(JSON.stringify({ error: "forbidden", reason: "force_reserved_to_formateur" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // RGPD : secret + consentement
    const _secretBlock = await ensurePseudonymSecretOrLog("generate-next-homework-series", corsHeaders, null);
    if (_secretBlock) return _secretBlock;

    const consent = await checkConsentBatch(eleveIdsInput);
    let eleveIds = consent.allowedIds;
    const excludedReport: ExcludedRow[] = consent.excludedIds.map((id) => ({ eleve_id: id, raison: "consent_missing" }));

    // Filtre : si pas de force, retirer les élèves qui ont encore des devoirs en_attente
    const skippedBecauseActiveHomework: string[] = [];
    if (!force && eleveIds.length > 0) {
      const { data: actives } = await supabase
        .from("devoirs")
        .select("eleve_id")
        .in("eleve_id", eleveIds)
        .eq("statut", "en_attente");
      const activeSet = new Set((actives ?? []).map((r: any) => r.eleve_id));
      const kept: string[] = [];
      for (const id of eleveIds) {
        if (activeSet.has(id)) skippedBecauseActiveHomework.push(id);
        else kept.push(id);
      }
      eleveIds = kept;
    }

    if (eleveIds.length === 0) {
      await logAICall({
        function_name: "generate-next-homework-series",
        triggered_by_user_id: triggeredBy,
        status: eleveIdsInput.length > 0 && excludedReport.length === eleveIdsInput.length ? "blocked_no_consent" : "skipped",
        data_categories: ["profile", "results"],
        pseudonymization_level: "hmac_sha256",
      });
      return new Response(JSON.stringify({
        success: true,
        totalEleves: 0, totalExercices: 0, totalDevoirs: 0,
        totalDuplicatesSkipped: 0,
        duplicateReport: [],
        skippedBecauseActiveHomework,
        adaptationSummary: {},
        excludedReport,
        message: "Aucun élève éligible à une nouvelle série.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await logAICall({
      function_name: "generate-next-homework-series",
      triggered_by_user_id: triggeredBy,
      status: "ok",
      data_categories: ["profile", "results"],
      pseudonymization_level: "hmac_sha256",
    });

    // ── Contexte session/groupe (optionnel) ──
    let niveauCible = "A1";
    let demarche: string = body.type_demarche ?? "titre_sejour";
    let sessionTitre = "Séance";
    if (sessionId) {
      const { data: s } = await supabase
        .from("sessions")
        .select("id, titre, niveau_cible, group_id, group:groups(type_demarche)")
        .eq("id", sessionId)
        .maybeSingle();
      if (s) {
        sessionTitre = s.titre || sessionTitre;
        niveauCible = s.niveau_cible || niveauCible;
        if (!body.type_demarche) demarche = ((s as any).group?.type_demarche) || demarche;
      }
    }
    const epreuvesObligatoires = demarche === "naturalisation" ? "CO, CE, EE, EO" : "CO, CE";

    // ── Profils & historique par élève ──
    const { data: profils } = await supabase
      .from("profils_eleves")
      .select("eleve_id, niveau_actuel, taux_reussite_co, taux_reussite_ce, taux_reussite_ee, taux_reussite_eo, taux_reussite_structures, priorites_pedagogiques")
      .in("eleve_id", eleveIds);

    let outcomesByEleve = new Map<string, any>();
    if (sessionId) {
      const { data: outcomes } = await supabase
        .from("session_student_outcomes")
        .select("eleve_id, objectif_status, besoin_pedagogique")
        .eq("session_id", sessionId)
        .in("eleve_id", eleveIds);
      outcomesByEleve = new Map((outcomes ?? []).map((outcome: any) => [outcome.eleve_id, outcome]));
    }

    const { data: levels } = await supabase
      .from("student_competency_levels")
      .select("eleve_id, competence, niveau_actuel")
      .in("eleve_id", eleveIds);

    const { data: profileNames } = await supabase
      .from("profiles").select("id, prenom, nom").in("id", eleveIds);

    // 15 derniers résultats par élève (limite globale = eleveIds * 15)
    const { data: results } = await supabase
      .from("resultats")
      .select("eleve_id, exercice_id, score, created_at, exercice:exercices(competence, format, titre, sous_competence)")
      .in("eleve_id", eleveIds)
      .order("created_at", { ascending: false })
      .limit(eleveIds.length * 15);

    // 30 derniers devoirs par élève
    const { data: recentDevoirs } = await supabase
      .from("devoirs")
      .select("eleve_id, statut, serie, source_label, created_at, exercice:exercices(titre, competence, format, difficulte, consigne)")
      .in("eleve_id", eleveIds)
      .order("created_at", { ascending: false })
      .limit(eleveIds.length * 30);

    // Dernière série par élève
    const lastSerieByEleve: Record<string, number> = {};
    for (const eid of eleveIds) lastSerieByEleve[eid] = 0;
    for (const d of recentDevoirs ?? []) {
      const s = (d as any).serie ?? 0;
      const eid = (d as any).eleve_id as string;
      if (s > (lastSerieByEleve[eid] ?? 0)) lastSerieByEleve[eid] = s;
    }

    // Default point_a_maitriser
    const { data: defaultPoint } = await supabase
      .from("points_a_maitriser").select("id").limit(1).single();
    if (!defaultPoint) throw new Error("No points_a_maitriser found");

    // Construction profils synthétiques
    const nameById = new Map<string, string>();
    (profileNames ?? []).forEach((p: any) =>
      nameById.set(p.id, `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || p.id.slice(0, 8)));
    const profileById = new Map<string, any>();
    (profils ?? []).forEach((p: any) => profileById.set(p.eleve_id, p));
    const levelByEleve: Record<string, Record<string, number>> = {};
    (levels ?? []).forEach((l: any) => {
      if (!levelByEleve[l.eleve_id]) levelByEleve[l.eleve_id] = {};
      levelByEleve[l.eleve_id][l.competence] = l.niveau_actuel;
    });

    // Adaptation préliminaire (transmise dans la sortie aussi)
    const adaptationSummary: Record<string, AdaptationEntry> = {};

    const studentBlocks: string[] = [];
    for (const eleveId of eleveIds) {
      const name = nameById.get(eleveId) ?? eleveId.slice(0, 8);
      const myResults = (results ?? []).filter((r: any) => r.eleve_id === eleveId);
      const myDevoirs = (recentDevoirs ?? []).filter((d: any) => d.eleve_id === eleveId);

      // moyenne des 5 derniers
      const last5 = myResults.slice(0, 5);
      const avg = last5.length ? Math.round(last5.reduce((s: number, r: any) => s + (r.score ?? 0), 0) / last5.length) : null;

      // compétences faibles
      const compStats: Record<string, { sum: number; n: number }> = {};
      for (const r of myResults) {
        const c = (r as any).exercice?.competence;
        if (!c) continue;
        if (!compStats[c]) compStats[c] = { sum: 0, n: 0 };
        compStats[c].sum += r.score ?? 0; compStats[c].n++;
      }
      const weakComps = Object.entries(compStats)
        .map(([c, s]) => ({ c, avg: s.n ? Math.round(s.sum / s.n) : 0 }))
        .filter((x) => x.avg < 70).sort((a, b) => a.avg - b.avg).slice(0, 3);

      let progression: AdaptationEntry["progression"];
      if (myResults.length === 0) progression = "demarrage";
      else if (avg !== null && avg >= 80) progression = "augmente";
      else if (avg !== null && avg >= 60) progression = "consolide";
      else progression = "remediation";

      const newSerie = (lastSerieByEleve[eleveId] ?? 0) + 1;
      adaptationSummary[eleveId] = {
        progression,
        competencesCiblees: weakComps.map((w) => w.c),
        serie: newSerie,
      };

      const profile = profileById.get(eleveId);
      const directives = buildPedagogicalDirectives({
        profile,
        outcome: outcomesByEleve.get(eleveId),
        progression,
        weakCompetences: weakComps.map((w) => w.c),
        targetCompetence: weakComps[0]?.c ?? null,
      });
      const lines: string[] = [];
      lines.push(`ÉLÈVE "${name}" (id: ${eleveId.slice(0, 8)})`);
      lines.push(`  Série courante terminée: ${lastSerieByEleve[eleveId]} → nouvelle série: ${newSerie}`);
      if (profile) {
        lines.push(`  Niveau: ${profile.niveau_actuel ?? "?"} | CO=${profile.taux_reussite_co}% CE=${profile.taux_reussite_ce}% EE=${profile.taux_reussite_ee}% EO=${profile.taux_reussite_eo}% Struct=${profile.taux_reussite_structures}%`);
      }
      lines.push(`  Moyenne 5 derniers résultats: ${avg ?? "n/a"}% → adaptation: ${progression}`);
      lines.push(formatPedagogicalDirectives(directives).split("\n").map((line) => `  ${line}`).join("\n"));
      if (weakComps.length) lines.push(`  Compétences faibles ciblées: ${weakComps.map((w) => `${w.c}=${w.avg}%`).join(", ")}`);

      // Historique anti-répétition (30 derniers)
      if (myDevoirs.length) {
        lines.push(`  HISTORIQUE DEVOIRS RÉCENTS À NE PAS REPRODUIRE :`);
        for (const d of myDevoirs.slice(0, 30)) {
          const ex: any = (d as any).exercice;
          if (!ex?.titre) continue;
          lines.push(`    - "${ex.titre}" (${ex.competence}, ${ex.format}, diff ${ex.difficulte}, série ${(d as any).serie ?? 0}, statut ${(d as any).statut})`);
        }
      }
      studentBlocks.push(lines.join("\n"));
    }

    // ── Prompt IA ──
    const systemPrompt = `Tu es un expert en didactique du FLE pour le TCF IRN. Tu génères une SÉRIE de devoirs PERSONNALISÉE par élève.

CIBLE :
- ${targetCount} exercices par élève (volume estimé ${estimatedDuration} minutes au total).
- Pas d'obligation quotidienne : la série est faite au rythme de l'élève.

ADAPTATION :
- score moyen ≥ 80% → augmenter légèrement la difficulté ou varier vers une compétence proche.
- score 60-79% → consolider avec un exercice différent.
- score < 60% → remédiation ciblée avec difficulté adaptée.
- aucun résultat récent → partir du niveau actuel.
- Démarche IRN : ${demarche} — Épreuves obligatoires : ${epreuvesObligatoires}.

DIRECTIVES PEDAGOGIQUES PAR ELEVE :
- Chaque bloc eleve contient des DIRECTIVES PEDAGOGIQUES CONTRAIGNANTES.
- Elles priment sur les regles generales de volume ou de format.
- Si une directive interdit redaction_libre, texte_long ou production_ecrite_longue, ne genere pas ce format pour cet eleve.
- Si descente_competence est presente, travaille d'abord competence_cible avant de revenir a la competence ratee.
- Respecte supports_obligatoires, limites de consigne/items, feedback_type et formats_autorises.

RÈGLE ANTI-RÉPÉTITION STRICTE :
- Tu ne reprends PAS les titres listés dans HISTORIQUE DEVOIRS RÉCENTS.
- Tu ne reformules PAS simplement un exercice récent.
- Si une compétence faible doit être retravaillée, change le format, le contexte ou le type de tâche.
- Évite les thèmes trop proches dans deux séries consécutives.
- Privilégie des contextes variés : travail, santé, logement, transport, démarches administratives, famille, achats, rendez-vous.

RÈGLES LINGUISTIQUES A0/A1 :
- Consigne max 12 mots, impératif simple ("Choisis", "Écoute", "Écris").
- Vocabulaire CECRL A1.
- Phrases courtes (S+V+C).

FORMATS : qcm, vrai_faux, appariement, texte_lacunaire, transformation, production_ecrite, production_orale.
- CO → fournir contenu.script_audio.
- CE → fournir contenu.texte (≥ 20 caractères).
- QCM : bonne_reponse présente dans options (correspondance exacte).` + QA_REVIEW_BLOCK;

    const userPrompt = `Séance "${sessionTitre}" — Niveau ${niveauCible}
Volume cible par élève : ${targetCount} exercices, ~${estimatedDuration} minutes.

PROFILS INDIVIDUELS :
${studentBlocks.join("\n\n")}

Pour chaque élève, génère ${targetCount} exercices respectant strictement la règle anti-répétition.`;

    // Mapping shortId → fullId (conservé)
    const shortToFull: Record<string, string> = {};
    for (const eid of eleveIds) shortToFull[eid.slice(0, 8)] = eid;

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
            name: "generate_next_series",
            description: "Génère la prochaine série de devoirs personnalisée par élève",
            parameters: {
              type: "object",
              properties: {
                eleves: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      eleve_id: { type: "string", description: "First 8 chars of student UUID" },
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
                            raison: { type: "string", enum: ["tronc_commun", "remediation", "consolidation"] },
                            contenu: {
                              type: "object",
                              properties: {
                                texte: { type: "string" },
                                script_audio: { type: "string" },
                                image_description: { type: "string" },
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
                            },
                          },
                          required: ["titre", "consigne", "competence", "format", "difficulte", "contenu", "raison"],
                        },
                      },
                    },
                    required: ["eleve_id", "exercices"],
                  },
                },
              },
              required: ["eleves"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_next_series" } },
    });

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const plan = JSON.parse(toolCall.function.arguments);
    const aiEleves: any[] = plan.eleves || [];

    // ── Insertion ──
    let totalDevoirs = 0;
    let totalExercices = 0;
    let totalDuplicatesSkipped = 0;
    const duplicateReport: DuplicateRow[] = [];

    for (const aiEleve of aiEleves) {
      const fullEleveId = shortToFull[aiEleve.eleve_id] ?? aiEleve.eleve_id;
      if (!eleveIds.includes(fullEleveId)) {
        // Sécurité : on ignore tout id qui n'était pas dans la liste autorisée
        continue;
      }
      const newSerie = adaptationSummary[fullEleveId]?.serie ?? ((lastSerieByEleve[fullEleveId] ?? 0) + 1);

      // Total minutes pour échéance souple
      const totalMinutes = (aiEleve.exercices ?? []).reduce(
        (sum: number, ex: any) => sum + (ex.duree_estimee_minutes ?? 5), 0,
      );
      const days = Math.max(7, Math.ceil(totalMinutes / 30));
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + days);
      deadline.setHours(23, 59, 59, 0);

      for (const ex of aiEleve.exercices ?? []) {
        // Anti-doublon DB
        const titreNorm = (ex.titre ?? "").trim();
        if (titreNorm) {
          const { data: dup } = await supabase
            .from("devoirs")
            .select("id, exercice:exercices!inner(titre, competence)")
            .eq("eleve_id", fullEleveId)
            .eq("statut", "en_attente")
            .ilike("exercice.titre", titreNorm)
            .eq("exercice.competence", ex.competence)
            .limit(1);
          if (dup && dup.length > 0) {
            totalDuplicatesSkipped++;
            duplicateReport.push({ eleve_id: fullEleveId, titre: titreNorm, raison: "doublon_actif" });
            continue;
          }
        }

        // Validation
        const validated = await validateAndFix(
          { ...ex, niveau_vise: niveauCible },
          { niveau: niveauCible, demarche },
        );
        if (!validated) {
          excludedReport.push({ eleve_id: fullEleveId, raison: "validation_failed" });
          continue;
        }
        const validEx = validated.exercise;
        const raison = ex.raison === "remediation" ? "remediation" : "consolidation";
        const sourceLabel = ex.raison === "tronc_commun"
          ? `serie_${newSerie}_tronc_commun`
          : `serie_${newSerie}_individualise`;

        const { data: inserted, error: insErr } = await supabase
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
            eleve_id: fullEleveId,
          })
          .select("id").single();
        if (insErr || !inserted) {
          console.error("Insert exercise failed", insErr);
          continue;
        }
        totalExercices++;

        const { error: devErr } = await supabase.from("devoirs").insert({
          eleve_id: fullEleveId,
          exercice_id: inserted.id,
          formateur_id: formateurId,
          raison,
          statut: "en_attente",
          contexte: "devoir",
          serie: newSerie,
          session_id: sessionId,
          source_label: sourceLabel,
          date_echeance: deadline.toISOString(),
        });
        if (devErr) {
          console.error("Insert devoir failed", devErr);
          continue;
        }
        totalDevoirs++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalEleves: aiEleves.length,
        totalExercices,
        totalDevoirs,
        totalDuplicatesSkipped,
        duplicateReport,
        skippedBecauseActiveHomework,
        adaptationSummary,
        excludedReport,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-next-homework-series error:", e);
    const status = e instanceof AIError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
