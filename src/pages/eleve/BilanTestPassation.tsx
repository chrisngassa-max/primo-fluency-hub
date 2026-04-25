import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfilEleve } from "@/lib/updateProfilEleve";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Send, ChevronRight, ChevronLeft,
  ClipboardCheck, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CompetenceLabel from "@/components/CompetenceLabel";
import TTSAudioPlayer from "@/components/ui/TTSAudioPlayer";

const BilanTestPassation = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    scoreGlobal: number;
    totalQuestions: number;
    correct: number;
    scoresParCompetence: Record<string, { correct: number; total: number; pct: number }>;
    correction: any[];
    devoirsGenerated: number;
  } | null>(null);

  // Fetch the bilan test
  const { data: bilanTest, isLoading } = useQuery({
    queryKey: ["bilan-test-detail", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bilan_tests")
        .select("*, session:sessions(titre, date_seance, niveau_cible, group_id)")
        .eq("id", testId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!testId,
  });

  // Check if already completed
  const { data: existingResult } = useQuery({
    queryKey: ["bilan-test-result", testId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bilan_test_results")
        .select("*")
        .eq("bilan_test_id", testId!)
        .eq("eleve_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!testId && !!user?.id,
  });

  // Normalize question fields (generator uses consigne/support/choix, legacy uses question/script_audio/options)
  const questions: any[] = (bilanTest?.contenu || []).map((q: any) => {
    // Determine the display question text
    let questionText = q.question || q.consigne || "";
    // Determine the audio script for CO questions
    let scriptAudio = q.script_audio || q.support || "";
    
    // If question contains "(Audio)" prefix pattern, extract the audio part
    if (!scriptAudio && questionText && q.competence === "CO") {
      const audioMatch = questionText.match(/^\(Audio\)\s*:\s*"([^"]+)"/i);
      if (audioMatch) {
        scriptAudio = audioMatch[1];
        // Clean up the question to show only the actual question part
        questionText = questionText.replace(/^\(Audio\)\s*:\s*"[^"]+"\s*/i, "").trim();
      }
    }

    return {
      ...q,
      question: questionText,
      script_audio: scriptAudio,
      texte_support: q.texte_support || q.texte || "",
      options: q.options || q.choix || [],
    };
  });
  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = async () => {
    if (!user || !bilanTest || questions.length === 0) return;
    setSubmitting(true);
    try {
      let totalCorrect = 0;
      const compStats: Record<string, { correct: number; total: number }> = {};
      const correction = questions.map((q: any, idx: number) => {
        const userAnswer = answers[idx] || "";
        const isCorrect = userAnswer.trim().toLowerCase() === (q.bonne_reponse || "").trim().toLowerCase();
        if (isCorrect) totalCorrect++;

        if (!compStats[q.competence]) compStats[q.competence] = { correct: 0, total: 0 };
        compStats[q.competence].total++;
        if (isCorrect) compStats[q.competence].correct++;

        return {
          question: q.question,
          competence: q.competence,
          reponse_eleve: userAnswer,
          bonne_reponse: q.bonne_reponse,
          correct: isCorrect,
          explication: q.explication || "",
        };
      });

      const scoreGlobal = Math.round((totalCorrect / questions.length) * 100);
      const scoresParCompetence: Record<string, { correct: number; total: number; pct: number }> = {};
      for (const [comp, stats] of Object.entries(compStats)) {
        scoresParCompetence[comp] = {
          ...stats,
          pct: Math.round((stats.correct / stats.total) * 100),
        };
      }

      // Save result
      const { error: insertErr } = await supabase.from("bilan_test_results").insert({
        bilan_test_id: testId!,
        eleve_id: user.id,
        score_global: scoreGlobal,
        scores_par_competence: scoresParCompetence,
        reponses: answers,
        correction,
      });
      if (insertErr) throw insertErr;

      // Generate targeted homework via AI
      let devoirsGenerated = 0;
      try {
        const { data: devoirData, error: devoirErr } = await supabase.functions.invoke("generate-bilan-devoirs", {
          body: {
            scoresParCompetence,
            niveauCible: bilanTest.session?.niveau_cible || "A1",
            sessionTitle: bilanTest.session?.titre || "Séance",
          },
        });

        if (!devoirErr && devoirData?.devoirs && Array.isArray(devoirData.devoirs)) {
          // Get a point_a_maitriser_id for creating exercises
          const { data: point } = await supabase.from("points_a_maitriser").select("id").limit(1).single();
          const pointId = point?.id;

          if (pointId) {
            // Get the formateur_id from the bilan test
            const formateurId = bilanTest.formateur_id;

            for (const devoir of devoirData.devoirs) {
              // Create the exercise
              const { data: newEx, error: exErr } = await supabase.from("exercices").insert({
                formateur_id: formateurId,
                titre: devoir.titre,
                consigne: devoir.consigne,
                competence: devoir.competence as any,
                format: devoir.format as any,
                niveau_vise: devoir.niveau_vise || "A1",
                contenu: { items: devoir.items || [] },
                point_a_maitriser_id: pointId,
                is_devoir: true,
                is_ai_generated: true,
                eleve_id: user.id,
              }).select("id").single();

              if (!exErr && newEx) {
                const raison = devoir.type_devoir === "renforcement" ? "remediation" : "consolidation";
                const delaiJours = 3; // J+3 par défaut

                await supabase.from("devoirs").insert({
                  eleve_id: user.id,
                  exercice_id: newEx.id,
                  formateur_id: formateurId,
                  session_id: bilanTest.session_id,
                  raison: raison as any,
                  statut: "en_attente" as any,
                  date_echeance: new Date(Date.now() + delaiJours * 86400000).toISOString(),
                });
                devoirsGenerated++;
              }
            }
          }
        }
      } catch (devoirGenErr) {
        console.error("Devoir generation failed:", devoirGenErr);
        // Non-blocking: test result is saved regardless
      }

      // Update student competency status based on test scores
      for (const [comp, stats] of Object.entries(scoresParCompetence)) {
        const statut = stats.pct >= 80 ? "acquis_provisoire" : stats.pct >= 60 ? "consolide" : "non_acquis";
        await supabase.from("student_competency_status").upsert({
          eleve_id: user.id,
          competence: comp as any,
          statut: statut as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: "eleve_id,competence" });
      }

      // Propagate scores to profils_eleves for monitoring visibility
      try {
        await updateProfilEleve(user.id, bilanTest.session?.niveau_cible || "A1");
      } catch (profileErr) {
        console.error("Profile update failed:", profileErr);
      }

      setResult({ scoreGlobal, totalQuestions: questions.length, correct: totalCorrect, scoresParCompetence, correction, devoirsGenerated });
      qc.invalidateQueries({ queryKey: ["eleve-devoirs"] });
      qc.invalidateQueries({ queryKey: ["eleve-bilans-tests"] });
      toast.success(`Test soumis ! Score : ${totalCorrect}/${questions.length}`);
    } catch (e: any) {
      toast.error("Erreur de soumission", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!bilanTest) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-muted-foreground">Test introuvable.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/eleve")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Retour
        </Button>
      </div>
    );
  }

  // Already completed — show stored results
  if (existingResult) {
    const storedScores = existingResult.scores_par_competence || {};
    const storedCorrection = existingResult.correction || [];
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eleve")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-xl font-bold">Résultat — Test de bilan</h1>
        </div>

        <ResultView
          scoreGlobal={Number(existingResult.score_global)}
          totalQuestions={storedCorrection.length}
          correct={storedCorrection.filter((c: any) => c.correct).length}
          scoresParCompetence={storedScores}
          correction={storedCorrection}
          devoirsGenerated={0}
          onNavigateDevoirs={() => navigate("/eleve/devoirs")}
          onNavigateDashboard={() => navigate("/eleve")}
        />
      </div>
    );
  }

  // Show result after submission
  if (result) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eleve")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-xl font-bold">Résultat — Test de bilan</h1>
        </div>
        <ResultView {...result} onNavigateDevoirs={() => navigate("/eleve/devoirs")} onNavigateDashboard={() => navigate("/eleve")} />
      </div>
    );
  }

  // ─── Test passation ───
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/eleve")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div>
          <h1 className="text-xl font-bold">Test de bilan — {bilanTest.session?.titre}</h1>
          <p className="text-sm text-muted-foreground">
            {questions.length} questions · Compétences : {(bilanTest.competences_couvertes || []).join(", ")}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Question {currentIdx + 1} / {questions.length}</span>
          <span>{answeredCount} / {questions.length} répondues</span>
        </div>
        <Progress value={(answeredCount / Math.max(questions.length, 1)) * 100} className="h-2" />
      </div>

      {/* Current question */}
      {currentQ && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Question {currentIdx + 1}
              </CardTitle>
              <Badge variant="outline"><CompetenceLabel code={currentQ.competence} /></Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQ.competence === "CO" && currentQ.script_audio && (
              <TTSAudioPlayer
                text={currentQ.script_audio}
                label="🔊 Écouter l'audio"
                className="mb-2"
              />
            )}
            {currentQ.competence === "CE" && (currentQ.texte_support || currentQ.texte) && (
              <div className="rounded-md border bg-muted/40 p-4 text-base leading-relaxed whitespace-pre-wrap">
                {currentQ.texte_support || currentQ.texte}
              </div>
            )}
            <p className="font-medium text-xl leading-relaxed">{currentQ.question}</p>
            {currentQ.competence !== "CO" && (
              <TTSAudioPlayer
                text={currentQ.consigne || currentQ.question}
                size="sm"
                label="🔊 Écouter la question"
                className="mt-1"
              />
            )}

            {currentQ.format === "texte_lacunaire" || !currentQ.options?.length ? (
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="Ta réponse..."
                value={answers[currentIdx] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentIdx]: e.target.value }))}
              />
            ) : (
              <div className="space-y-2">
                {currentQ.options.map((opt: string, oi: number) => (
                  <button
                    key={oi}
                    className={cn(
                      "btn-reponse-eleve",
                      answers[currentIdx] === opt && "selected"
                    )}
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentIdx]: opt }))}
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    <TTSAudioPlayer text={opt} size="icon" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => i - 1)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <div className="flex-1" />
        {currentIdx < questions.length - 1 ? (
          <Button onClick={() => setCurrentIdx((i) => i + 1)} className="gap-1">
            Suivant <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Valider mes réponses
          </Button>
        )}
      </div>
    </div>
  );
};

// Result view component
function ResultView({
  scoreGlobal, totalQuestions, correct, scoresParCompetence, correction, devoirsGenerated,
  onNavigateDevoirs, onNavigateDashboard,
}: {
  scoreGlobal: number; totalQuestions: number; correct: number;
  scoresParCompetence: Record<string, { correct: number; total: number; pct: number }>;
  correction: any[]; devoirsGenerated: number;
  onNavigateDevoirs: () => void; onNavigateDashboard: () => void;
}) {
  const scoreLabel = scoreGlobal >= 80 ? "Excellent ! 🎉" : scoreGlobal >= 60 ? "Bien !" : "À retravailler";

  return (
    <div className="space-y-6">
      {/* Global score */}
      <Card className={cn(
        "text-center",
        scoreGlobal >= 80 ? "border-green-500/30" : scoreGlobal >= 60 ? "border-orange-500/30" : "border-destructive/30"
      )}>
        <CardContent className="pt-6 pb-4">
          <p className={cn(
            "text-5xl font-black",
            scoreGlobal >= 80 ? "text-green-600" : scoreGlobal >= 60 ? "text-orange-600" : "text-destructive"
          )}>
            {correct}/{totalQuestions}
          </p>
          <p className="text-lg font-medium text-muted-foreground mt-1">{scoreLabel}</p>
          {devoirsGenerated > 0 && (
            <Badge variant="secondary" className="mt-3 gap-1">
              <BookOpen className="h-3 w-3" />
              {`${devoirsGenerated} ${devoirsGenerated === 1 ? "devoir de révision généré" : "devoirs de révision générés"}`}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Score by competence */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score par compétence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(scoresParCompetence).map(([comp, stats]) => (
            <div key={comp} className="flex items-center gap-3">
              <Badge variant="outline" className="w-24 justify-center">
                <CompetenceLabel code={comp} />
              </Badge>
              <div className="flex-1">
                <Progress value={stats.pct} className={cn("h-3",
                  stats.pct >= 80 ? "[&>div]:bg-green-500" : stats.pct >= 60 ? "[&>div]:bg-orange-500" : "[&>div]:bg-destructive"
                )} />
              </div>
              <span className={cn(
                "text-sm font-bold w-20 text-right",
                stats.pct >= 80 ? "text-green-600" : stats.pct >= 60 ? "text-orange-600" : "text-destructive"
              )}>
                {stats.correct}/{stats.total} {stats.pct >= 80 ? "OK" : "À travailler"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Detailed correction */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Corrigé détaillé</h2>
        {correction.map((c: any, i: number) => (
          <Card key={i} className={cn("border-l-4", c.correct ? "border-l-green-500" : "border-l-destructive")}>
            <CardContent className="py-3 px-4 space-y-1">
              <div className="flex items-start gap-2">
                {c.correct ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">{c.question}</p>
                  {!c.correct && (
                    <>
                       <p className="text-xs text-destructive">Ta réponse : {c.reponse_eleve || "—"}</p>
                       <p className="text-xs text-green-600">Bonne réponse : {c.bonne_reponse}</p>
                    </>
                  )}
                  {c.explication && (
                    <p className="text-xs text-muted-foreground italic">{c.explication}</p>
                  )}
                  {c.reformulation_modele && (
                    <div className="mt-1.5 p-2 rounded-md bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-xs">
                      <p className="text-blue-800 dark:text-blue-300">
                        💡 <strong>Ce que tu aurais pu dire :</strong> « {c.reformulation_modele} »
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onNavigateDashboard}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
        </Button>
        <Button onClick={onNavigateDevoirs}>
          Voir mes devoirs <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export default BilanTestPassation;
