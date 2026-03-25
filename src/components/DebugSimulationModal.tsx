import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, Bug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";

type StepStatus = "pending" | "running" | "done" | "error";

interface Step {
  label: string;
  status: StepStatus;
  detail?: string;
}

const INITIAL_STEPS: Step[] = [
  { label: "Simulation de la Séance", status: "pending" },
  { label: "Bilan de Séance", status: "pending" },
  { label: "Génération des Devoirs (IA)", status: "pending" },
  { label: "Simulation des Devoirs", status: "pending" },
  { label: "Rapport Final", status: "pending" },
];

export function DebugSimulationModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS.map((s) => ({ ...s })));

  const updateStep = (index: number, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const runSimulation = useCallback(async () => {
    if (!user) return;
    setRunning(true);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));

    try {
      // ── Prep: find a group & session with exercises ──
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom")
        .eq("formateur_id", user.id)
        .eq("is_active", true)
        .limit(1);

      if (!groups?.length) throw new Error("Aucun groupe actif trouvé. Crée un groupe d'abord.");
      const group = groups[0];

      // Find a session with exercises, or the latest session
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, titre, niveau_cible, group_id")
        .eq("group_id", group.id)
        .order("date_seance", { ascending: false })
        .limit(5);

      if (!sessions?.length) throw new Error("Aucune séance trouvée pour ce groupe.");

      let sessionId = sessions[0].id;
      let sessionTitle = sessions[0].titre;
      let niveauCible = sessions[0].niveau_cible;

      // Get exercises linked to this session
      const { data: sessionExercices } = await supabase
        .from("session_exercices")
        .select("exercice_id, exercices(id, titre, competence, format, consigne, contenu, difficulte, niveau_vise, formateur_id, point_a_maitriser_id)")
        .eq("session_id", sessionId);

      let exercices = (sessionExercices || [])
        .map((se: any) => se.exercices)
        .filter(Boolean);

      // If no exercises, generate some via the AI
      if (exercices.length === 0) {
        updateStep(0, { status: "running", detail: "Aucun exercice trouvé, génération IA en cours…" });

        // Get a random point_a_maitriser
        const { data: points } = await supabase
          .from("points_a_maitriser")
          .select("id, nom, sous_section_id, sous_sections(epreuve_id, epreuves(competence))")
          .limit(1);

        const point = points?.[0];
        if (!point) throw new Error("Aucun point à maîtriser trouvé dans le référentiel.");

        const competence = (point as any).sous_sections?.epreuves?.competence || "CE";

        const { data: genData, error: genError } = await supabase.functions.invoke("generate-exercises", {
          body: { pointName: point.nom, competence, niveauVise: niveauCible, count: 4, difficultyLevel: 5 },
        });
        if (genError) throw new Error(`Erreur génération exercices : ${genError.message}`);

        const generated = genData?.exercises || genData || [];
        // Insert them into the DB
        const insertedExercices = [];
        for (const ex of generated.slice(0, 4)) {
          const { data: inserted, error: insErr } = await supabase
            .from("exercices")
            .insert({
              titre: ex.titre,
              consigne: ex.consigne,
              format: ex.format || "qcm",
              competence: competence as any,
              difficulte: ex.difficulte || 5,
              contenu: ex.contenu as Json,
              niveau_vise: niveauCible,
              formateur_id: user.id,
              point_a_maitriser_id: point.id,
              is_ai_generated: true,
              animation_guide: ex.animation_guide ? (ex.animation_guide as Json) : null,
            })
            .select()
            .single();
          if (inserted) {
            insertedExercices.push(inserted);
            await supabase.from("session_exercices").insert({ session_id: sessionId, exercice_id: inserted.id, ordre: insertedExercices.length });
          }
        }
        exercices = insertedExercices;
      }

      if (exercices.length === 0) throw new Error("Impossible de récupérer ou générer des exercices.");

      // Find or pick an eleve in the group
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, profiles(id, prenom, nom)")
        .eq("group_id", group.id)
        .limit(1);

      if (!members?.length) throw new Error("Aucun élève dans ce groupe.");
      const eleve = members[0];
      const eleveId = eleve.eleve_id;
      const eleveNom = `${(eleve as any).profiles?.prenom || "Élève"} ${(eleve as any).profiles?.nom || "Test"}`;

      // ───────────────────────────────────────────────
      // ÉTAPE 1 : Simulation de la Séance
      // ───────────────────────────────────────────────
      updateStep(0, { status: "running", detail: "Simulation des réponses…" });

      const totalEx = exercices.length;
      const answeredCount = Math.max(1, Math.ceil(totalEx * 0.75));
      const answeredExercices = exercices.slice(0, answeredCount);
      const scores: { exerciceId: string; score: number; competence: string; titre: string }[] = [];

      for (const ex of answeredExercices) {
        const items = (ex.contenu as any)?.items || [];
        const score = Math.round(20 + Math.random() * 70); // random 20-90

        await supabase.from("resultats").insert({
          exercice_id: ex.id,
          eleve_id: eleveId,
          score,
          reponses_eleve: { simulated: true } as Json,
          correction_detaillee: { simulated: true, items_count: items.length } as Json,
          tentative: 1,
        });
        scores.push({ exerciceId: ex.id, score, competence: ex.competence, titre: ex.titre });
      }

      // Mark session exercises as treated
      for (const ex of answeredExercices) {
        await supabase
          .from("session_exercices")
          .update({ statut: "traite_en_classe" as any })
          .eq("session_id", sessionId)
          .eq("exercice_id", ex.id);
      }

      const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);
      updateStep(0, {
        status: "done",
        detail: `✅ ${answeredCount}/${totalEx} exercices simulés. Score moyen : ${avgScore}%. Scores : ${scores.map((s) => `${s.titre}: ${s.score}%`).join(", ")}`,
      });

      // ───────────────────────────────────────────────
      // ÉTAPE 2 : Bilan de Séance
      // ───────────────────────────────────────────────
      updateStep(1, { status: "running", detail: "Génération du bilan IA…" });

      const exercicesForBilan = answeredExercices.map((ex: any) => ({
        titre: ex.titre,
        competence: ex.competence,
        format: ex.format,
        niveau_vise: ex.niveau_vise,
        consigne: ex.consigne,
      }));

      const { data: bilanData, error: bilanError } = await supabase.functions.invoke("generate-bilan-test", {
        body: { exercices: exercicesForBilan, sessionTitle, niveauCible },
      });

      if (bilanError) throw new Error(`Erreur bilan : ${bilanError.message}`);

      const bilanQuestions = bilanData?.questions || bilanData || [];
      const nbQuestions = Array.isArray(bilanQuestions) ? bilanQuestions.length : 0;

      // Compute scores by competence from simulation
      const scoresByComp: Record<string, number[]> = {};
      for (const s of scores) {
        if (!scoresByComp[s.competence]) scoresByComp[s.competence] = [];
        scoresByComp[s.competence].push(s.score);
      }
      const compSummary = Object.entries(scoresByComp)
        .map(([c, vals]) => `${c}: ${Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)}%`)
        .join(" | ");

      updateStep(1, {
        status: "done",
        detail: `✅ Bilan généré : ${nbQuestions} questions. Scores par compétence : ${compSummary}`,
      });

      // ───────────────────────────────────────────────
      // ÉTAPE 3 : Génération des Devoirs (IA)
      // ───────────────────────────────────────────────
      updateStep(2, { status: "running", detail: "Génération des devoirs ciblés…" });

      // Use existing business logic: create devoirs for low-scoring exercises
      const devoirsCreated: any[] = [];
      const weakExercises = scores.filter((s) => s.score < 60);

      // Check current active devoirs count
      const { count: activeDevoirs } = await supabase
        .from("devoirs")
        .select("id", { count: "exact", head: true })
        .eq("eleve_id", eleveId)
        .eq("statut", "en_attente");

      const maxDevoirs = 3;
      const slotsAvailable = maxDevoirs - (activeDevoirs || 0);

      for (const weak of weakExercises.slice(0, Math.max(0, slotsAvailable))) {
        const raison = weak.score < 40 ? "remediation" : "consolidation";
        const { data: devoir, error: devErr } = await supabase
          .from("devoirs")
          .insert({
            eleve_id: eleveId,
            exercice_id: weak.exerciceId,
            formateur_id: user.id,
            raison: raison as any,
            statut: "en_attente" as any,
          })
          .select()
          .single();
        if (devoir) devoirsCreated.push({ ...devoir, titre: weak.titre, competence: weak.competence });
      }

      const devoirsSummary = devoirsCreated.length > 0
        ? devoirsCreated.map((d) => `"${d.titre}" (${d.competence}, ${d.raison})`).join(", ")
        : "Aucun devoir nécessaire (scores suffisants ou quota atteint)";

      updateStep(2, {
        status: "done",
        detail: `✅ ${devoirsCreated.length} devoirs générés : ${devoirsSummary}`,
      });

      // ───────────────────────────────────────────────
      // ÉTAPE 4 : Simulation des Devoirs
      // ───────────────────────────────────────────────
      updateStep(3, { status: "running", detail: "Simulation des réponses aux devoirs…" });

      for (const devoir of devoirsCreated) {
        const score = Math.round(50 + Math.random() * 45); // 50-95
        await supabase.from("resultats").insert({
          exercice_id: devoir.exercice_id,
          eleve_id: eleveId,
          devoir_id: devoir.id,
          score,
          reponses_eleve: { simulated: true, devoir: true } as Json,
          correction_detaillee: { simulated: true } as Json,
          tentative: 1,
        });
        // Update devoir status
        await supabase.from("devoirs").update({ statut: "fait" as any }).eq("id", devoir.id);
      }

      updateStep(3, {
        status: "done",
        detail: `✅ ${devoirsCreated.length} devoirs simulés comme terminés.`,
      });

      // ───────────────────────────────────────────────
      // ÉTAPE 5 : Rapport Final
      // ───────────────────────────────────────────────
      updateStep(4, { status: "running", detail: "Génération du rapport de progression IA…" });

      // Fetch profil_eleve
      const { data: profil } = await supabase
        .from("profils_eleves")
        .select("*")
        .eq("eleve_id", eleveId)
        .maybeSingle();

      // Fetch recent results
      const { data: recentResults } = await supabase
        .from("resultats")
        .select("score, exercice_id, exercices(titre, competence, difficulte)")
        .eq("eleve_id", eleveId)
        .order("created_at", { ascending: false })
        .limit(10);

      const formattedResults = (recentResults || []).map((r: any) => ({
        titre: r.exercices?.titre || "Exercice",
        competence: r.exercices?.competence || "CE",
        difficulte: r.exercices?.difficulte || 3,
        score: r.score,
      }));

      const { data: reportData, error: reportError } = await supabase.functions.invoke("analyze-student-progress", {
        body: {
          eleveNom,
          profil: profil || { niveau_actuel: "A1", taux_reussite_global: avgScore, taux_reussite_co: 0, taux_reussite_ce: 0, taux_reussite_ee: 0, taux_reussite_eo: 0, score_risque: 0 },
          levels: [],
          recentResults: formattedResults,
          failures: weakExercises.map((w) => ({ titre: w.titre, competence: w.competence, score: w.score, count: 1 })),
        },
      });

      if (reportError) throw new Error(`Erreur rapport : ${reportError.message}`);

      const reportText = typeof reportData === "string" ? reportData : reportData?.analysis || reportData?.text || JSON.stringify(reportData, null, 2);

      updateStep(4, {
        status: "done",
        detail: `✅ Rapport final :\n\n${reportText}`,
      });
    } catch (err: any) {
      console.error("Simulation error:", err);
      const failedIdx = steps.findIndex((s) => s.status === "running");
      if (failedIdx >= 0) {
        updateStep(failedIdx, { status: "error", detail: `❌ Erreur : ${err.message}` });
      }
    } finally {
      setRunning(false);
    }
  }, [user]);

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 inline-block" />;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-xs"
        onClick={() => {
          setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
          setOpen(true);
        }}
      >
        <Bug className="h-4 w-4" />
        Simuler le flux complet (Debug)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Test de la chaîne pédagogique
            </DialogTitle>
            <DialogDescription>
              Exécution séquentielle des 5 étapes de la boucle pédagogique avec les fonctions existantes.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 min-h-0">
            <div className="space-y-4 py-2">
              {steps.map((step, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    {statusIcon(step.status)}
                    <span className="font-medium text-sm">
                      Étape {i + 1} : {step.label}
                    </span>
                    <Badge
                      variant={
                        step.status === "done" ? "default" :
                        step.status === "error" ? "destructive" :
                        step.status === "running" ? "secondary" : "outline"
                      }
                      className="ml-auto text-xs"
                    >
                      {step.status === "pending" ? "En attente" :
                       step.status === "running" ? "En cours…" :
                       step.status === "done" ? "Terminé" : "Erreur"}
                    </Badge>
                  </div>
                  {step.detail && (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-60 overflow-auto font-mono leading-relaxed">
                      {step.detail}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              Fermer
            </Button>
            <Button onClick={runSimulation} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
              {running ? "Simulation en cours…" : "Lancer la simulation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
