import { useState, useMemo, useCallback } from "react";
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
import { Sparkles, Volume2, ChevronLeft, ChevronRight, CheckCircle2, Users } from "lucide-react";

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

/* ───────── Sample QCM data for demo ───────── */
const SAMPLE_QUESTIONS = [
  {
    question: "Quel document devez-vous apporter à la préfecture pour renouveler votre titre de séjour ?",
    options: ["Un passeport valide", "Un diplôme de sport", "Une recette de cuisine", "Un billet de train"],
    correct: 0,
    competence: "CE",
  },
  {
    question: "Vous entendez : « Le bureau est fermé le lundi. » Quand le bureau est-il fermé ?",
    options: ["Le mardi", "Le lundi", "Le vendredi", "Le dimanche"],
    correct: 1,
    competence: "CO",
  },
  {
    question: "Complétez : « Je ___ au marché tous les samedis. »",
    options: ["vais", "vas", "va", "allons"],
    correct: 0,
    competence: "EE",
  },
  {
    question: "Que signifie le panneau « Sortie de secours » ?",
    options: ["Entrée principale", "Toilettes", "Issue d'urgence", "Parking"],
    correct: 2,
    competence: "CE",
  },
  {
    question: "À la CAF, on vous demande votre numéro d'allocataire. C'est :",
    options: [
      "Votre numéro de téléphone",
      "Votre identifiant pour les aides sociales",
      "Votre numéro de passeport",
      "Votre adresse email",
    ],
    correct: 1,
    competence: "CO",
  },
];

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
      {/* Eleve selector */}
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
        {/* Sliders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Évaluation par compétence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {COMP_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{COMP_LABELS[key]}</label>
                  <span className="text-sm font-bold tabular-nums w-12 text-right">
                    {scores[key]}
                  </span>
                </div>
                <Slider
                  value={[scores[key]]}
                  onValueChange={([v]) => setScores((p) => ({ ...p, [key]: v }))}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profil de compétences</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="competence" tick={{ fontSize: 14 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Generate analysis */}
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

/* ───────── Student Test Section (QCM + TTS) ───────── */
function PassationTest() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(SAMPLE_QUESTIONS.length).fill(null));
  const [submitted, setSubmitted] = useState(false);

  const q = SAMPLE_QUESTIONS[current];

  const handleAnswer = (idx: number) => {
    if (submitted) return;
    setAnswers((prev) => {
      const copy = [...prev];
      copy[current] = idx;
      return copy;
    });
  };

  const handleSubmit = () => {
    const unanswered = answers.filter((a) => a === null).length;
    if (unanswered > 0) {
      toast.error(`Il reste ${unanswered} question(s) sans réponse.`);
      return;
    }
    setSubmitted(true);
    const score = answers.reduce<number>(
      (acc, a, i) => acc + (a === SAMPLE_QUESTIONS[i].correct ? 1 : 0),
      0,
    );
    toast.success(`Test terminé ! Score : ${score}/${SAMPLE_QUESTIONS.length}`);
  };

  const score = submitted
    ? answers.reduce<number>((acc, a, i) => acc + (a === SAMPLE_QUESTIONS[i].correct ? 1 : 0), 0)
    : null;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">
              Question {current + 1} / {SAMPLE_QUESTIONS.length}
            </span>
            <Badge variant="outline">{q.competence}</Badge>
          </div>
          <div className="flex gap-1">
            {SAMPLE_QUESTIONS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i === current
                    ? "bg-primary"
                    : answers[i] !== null
                      ? submitted
                        ? answers[i] === SAMPLE_QUESTIONS[i].correct
                          ? "bg-success"
                          : "bg-destructive"
                        : "bg-primary/40"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Question */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="flex-1">
              <p className="text-base font-medium leading-relaxed">{q.question}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => speak(q.question)}
              className="shrink-0"
              title="Écouter la question"
            >
              <Volume2 className="h-5 w-5 text-primary" />
            </Button>
          </div>

          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const selected = answers[current] === idx;
              const isCorrect = submitted && idx === q.correct;
              const isWrong = submitted && selected && idx !== q.correct;

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={submitted}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border text-left transition-all text-[15px] ${
                    isCorrect
                      ? "border-success bg-success/10 text-success"
                      : isWrong
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                      isCorrect
                        ? "border-success bg-success text-success-foreground"
                        : isWrong
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(opt);
                    }}
                    className="shrink-0 h-8 w-8"
                    title="Écouter"
                  >
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  {isCorrect && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>

        {current === SAMPLE_QUESTIONS.length - 1 && !submitted ? (
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Soumettre le test
          </Button>
        ) : (
          <Button
            onClick={() => setCurrent((c) => Math.min(SAMPLE_QUESTIONS.length - 1, c + 1))}
            disabled={current === SAMPLE_QUESTIONS.length - 1}
          >
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Results */}
      {submitted && score !== null && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">
              Score : {score}/{SAMPLE_QUESTIONS.length}
            </p>
            <p className="text-muted-foreground mt-1">
              {score >= 4 ? "Excellent !" : score >= 3 ? "Bien !" : score >= 2 ? "Des points à retravailler." : "Besoin d'accompagnement renforcé."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
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
