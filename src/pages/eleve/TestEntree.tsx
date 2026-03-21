import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Clock,
  ArrowRight, Loader2, Volume2, VolumeX,
} from "lucide-react";
import { TCF_QUESTIONS, SECTIONS_META, type TCFQuestion } from "@/data/tcfQuestions";
import CompetenceLabel from "@/components/CompetenceLabel";

const TestEntreePage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Check if test already exists
  const { data: existingTest, isLoading: testLoading } = useQuery({
    queryKey: ["eleve-test-entree", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tests_entree")
        .select("*")
        .eq("eleve_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Check group membership
  const { data: memberships } = useQuery({
    queryKey: ["eleve-memberships", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("group_id, group:groups(nom)")
        .eq("eleve_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const questions = TCF_QUESTIONS;
  const totalQuestions = questions.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90 * 60); // 1h30
  const [onBreak, setOnBreak] = useState(false); // pause inter-sections

  // Resume from existing in-progress test
  useEffect(() => {
    if (existingTest && existingTest.en_cours) {
      setStarted(true);
      setCurrentIndex(existingTest.derniere_question || 0);
    }
  }, [existingTest]);

  // Timer — paused during breaks
  useEffect(() => {
    if (!started || onBreak || (existingTest && !existingTest.en_cours)) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [started, onBreak, existingTest]);

  // Section boundary indices (last question index of each section)
  const sectionBoundaries = useMemo(() => {
    const boundaries: number[] = [];
    let prevSection = questions[0]?.section;
    for (let i = 1; i < questions.length; i++) {
      if (questions[i].section !== prevSection) {
        boundaries.push(i - 1); // last index of previous section
        prevSection = questions[i].section;
      }
    }
    return boundaries; // e.g. [29, 39] for CO→Structures, Structures→CE
  }, [questions]);

  const currentQuestion = questions[currentIndex];
  const currentSection = currentQuestion?.section;

  // ── TTS (synthèse vocale) ──
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenRef = useRef<number>(-1);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("La synthèse vocale n'est pas prise en charge par ton navigateur.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.85;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find((v) => v.lang.startsWith("fr"));
    if (frVoice) utterance.voice = frVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Auto-play audio when arriving on a CO question
  useEffect(() => {
    if (!started || !currentQuestion) return;
    if (currentQuestion.audio && lastSpokenRef.current !== currentIndex) {
      lastSpokenRef.current = currentIndex;
      const timer = setTimeout(() => speak(currentQuestion.audio!), 400);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, started, currentQuestion, speak]);

  // Stop speech on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const sectionProgress = useMemo(() => {
    const sections = ["CO", "Structures", "CE"] as const;
    return sections.map((s) => {
      const sectionQuestions = questions.filter((q) => q.section === s);
      const answered = sectionQuestions.filter((_, i) => {
        const globalIdx = questions.indexOf(sectionQuestions[i]!);
        return answers[globalIdx] !== undefined;
      }).length;
      return { section: s, total: sectionQuestions.length, answered };
    });
  }, [answers, questions]);

  const handleAnswer = (optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handleStart = async () => {
    try {
      // Create or resume test entry
      if (!existingTest) {
        const { error } = await supabase.from("tests_entree").insert({
          eleve_id: user!.id,
          en_cours: true,
          derniere_question: 0,
        });
        if (error) throw error;
      }
      setStarted(true);
      qc.invalidateQueries({ queryKey: ["eleve-test-entree"] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const handleNext = async () => {
    if (currentIndex < totalQuestions - 1) {
      const next = currentIndex + 1;
      // Check if we're crossing a section boundary → trigger break
      if (sectionBoundaries.includes(currentIndex) && questions[next]?.section !== currentQuestion?.section) {
        setOnBreak(true);
        setCurrentIndex(next);
        await supabase
          .from("tests_entree")
          .update({ derniere_question: next })
          .eq("eleve_id", user!.id);
        return;
      }
      setCurrentIndex(next);
      // Save progress
      await supabase
        .from("tests_entree")
        .update({ derniere_question: next })
        .eq("eleve_id", user!.id);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Calculate scores per section
      const sectionScores: Record<string, { correct: number; total: number }> = {};
      questions.forEach((q, i) => {
        if (!sectionScores[q.section]) sectionScores[q.section] = { correct: 0, total: 0 };
        sectionScores[q.section].total++;
        if (answers[i] === q.correct) sectionScores[q.section].correct++;
      });

      const scoreFor = (s: string) => {
        const sc = sectionScores[s];
        return sc ? Math.round((sc.correct / sc.total) * 100) : 0;
      };

      const scoreCO = scoreFor("CO");
      const scoreCE = scoreFor("CE");
      const scoreStructures = scoreFor("Structures");
      const scoreEE = 0; // No EE section in current questions
      const scoreGlobal = Math.round(
        (scoreCO * 30 + scoreCE * 40 + scoreStructures * 10) /
          (30 + 40 + 10)
      );

      // Estimate level
      let niveauEstime = "A1";
      if (scoreGlobal >= 80) niveauEstime = "B1";
      else if (scoreGlobal >= 60) niveauEstime = "A2";
      else if (scoreGlobal >= 40) niveauEstime = "A1";
      else niveauEstime = "A0";

      const recommandations = [
        scoreCO < 60 && "Compréhension orale : travaille l'écoute active.",
        scoreCE < 60 && "Compréhension écrite : lis des documents du quotidien.",
        scoreStructures < 60 && "Structures : révise la grammaire de base.",
      ]
        .filter(Boolean)
        .join(" ") || "Bon niveau ! Continue tes efforts.";

      const { error } = await supabase
        .from("tests_entree")
        .update({
          en_cours: false,
          completed_at: new Date().toISOString(),
          score_global: scoreGlobal,
          score_co: scoreCO,
          score_ce: scoreCE,
          score_structures: scoreStructures,
          score_ee: scoreEE,
          niveau_estime: niveauEstime,
          recommandations,
          derniere_question: totalQuestions,
        })
        .eq("eleve_id", user!.id);

      if (error) throw error;
      toast.success("Test terminé !");
      qc.invalidateQueries({ queryKey: ["eleve-test-entree"] });
    } catch (e: any) {
      toast.error("Erreur lors de la soumission", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (testLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Show results if test is completed
  if (existingTest && !existingTest.en_cours && existingTest.completed_at) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Résultats du test d'entrée</h1>
          <p className="text-muted-foreground mt-1">Ton évaluation initiale est terminée.</p>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <div>
                <p className="text-3xl font-bold text-foreground">{existingTest.score_global}/100</p>
                <p className="text-muted-foreground">Score global</p>
              </div>
              <Badge className="text-base px-4 py-1">
                Niveau estimé : {existingTest.niveau_estime}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scores par compétence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { code: "CO", score: existingTest.score_co },
              { code: "CE", score: existingTest.score_ce },
              { code: "Structures", score: existingTest.score_structures },
              { code: "EE", score: existingTest.score_ee },
            ].map(({ code, score }) => (
              <div key={code} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <CompetenceLabel code={code} />
                  <span className="font-semibold">{score ?? 0}/100</span>
                </div>
                <Progress value={score ?? 0} className="h-3" />
              </div>
            ))}
          </CardContent>
        </Card>

        {existingTest.recommandations && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{existingTest.recommandations}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Start screen
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test d'entrée TCF IRN</h1>
          <p className="text-muted-foreground mt-1">
            Évalue ton niveau en français. Ce test ne peut être passé qu'une seule fois.
          </p>
        </div>

        {(!memberships || memberships.length === 0) && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Tu peux passer le test maintenant. Ton formateur verra tes résultats
                une fois que tu auras rejoint son groupe.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3">
              {Object.entries(SECTIONS_META).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{meta.title}</p>
                    <p className="text-xs text-muted-foreground">{meta.total} questions — {meta.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Durée : 1h30 maximum</span>
            </div>
            <Button className="w-full gap-2" size="lg" onClick={handleStart}>
              Commencer le test
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passation screen
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Timer + progress */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="gap-1.5 text-base px-3 py-1">
          <Clock className="h-4 w-4" />
          {formatTime(timeLeft)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Question {currentIndex + 1}/{totalQuestions}
        </span>
      </div>
      <Progress value={progressPercent} className="h-2" />

      {/* Section indicator */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{SECTIONS_META[currentSection]?.icon}</span>
        <span className="font-semibold text-sm">{SECTIONS_META[currentSection]?.title}</span>
      </div>

      {/* Question */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {currentQuestion.audio && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full border-primary/30 shrink-0"
                onClick={() => {
                  if (isSpeaking) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  } else {
                    speak(currentQuestion.audio!);
                  }
                }}
              >
                {isSpeaking ? (
                  <VolumeX className="h-5 w-5 text-primary" />
                ) : (
                  <Volume2 className="h-5 w-5 text-primary" />
                )}
              </Button>
              <div className="flex-1">
                <p className="font-semibold text-sm text-primary">🎧 Écoute l'audio</p>
                <p className="text-xs text-muted-foreground">
                  {isSpeaking ? "Lecture en cours… Clique pour arrêter." : "Clique sur le bouton pour réécouter."}
                </p>
              </div>
            </div>
          )}
          {currentQuestion.visual && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-line">
              {currentQuestion.visual}
            </div>
          )}

          <p className="font-semibold text-lg">{currentQuestion.question}</p>

          <div className="space-y-2">
            {currentQuestion.options.map((opt, i) => {
              const isSelected = answers[currentIndex] === i;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
                    <span>{opt.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>

        {currentIndex < totalQuestions - 1 ? (
          <Button onClick={handleNext}>
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Terminer le test
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Quick nav to unanswered */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {answeredCount}/{totalQuestions} questions répondues
        </p>
      </div>
    </div>
  );
};

export default TestEntreePage;
