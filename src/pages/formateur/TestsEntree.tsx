import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { Sparkles, Volume2, ChevronLeft, ChevronRight, CheckCircle2, Users, Clock, AlertTriangle } from "lucide-react";
import { TCF_QUESTIONS, SECTIONS_META, EXAM_DURATION_SECONDS } from "@/data/tcfQuestions";

/* ───────── Types ───────── */
type Scores = { CO: number; CE: number; EO: number; EE: number };
const COMP_LABELS: Record<keyof Scores, string> = {
  CO: "Compréhension Orale",
  CE: "Compréhension Écrite",
  EO: "Expression Orale",
  EE: "Expression Écrite",
};
const COMP_KEYS = Object.keys(COMP_LABELS) as (keyof Scores)[];

/* ───────── TTS helper ───────── */
function speak(text: string) {
  if (!("speechSynthesis" in window)) {
    toast.error("Votre navigateur ne supporte pas la synthèse vocale.");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find((v) => v.lang.startsWith("fr"));
  if (fr) u.voice = fr;
  window.speechSynthesis.speak(u);
}

/* ───────── Timer helper ───────── */
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ───────── Formateur Evaluation Section ───────── */
function EvaluationFormateur() {
  const [scores, setScores] = useState<Scores>({ CO: 50, CE: 50, EO: 50, EE: 50 });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedEleve, setSelectedEleve] = useState<string>("");
  const { user } = useAuth();

  const { data: eleves, isLoading: loadingEleves } = useQuery({
    queryKey: ["formateur-eleves", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id")
        .eq("formateur_id", user!.id);
      if (!groups?.length) return [];
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, profiles:eleve_id(id, prenom, nom)")
        .in("group_id", groups.map((g) => g.id));
      if (!members) return [];
      const unique = new Map<string, { id: string; prenom: string; nom: string }>();
      members.forEach((m: any) => {
        if (m.profiles && !unique.has(m.profiles.id)) {
          unique.set(m.profiles.id, m.profiles);
        }
      });
      return Array.from(unique.values());
    },
    enabled: !!user,
  });

  const radarData = useMemo(
    () => COMP_KEYS.map((k) => ({ competence: k, score: scores[k], fullMark: 100 })),
    [scores],
  );

  const moyenne = Math.round(COMP_KEYS.reduce((s, k) => s + scores[k], 0) / 4);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const eleveObj = eleves?.find((e) => e.id === selectedEleve);
      const { data, error } = await supabase.functions.invoke("analyze-test-entree", {
        body: { scores, eleveNom: eleveObj ? `${eleveObj.prenom} ${eleveObj.nom}` : null },
      });
      if (error) throw error;
      setAnalysis(data.analysis);
      toast.success("Analyse générée avec succès");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  const niveauEstime = moyenne >= 80 ? "B1" : moyenne >= 60 ? "A2" : moyenne >= 30 ? "A1" : "A0";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-[200px] max-w-xs">
              {loadingEleves ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedEleve} onValueChange={setSelectedEleve}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un élève" />
                  </SelectTrigger>
                  <SelectContent>
                    {eleves?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.prenom} {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Badge variant="outline" className="text-base px-3 py-1">
              Niveau estimé : <span className="font-bold ml-1">{niveauEstime}</span>
            </Badge>
            <Badge variant="secondary" className="text-base px-3 py-1">
              Moyenne : {moyenne}/100
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Évaluation par compétence</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {COMP_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{COMP_LABELS[key]}</label>
                  <span className="text-sm font-bold tabular-nums w-12 text-right">{scores[key]}</span>
                </div>
                <Slider value={[scores[key]]} onValueChange={([v]) => setScores((p) => ({ ...p, [key]: v }))} max={100} step={1} className="w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Profil de compétences</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="competence" tick={{ fontSize: 14 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Button onClick={handleAnalyze} disabled={analyzing} className="w-full sm:w-auto gap-2">
            <Sparkles className="h-4 w-4" />
            {analyzing ? "Analyse en cours…" : "Générer l'analyse IA"}
          </Button>
          {analysis && (
            <div className="mt-6 prose prose-sm max-w-none bg-muted/50 rounded-lg p-6 border">
              {analysis.split("\n").map((line, i) => {
                if (line.startsWith("###")) return <h4 key={i} className="text-base font-semibold mt-4 mb-1">{line.replace(/^###\s*/, "")}</h4>;
                if (line.startsWith("##")) return <h3 key={i} className="text-lg font-bold mt-4 mb-1">{line.replace(/^##\s*/, "")}</h3>;
                if (line.startsWith("#")) return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace(/^#\s*/, "")}</h2>;
                if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="text-sm leading-relaxed">{line}</p>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Student Test Section (TCF Official — 80 questions, 90 min) ───────── */
function PassationTest() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(TCF_QUESTIONS.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [sectionIntro, setSectionIntro] = useState(true);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = TCF_QUESTIONS[current];
  const prevSection = current > 0 ? TCF_QUESTIONS[current - 1].section : null;
  const isNewSection = q.section !== prevSection;
  const meta = SECTIONS_META[q.section];

  // Section progress
  const sectionStart = TCF_QUESTIONS.findIndex((qq) => qq.section === q.section);
  const sectionTotal = meta.total;
  const sectionIndex = current - sectionStart + 1;

  // Timer
  useEffect(() => {
    if (started && !submitted) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [started, submitted]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && started && !submitted) {
      doSubmit();
    }
  }, [timeLeft, started, submitted]);

  const doSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitted(true);
    const score = answers.reduce<number>(
      (acc, a, i) => acc + (a === TCF_QUESTIONS[i].correct ? 1 : 0), 0,
    );
    if (timeLeft === 0) {
      toast.error("Temps écoulé ! Le test est terminé automatiquement.");
    } else {
      toast.success(`Test terminé ! Score : ${score}/${TCF_QUESTIONS.length}`);
    }
  }, [answers, timeLeft]);

  const handleAnswer = (idx: number) => {
    if (submitted) return;
    setAnswers((prev) => { const copy = [...prev]; copy[current] = idx; return copy; });
  };

  const handleNext = () => {
    if (current < TCF_QUESTIONS.length - 1) {
      const nextQ = TCF_QUESTIONS[current + 1];
      if (nextQ.section !== q.section) setSectionIntro(true);
      setCurrent((c) => c + 1);
    }
  };

  const isUrgent = timeLeft <= 600; // 10 minutes
  const totalScore = submitted ? answers.reduce<number>((acc, a, i) => acc + (a === TCF_QUESTIONS[i].correct ? 1 : 0), 0) : null;
  const scoreCO = submitted ? TCF_QUESTIONS.reduce((acc, qq, i) => acc + (qq.section === "CO" && answers[i] === qq.correct ? 1 : 0), 0) : 0;
  const scoreStr = submitted ? TCF_QUESTIONS.reduce((acc, qq, i) => acc + (qq.section === "Structures" && answers[i] === qq.correct ? 1 : 0), 0) : 0;
  const scoreCE = submitted ? TCF_QUESTIONS.reduce((acc, qq, i) => acc + (qq.section === "CE" && answers[i] === qq.correct ? 1 : 0), 0) : 0;

  // Welcome screen
  if (!started) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-primary p-8 text-center text-primary-foreground">
          <h2 className="text-2xl font-bold">TCF IRN — Simulateur officiel</h2>
          <p className="mt-2 text-primary-foreground/80">Test de Connaissance du Français</p>
        </div>
        <CardContent className="pt-8 space-y-6 text-center">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">30</p>
              <p className="text-sm text-muted-foreground mt-1">🎧 Compréhension Orale</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">10</p>
              <p className="text-sm text-muted-foreground mt-1">📝 Structures</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">40</p>
              <p className="text-sm text-muted-foreground mt-1">📖 Compréhension Écrite</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Durée : 1h30 (90 minutes)</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Le chronomètre démarre dès que vous cliquez sur « Commencer ». Le test se termine automatiquement à la fin du temps imparti.
          </p>
          <Button size="lg" onClick={() => setStarted(true)} className="text-lg px-10">
            Commencer le test
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Section intro screen
  if (sectionIntro && isNewSection && !submitted) {
    return (
      <div className="space-y-4">
        {/* Timer always visible */}
        <TimerBar timeLeft={timeLeft} isUrgent={isUrgent} />
        <Card className="overflow-hidden">
          <div className={`${meta.color} p-6 text-center`}>
            <span className="text-5xl">{meta.icon}</span>
          </div>
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-bold">{meta.title}</h2>
            <p className="text-muted-foreground text-base">{meta.description}</p>
            <p className="text-sm text-muted-foreground">
              {sectionTotal} questions dans cette partie
            </p>
            <Button onClick={() => setSectionIntro(false)} size="lg" className="mt-4">
              Commencer <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timer + Section indicator */}
      <TimerBar timeLeft={timeLeft} isUrgent={isUrgent} />

      {/* Section progress header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{meta.icon}</span>
              <span className="font-semibold text-sm">{meta.title}</span>
              <span className="text-sm text-muted-foreground">—</span>
              <span className="font-bold text-sm">Question {sectionIndex} / {sectionTotal}</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {current + 1}/{TCF_QUESTIONS.length} total
            </Badge>
          </div>
          {/* Section mini-progress */}
          <div className="flex gap-0.5">
            {Array.from({ length: sectionTotal }).map((_, i) => {
              const globalIdx = sectionStart + i;
              return (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    globalIdx === current
                      ? "bg-primary"
                      : answers[globalIdx] !== null
                        ? submitted
                          ? answers[globalIdx] === TCF_QUESTIONS[globalIdx].correct ? "bg-success" : "bg-destructive"
                          : "bg-primary/40"
                        : "bg-muted"
                  }`}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Question card */}
      <Card>
        <CardContent className="pt-6">
          {q.section === "CO" && q.audio && (
            <div className="flex flex-col items-center gap-3 mb-6 p-6 bg-muted/50 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground font-medium">🎧 Cliquez pour écouter</p>
              <Button variant="outline" size="lg" onClick={() => speak(q.audio!)} className="gap-2 text-base px-8">
                <Volume2 className="h-5 w-5 text-primary" /> Écouter l'audio
              </Button>
              <p className="text-base font-medium mt-2">{q.question}</p>
            </div>
          )}

          {q.section === "CE" && q.visual && (
            <div className="mb-6 p-5 bg-card border-2 border-dashed border-muted-foreground/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Document</p>
              <div className="text-lg font-medium whitespace-pre-line leading-relaxed">{q.visual}</div>
              <div className="flex items-center gap-2 mt-4">
                <p className="text-base font-medium flex-1">{q.question}</p>
                <Button variant="ghost" size="icon" onClick={() => speak(`${q.visual}. ${q.question}`)} title="Écouter">
                  <Volume2 className="h-5 w-5 text-primary" />
                </Button>
              </div>
            </div>
          )}

          {q.section === "Structures" && (
            <div className="mb-6">
              <div className="flex items-start gap-3">
                <p className="text-lg font-medium leading-relaxed flex-1">
                  {q.question.split("___").map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block mx-1 px-4 py-0.5 border-b-2 border-primary bg-primary/5 rounded text-primary font-bold min-w-[60px] text-center">
                          {answers[current] !== null ? q.options[answers[current]!].label : "___"}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
                <Button variant="ghost" size="icon" onClick={() => speak(q.question.replace("___", "blanc"))} title="Écouter">
                  <Volume2 className="h-5 w-5 text-primary" />
                </Button>
              </div>
            </div>
          )}

          <div className={`${q.section === "CO" ? "grid grid-cols-2 gap-3" : "space-y-3"}`}>
            {q.options.map((opt, idx) => {
              const selected = answers[current] === idx;
              const isCorrect = submitted && idx === q.correct;
              const isWrong = submitted && selected && idx !== q.correct;
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={submitted}
                  className={`w-full flex items-center gap-3 rounded-lg border text-left transition-all ${
                    q.section === "CO" ? "p-5 flex-col text-center justify-center" : "p-4"
                  } ${
                    isCorrect ? "border-success bg-success/10"
                    : isWrong ? "border-destructive bg-destructive/10"
                    : selected ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  {q.section === "CO" && opt.emoji && <span className="text-3xl">{opt.emoji}</span>}
                  <span className={`font-medium text-[15px] ${q.section === "CO" ? "text-center" : ""}`}>{opt.label}</span>
                  {q.section !== "CO" && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); speak(opt.label); }} className="shrink-0 h-8 w-8 ml-auto" title="Écouter">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        {current === TCF_QUESTIONS.length - 1 && !submitted ? (
          <Button onClick={doSubmit} disabled={answers[current] === null}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Soumettre le test
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={answers[current] === null}>
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Results */}
      {submitted && totalScore !== null && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-2xl font-bold text-center">Score global : {totalScore}/{TCF_QUESTIONS.length}</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">🎧 CO</p>
                <p className="text-lg font-bold">{scoreCO}/30</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">📝 Structures</p>
                <p className="text-lg font-bold">{scoreStr}/10</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">📖 CE</p>
                <p className="text-lg font-bold">{scoreCE}/40</p>
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              {totalScore >= 64 ? "Excellent !" : totalScore >= 48 ? "Bon niveau !" : totalScore >= 32 ? "Des points à retravailler." : "Accompagnement renforcé recommandé."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────── Timer Bar Component ───────── */
function TimerBar({ timeLeft, isUrgent }: { timeLeft: number; isUrgent: boolean }) {
  return (
    <Card className={`border-2 ${isUrgent ? "border-destructive bg-destructive/5" : "border-transparent"}`}>
      <CardContent className="py-3 flex items-center justify-center gap-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-destructive" : "text-foreground"}`}>
          {formatTime(timeLeft)}
        </span>
        {isUrgent && <span className="text-sm text-destructive font-medium">Temps presque écoulé !</span>}
      </CardContent>
    </Card>
  );
}

/* ───────── Main Page ───────── */
const TestsEntreePage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tests d'entrée</h1>
        <p className="text-muted-foreground mt-1">
          Évaluez vos élèves et prévisualisez le test de positionnement.
        </p>
      </div>

      <Tabs defaultValue="evaluation">
        <TabsList>
          <TabsTrigger value="evaluation">Évaluation Formateur</TabsTrigger>
          <TabsTrigger value="passation">Passage du Test (Aperçu)</TabsTrigger>
        </TabsList>

        <TabsContent value="evaluation" className="mt-4">
          <EvaluationFormateur />
        </TabsContent>

        <TabsContent value="passation" className="mt-4">
          <PassationTest />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestsEntreePage;
