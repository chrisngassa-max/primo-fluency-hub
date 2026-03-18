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

/* ───────── TCF-format questions ───────── */
type TCFQuestion = {
  section: "CO" | "Structures" | "CE";
  /** Text read aloud by TTS for CO, or displayed for Structures/CE */
  audio?: string;
  /** Displayed question text (hidden for CO to force listening) */
  question: string;
  options: { label: string; emoji?: string }[];
  correct: number;
  /** Visual context for CE (emoji-based illustration) */
  visual?: string;
};

const SECTIONS_META: Record<string, { title: string; icon: string; color: string; description: string }> = {
  CO: { title: "Compréhension Orale", icon: "🎧", color: "bg-primary", description: "Écoutez l'audio puis choisissez la bonne image ou réponse." },
  Structures: { title: "Structures de la langue", icon: "📝", color: "bg-accent", description: "Complétez la phrase avec le mot correct." },
  CE: { title: "Compréhension Écrite", icon: "📖", color: "bg-success", description: "Lisez le document puis répondez à la question." },
};

const TCF_QUESTIONS: TCFQuestion[] = [
  // ── CO: audio questions with visual/emoji answers ──
  {
    section: "CO",
    audio: "Il est neuf heures et quart.",
    question: "Quelle heure est-il ?",
    options: [
      { label: "9h15", emoji: "🕘" },
      { label: "9h45", emoji: "🕤" },
      { label: "8h15", emoji: "🕗" },
      { label: "10h00", emoji: "🕙" },
    ],
    correct: 0,
  },
  {
    section: "CO",
    audio: "Le train numéro trois cent vingt-cinq part du quai numéro deux.",
    question: "Quel est le numéro du train ?",
    options: [
      { label: "235", emoji: "🔢" },
      { label: "325", emoji: "🔢" },
      { label: "352", emoji: "🔢" },
      { label: "523", emoji: "🔢" },
    ],
    correct: 1,
  },
  {
    section: "CO",
    audio: "Attention, le magasin ferme dans quinze minutes.",
    question: "Que va-t-il se passer ?",
    options: [
      { label: "Le magasin va ouvrir", emoji: "🏪" },
      { label: "Le magasin va fermer", emoji: "🔒" },
      { label: "Il y a une promotion", emoji: "🏷️" },
      { label: "Le magasin est en travaux", emoji: "🚧" },
    ],
    correct: 1,
  },
  {
    section: "CO",
    audio: "Pour aller à la poste, tournez à gauche après la pharmacie.",
    question: "Où se trouve la poste ?",
    options: [
      { label: "À droite de la pharmacie", emoji: "➡️" },
      { label: "À gauche après la pharmacie", emoji: "⬅️" },
      { label: "En face de la pharmacie", emoji: "⬆️" },
      { label: "Derrière la pharmacie", emoji: "🔙" },
    ],
    correct: 1,
  },
  // ── Structures: fill-in-the-blank ──
  {
    section: "Structures",
    question: "Je vais ___ boulangerie acheter du pain.",
    options: [
      { label: "à la" },
      { label: "au" },
      { label: "de la" },
      { label: "du" },
    ],
    correct: 0,
  },
  {
    section: "Structures",
    question: "Il ___ beau aujourd'hui, on peut sortir.",
    options: [
      { label: "fait" },
      { label: "est" },
      { label: "a" },
      { label: "va" },
    ],
    correct: 0,
  },
  {
    section: "Structures",
    question: "Nous ___ à Paris depuis trois ans.",
    options: [
      { label: "habite" },
      { label: "habitons" },
      { label: "habitez" },
      { label: "habites" },
    ],
    correct: 1,
  },
  {
    section: "Structures",
    question: "Elle a ___ ses clés à la maison.",
    options: [
      { label: "oublié" },
      { label: "oubliée" },
      { label: "oublier" },
      { label: "oubliant" },
    ],
    correct: 0,
  },
  // ── CE: visual/document-based ──
  {
    section: "CE",
    visual: "🚫🚬 INTERDICTION DE FUMER — Décret n° 2006-1386",
    question: "Que signifie ce panneau ?",
    options: [
      { label: "On peut fumer ici" },
      { label: "Il est interdit de fumer" },
      { label: "Vente de cigarettes" },
      { label: "Zone fumeur" },
    ],
    correct: 1,
  },
  {
    section: "CE",
    visual: "🏥 URGENCES — Ouvert 24h/24 — Entrée par la porte B",
    question: "Ce panneau indique :",
    options: [
      { label: "Un restaurant ouvert la nuit" },
      { label: "Les urgences de l'hôpital" },
      { label: "Une pharmacie de garde" },
      { label: "Un cabinet médical" },
    ],
    correct: 1,
  },
  {
    section: "CE",
    visual: "🍎 Pommes Bio — 2,50 € / kg\n🥖 Baguette tradition — 1,20 €\n🧀 Camembert — 3,80 € pièce",
    question: "Combien coûte la baguette ?",
    options: [
      { label: "2,50 €" },
      { label: "3,80 €" },
      { label: "1,20 €" },
      { label: "1,50 €" },
    ],
    correct: 2,
  },
  {
    section: "CE",
    visual: "📋 PRÉFECTURE DE PARIS\nPour votre rendez-vous, apportez :\n✅ Passeport\n✅ 3 photos d'identité\n✅ Justificatif de domicile\n✅ Timbre fiscal",
    question: "Combien de photos faut-il apporter ?",
    options: [
      { label: "1 photo" },
      { label: "2 photos" },
      { label: "3 photos" },
      { label: "4 photos" },
    ],
    correct: 2,
  },
];

/* ───────── Student Test Section (TCF Simulator) ───────── */
function PassationTest() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(TCF_QUESTIONS.length).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [sectionIntro, setSectionIntro] = useState(true);

  const q = TCF_QUESTIONS[current];
  const prevSection = current > 0 ? TCF_QUESTIONS[current - 1].section : null;
  const isNewSection = q.section !== prevSection;
  const meta = SECTIONS_META[q.section];

  // Count questions per section for progress
  const sectionQuestions = TCF_QUESTIONS.filter((qq) => qq.section === q.section);
  const sectionIndex = sectionQuestions.indexOf(q) + 1;

  const handleAnswer = (idx: number) => {
    if (submitted) return;
    setAnswers((prev) => {
      const copy = [...prev];
      copy[current] = idx;
      return copy;
    });
  };

  const handleNext = () => {
    if (current < TCF_QUESTIONS.length - 1) {
      const nextQ = TCF_QUESTIONS[current + 1];
      if (nextQ.section !== q.section) {
        setSectionIntro(true);
      }
      setCurrent((c) => c + 1);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const score = answers.reduce<number>(
      (acc, a, i) => acc + (a === TCF_QUESTIONS[i].correct ? 1 : 0),
      0,
    );
    toast.success(`Test terminé ! Score : ${score}/${TCF_QUESTIONS.length}`);
  };

  const score = submitted
    ? answers.reduce<number>((acc, a, i) => acc + (a === TCF_QUESTIONS[i].correct ? 1 : 0), 0)
    : null;

  const scoreCO = submitted ? TCF_QUESTIONS.reduce((acc, qq, i) => acc + (qq.section === "CO" && answers[i] === qq.correct ? 1 : 0), 0) : 0;
  const scoreStr = submitted ? TCF_QUESTIONS.reduce((acc, qq, i) => acc + (qq.section === "Structures" && answers[i] === qq.correct ? 1 : 0), 0) : 0;
  const scoreCE = submitted ? TCF_QUESTIONS.reduce((acc, qq, i) => acc + (qq.section === "CE" && answers[i] === qq.correct ? 1 : 0), 0) : 0;

  // Section intro screen
  if (sectionIntro && isNewSection && !submitted) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className={`${meta.color} p-6 text-center`}>
            <span className="text-5xl">{meta.icon}</span>
          </div>
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-bold">{meta.title}</h2>
            <p className="text-muted-foreground text-base">{meta.description}</p>
            <p className="text-sm text-muted-foreground">
              {sectionQuestions.length} question{sectionQuestions.length > 1 ? "s" : ""} dans cette partie
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
    <div className="space-y-6">
      {/* Section header + progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{meta.icon}</span>
              <span className="text-sm font-semibold">{meta.title}</span>
              <Badge variant="outline" className="text-xs">
                {sectionIndex}/{sectionQuestions.length}
              </Badge>
            </div>
            <Badge variant="secondary">
              {current + 1}/{TCF_QUESTIONS.length} total
            </Badge>
          </div>
          <div className="flex gap-1">
            {TCF_QUESTIONS.map((qq, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  i === current
                    ? "bg-primary"
                    : answers[i] !== null
                      ? submitted
                        ? answers[i] === qq.correct ? "bg-success" : "bg-destructive"
                        : "bg-primary/40"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Question card */}
      <Card>
        <CardContent className="pt-6">
          {/* CO: audio prompt */}
          {q.section === "CO" && q.audio && (
            <div className="flex flex-col items-center gap-3 mb-6 p-6 bg-muted/50 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground font-medium">🎧 Cliquez pour écouter</p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => speak(q.audio!)}
                className="gap-2 text-base px-8"
              >
                <Volume2 className="h-5 w-5 text-primary" /> Écouter l'audio
              </Button>
              <p className="text-base font-medium mt-2">{q.question}</p>
            </div>
          )}

          {/* CE: visual document */}
          {q.section === "CE" && q.visual && (
            <div className="mb-6 p-5 bg-card border-2 border-dashed border-muted-foreground/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Document</p>
              <div className="text-lg font-medium whitespace-pre-line leading-relaxed">
                {q.visual}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <p className="text-base font-medium flex-1">{q.question}</p>
                <Button variant="ghost" size="icon" onClick={() => speak(`${q.visual}. ${q.question}`)} title="Écouter">
                  <Volume2 className="h-5 w-5 text-primary" />
                </Button>
              </div>
            </div>
          )}

          {/* Structures: fill-in-the-blank */}
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

          {/* Answer options */}
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
                    isCorrect
                      ? "border-success bg-success/10"
                      : isWrong
                        ? "border-destructive bg-destructive/10"
                        : selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  {q.section === "CO" && opt.emoji && (
                    <span className="text-3xl">{opt.emoji}</span>
                  )}
                  <span className={`font-medium text-[15px] ${q.section === "CO" ? "text-center" : ""}`}>
                    {opt.label}
                  </span>
                  {q.section !== "CO" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); speak(opt.label); }}
                      className="shrink-0 h-8 w-8 ml-auto"
                      title="Écouter"
                    >
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
        <Button
          variant="outline"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>

        {current === TCF_QUESTIONS.length - 1 && !submitted ? (
          <Button onClick={handleSubmit} disabled={answers[current] === null}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Soumettre le test
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={answers[current] === null}
          >
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Results */}
      {submitted && score !== null && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-2xl font-bold text-center">
              Score global : {score}/{TCF_QUESTIONS.length}
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">🎧 CO</p>
                <p className="text-lg font-bold">{scoreCO}/{TCF_QUESTIONS.filter(q => q.section === "CO").length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">📝 Structures</p>
                <p className="text-lg font-bold">{scoreStr}/{TCF_QUESTIONS.filter(q => q.section === "Structures").length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">📖 CE</p>
                <p className="text-lg font-bold">{scoreCE}/{TCF_QUESTIONS.filter(q => q.section === "CE").length}</p>
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              {score >= 10 ? "Excellent !" : score >= 7 ? "Bon niveau !" : score >= 4 ? "Des points à retravailler." : "Accompagnement renforcé recommandé."}
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
