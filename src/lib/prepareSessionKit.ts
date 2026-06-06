import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const { error, data } = await supabase.functions.invoke("generate-diagnostic-test", {
    body: {
      sessionId,
      groupId,
      competences,
      niveau: niveauCible || "A1",
      statut: "pret",
    },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
}

async function generateFiveExercises({
  sessionId,
  sessionExercisesTargetId,
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

  const { data: defaultPoint } = await supabase
    .from("points_a_maitriser")
    .select("id")
    .limit(1)
    .single();
  if (!defaultPoint) {
    // Pas de point de référence : on n'insère rien, mais on n'échoue pas non plus.
    return;
  }

  const competences =
    competencesCibles && competencesCibles.length > 0 ? competencesCibles : ["CE"];
  const totalCount = 5;
  const perComp = Math.max(1, Math.floor(totalCount / competences.length));
  const remainder = totalCount - perComp * competences.length;

  const allInserted: { id: string }[] = [];
  const niveau = niveauCible || "A1";
  const objectif = objectifs || titre || "Exercice de séance";

  for (let ci = 0; ci < competences.length; ci++) {
    const comp = competences[ci];
    const compCount = perComp + (ci < remainder ? 1 : 0);
    if (compCount <= 0) continue;

    const { data, error } = await supabase.functions.invoke("generate-exercises", {
      body: {
        pointName: objectif,
        competence: comp,
        niveauVise: niveau,
        count: compCount,
        difficultyLevel: 3,
        type_demarche: typeDemarche || "titre_sejour",
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);

    const generated = (data as any)?.exercises ?? [];
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
