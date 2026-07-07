import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createProceduralDiagnosticTest } from "@/lib/diagnosticFallback";
import {
  buildAdaptiveExercisePlan,
  type CompetencePerf,
} from "@/lib/adaptiveExercisePlan";
import {
  fetchCurriculumExercicesForTrainingSession,
  linkCurriculumExercicesToSession,
  pickCurriculumExercicesForPilot,
} from "@/lib/curriculum/exerciseBridge";

interface PrepareArgs {
  sessionId: string;
  groupId: string;
  niveauCible: string;
  competencesCibles: string[] | null;
  objectifs: string | null;
  titre: string;
  formateurId: string;
  typeDemarche?: string;
  sessionExercisesTargetId?: string;
  homeworkSourceSessionId?: string;
}

/**
 * Auto-préparation d'une séance dès sa création :
 *  - 5 exercices auto-générés rattachés à la séance (pool commun)
 *  - 1 test de prédiagnostic prêt à envoyer aux élèves
 * (La rétrospective de la séance précédente est déjà calculée à la volée
 *  par <StartOfSessionBilan/> sur le SessionPilot, donc rien à pré-générer.)
 *
 * Fire-and-forget : on n'attend pas la fin pour ne pas bloquer l'UX.
 */
export function prepareSessionKit(args: PrepareArgs) {
  toast.info("Préparation auto de la séance…", {
    description: args.sessionExercisesTargetId
      ? "Génération du prédiagnostic et rattachement des exercices à la séance précédente."
      : "Génération du prédiagnostic et de 5 exercices en arrière-plan.",
    duration: 4000,
  });

  // Lance les deux préparations en parallèle sans bloquer.
  void Promise.allSettled([
    generatePrediagnostic(args),
    generateFiveExercises(args),
    generateHomeworkSeriesForPreviousSession(args),
  ]).then((results) => {
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length === 0) {
      toast.success("Séance prête !", {
        description: "Prédiagnostic et 5 exercices disponibles dans Piloter la séance.",
      });
    } else if (failed.length === results.length) {
      toast.error("La préparation auto a échoué. Vous pouvez la relancer depuis Piloter la séance.");
    } else {
      toast.warning("Préparation partielle. Vérifiez la séance.");
    }
  });
}

async function generatePrediagnostic({
  sessionId,
  groupId,
  niveauCible,
  competencesCibles,
}: PrepareArgs) {
  // Évite les doublons si déjà préparé.
  const { data: existing } = await supabase
    .from("bilan_tests")
    .select("id")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const competences =
    competencesCibles && competencesCibles.length > 0 ? competencesCibles : ["CE", "CO"];

  await createProceduralDiagnosticTest({
    sessionId,
    groupId,
    competences,
    niveau: niveauCible || "A1",
    statut: "pret",
  });
}

/**
 * Calcule la performance par compétence à partir des résultats des devoirs
 * d'une séance donnée (évaluation des devoirs faits ENTRE les deux séances
 * précédentes). Sert de base à la génération adaptative.
 */
async function loadPreviousHomeworkPerformance(sessionId?: string): Promise<CompetencePerf[]> {
  if (!sessionId) return [];

  const { data: devoirs } = await supabase
    .from("devoirs")
    .select("id, exercice:exercices(competence)")
    .eq("session_id", sessionId);

  if (!devoirs || devoirs.length === 0) return [];

  const devoirCompetence = new Map<string, string>();
  for (const d of devoirs as any[]) {
    const comp = d.exercice?.competence;
    if (comp) devoirCompetence.set(d.id, comp);
  }

  const devoirIds = (devoirs as any[]).map((d) => d.id);
  const { data: resultats } = await supabase
    .from("resultats")
    .select("score, devoir_id")
    .in("devoir_id", devoirIds);

  if (!resultats || resultats.length === 0) return [];

  const agg = new Map<string, { sum: number; count: number }>();
  for (const r of resultats as any[]) {
    const comp = devoirCompetence.get(r.devoir_id);
    if (!comp) continue;
    const score = Number(r.score);
    if (!Number.isFinite(score)) continue;
    const entry = agg.get(comp) ?? { sum: 0, count: 0 };
    entry.sum += score;
    entry.count += 1;
    agg.set(comp, entry);
  }

  return [...agg.entries()].map(([competence, { sum, count }]) => ({
    competence,
    avgScore: count > 0 ? sum / count : 0,
    count,
  }));
}

async function generateFiveExercises({
  sessionId,
  groupId,
  sessionExercisesTargetId,
  homeworkSourceSessionId,
  niveauCible,
  competencesCibles,
  objectifs,
  titre,
  formateurId,
  typeDemarche,
}: PrepareArgs) {
  const targetSessionId = sessionExercisesTargetId || sessionId;

  // Évite de regénérer si la séance a déjà des exercices.
  const { count } = await supabase
    .from("session_exercices")
    .select("id", { count: "exact", head: true })
    .eq("session_id", targetSessionId);
  if ((count ?? 0) > 0) return;

  const { data: sessionRow } = await supabase
    .from("sessions")
    .select("training_session_id, curriculum_palier_cible, training_session:training_sessions(code)")
    .eq("id", targetSessionId)
    .maybeSingle();

  const trainingSessionId = (sessionRow as any)?.training_session_id as string | null | undefined;
  const curriculumPalier = (sessionRow as any)?.curriculum_palier_cible as string | null | undefined;
  const curriculumCode = (sessionRow as any)?.training_session?.code as string | null | undefined;

  if (trainingSessionId) {
    const linked = await tryLinkCurriculumExercises({
      targetSessionId,
      trainingSessionId,
      curriculumCode,
      curriculumPalier,
    });
    if (linked) return;
  }

  const { data: defaultPoint } = await supabase
    .from("points_a_maitriser")
    .select("id")
    .limit(1)
    .single();
  if (!defaultPoint) {
    // Pas de point de référence : on n'insère rien, mais on n'échoue pas non plus.
    return;
  }

  const fallbackCompetences =
    competencesCibles && competencesCibles.length > 0 ? competencesCibles : ["CE"];
  const totalCount = 5;

  // ═══ ADAPTATIF : on cible les faiblesses révélées par les devoirs de la
  // séance précédente (résultats faits entre les deux séances précédentes). ═══
  const perf = await loadPreviousHomeworkPerformance(homeworkSourceSessionId);
  const plan = buildAdaptiveExercisePlan(perf, fallbackCompetences, totalCount);

  const niveau = niveauCible || "A1";
  const objectif = objectifs || titre || "Exercice de séance";

  // Lance les générations IA EN PARALLÈLE (au lieu de séquentiel)
  // pour diviser le temps total par le nombre de compétences.
  const genPromises = plan.map((slot) => {
    if (slot.count <= 0) return Promise.resolve({ comp: slot.competence, generated: [] as any[] });
    return supabase.functions
      .invoke("generate-exercises", {
        body: {
          pointName: slot.adaptive
            ? `${objectif} — remédiation ${slot.competence}`
            : objectif,
          competence: slot.competence,
          niveauVise: niveau,
          count: slot.count,
          difficultyLevel: slot.difficultyLevel,
          // groupId permet au moteur d'exploiter les profils élèves et les
          // erreurs récentes pour une adaptation fine.
          groupId,
          type_demarche: typeDemarche || "titre_sejour",
        },
      })
      .then(({ data, error }) => {
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        return { comp: slot.competence, generated: ((data as any)?.exercises ?? []) as any[] };
      });
  });

  const results = await Promise.all(genPromises);

  const allInserted: { id: string }[] = [];
  for (const { comp, generated } of results) {
    if (generated.length === 0) continue;

    const toInsert = generated.map((ex: any) => ({
      titre: ex.titre,
      consigne: ex.consigne,
      competence: comp as any,
      format: (ex.format || "qcm") as any,
      difficulte: ex.difficulte || 3,
      contenu: ex.contenu || {},
      animation_guide: ex.animation_guide || null,
      niveau_vise: niveau as any,
      formateur_id: formateurId,
      point_a_maitriser_id: defaultPoint.id,
      is_ai_generated: true,
      is_template: false,
      is_devoir: false,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("exercices")
      .insert(toInsert)
      .select("id");
    if (insertErr) throw insertErr;
    allInserted.push(...((inserted as { id: string }[]) ?? []));
  }


  if (allInserted.length === 0) return;

  const links = allInserted.map((ex, i) => ({
    session_id: targetSessionId,
    exercice_id: ex.id,
    ordre: i + 1,
    statut: "planifie" as any,
  }));

  const { error: linkErr } = await supabase.from("session_exercices").insert(links);
  if (linkErr) throw linkErr;
}

async function tryLinkCurriculumExercises({
  targetSessionId,
  trainingSessionId,
  curriculumCode,
  curriculumPalier,
}: {
  targetSessionId: string;
  trainingSessionId: string;
  curriculumCode?: string | null;
  curriculumPalier?: string | null;
}): Promise<boolean> {
  try {
    const bankRows = await fetchCurriculumExercicesForTrainingSession(
      trainingSessionId,
      curriculumCode,
    );
    if (bankRows.length === 0) return false;

    const picked = pickCurriculumExercicesForPilot(bankRows, curriculumPalier, true);
    if (picked.length === 0) return false;

    await linkCurriculumExercicesToSession(
      targetSessionId,
      picked.map((row) => row.id),
    );
    return true;
  } catch (error) {
    console.warn("[prepareSessionKit] curriculum bridge fallback to AI:", error);
    return false;
  }
}

async function generateHomeworkSeriesForPreviousSession({
  homeworkSourceSessionId,
  groupId,
  formateurId,
  typeDemarche,
}: PrepareArgs) {
  if (!homeworkSourceSessionId) return;

  const { count } = await supabase
    .from("devoirs")
    .select("id", { count: "exact", head: true })
    .eq("session_id", homeworkSourceSessionId)
    .eq("contexte", "devoir" as any);
  if ((count ?? 0) > 0) return;

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("eleve_id")
    .eq("group_id", groupId);
  if (membersError) throw membersError;

  const eleveIds = (members ?? []).map((member) => member.eleve_id);
  if (eleveIds.length === 0) return;

  const { data, error } = await supabase.functions.invoke("generate-next-homework-series", {
    body: {
      eleveIds,
      formateurId,
      sessionId: homeworkSourceSessionId,
      targetCount: 5,
      estimatedDuration: 30,
      force: true,
      type_demarche: typeDemarche || "titre_sejour",
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
}
