import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Sparkles, Play, Pause, RotateCcw, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SmartText from "@/components/SmartText";
import SmartTextHint from "@/components/SmartTextHint";

interface Exercice {
  id: string;
  titre: string;
  consigne: string;
  competence: string;
  format: string;
  contenu: any;
  niveau_vise: string;
  difficulte: number;
}

interface CorrectionResult {
  attempt_id: string | null;
  anonymous?: boolean;
  score_normalized: number;
  correct_count: number;
  total_items: number;
  feedback_text: string;
  item_results: Record<string, {
    question: string;
    reponse_donnee: string;
    bonne_reponse: string;
    correct: boolean;
    explication: string | null;
  }>;
}

const COMP_NAMES: Record<string, string> = {
  CO: "Compréhension Orale",
  CE: "Compréhension Écrite",
  EE: "Expression Écrite",
  EO: "Expression Orale",
  Structures: "Structures de la Langue",
};

const COMP_COLORS: Record<string, string> = {
  CO: "bg-blue-600",
  CE: "bg-green-600",
  EE: "bg-purple-600",
  EO: "bg-orange-500",
  Structures: "bg-rose-600",
};

function getSupportText(contenu: any) {
  const candidates = [
    contenu?.texte,
    contenu?.texte_support,
    contenu?.support_texte,
    contenu?.support,
    contenu?.enonce,
    contenu?.contexte,
  ];
  return candidates.find((v): v is string => typeof v === "string" && v.trim().length > 0) ?? "";
}

function getSupportAudio(contenu: any): string {
  return contenu?.audio_url || contenu?.url_audio || contenu?.audio || "";
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const seek = (offset: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, a.currentTime + offset);
  };

  const bars = Array.from({ length: 28 }, (_, i) =>
    20 + Math.abs(Math.sin(i * 0.7 + 1) * 14)
  );

  return (
    <div
      className="mx-4 mb-4 rounded-xl px-3 py-3 flex items-center gap-2"
      style={{ background: "hsl(30 10% 42%)" }}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={() => seek(-10)}
        className="flex flex-col items-center text-white/80 hover:text-white shrink-0"
      >
        <RotateCcw className="h-4 w-4" />
        <span className="text-[9px] leading-none mt-0.5">10</span>
      </button>
      <button onClick={toggle} className="text-white hover:text-white/80 shrink-0 mx-1">
        {playing
          ? <Pause className="h-6 w-6 fill-white" />
          : <Play className="h-6 w-6 fill-white" />
        }
      </button>
      <button
        onClick={() => seek(10)}
        className="flex flex-col items-center text-white/80 hover:text-white shrink-0"
      >
        <RotateCw className="h-4 w-4" />
        <span className="text-[9px] leading-none mt-0.5">10</span>
      </button>
      <div className="flex-1 flex items-center gap-px h-8 mx-2">
        {bars.map((h, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors",
              i < Math.round((progress / 100) * bars.length) ? "bg-white" : "bg-white/30"
            )}
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
    </div>
  );
}

const PlayExercise = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercice, setExercice] = useState<Exercice | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("play-exercise", {
          body: { play_token: token },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setExercice(data as Exercice);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Exercice introuvable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!user || !exercice) return;
    (async () => {
      const { data } = await supabase
        .from("exercise_assignments")
        .select("id")
        .eq("exercise_id", exercice.id)
        .eq("learner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setAssignmentId(data.id);
    })();
  }, [user, exercice]);

  const items: any[] = exercice?.contenu?.items ?? [];
  const supportText = getSupportText(exercice?.contenu);
  const audioUrl = getSupportAudio(exercice?.contenu);

  const handleAnswer = (idx: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [idx]: value }));
  };

  const handleSubmit = async () => {
    if (!exercice) return;
    if (Object.keys(answers).length === 0) {
      toast.error("Veuillez répondre à au moins une question");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        exercise_id: exercice.id,
        assignment_id: assignmentId,
        answers: items.map((_, idx) => ({
          item_index: idx,
          reponse: answers[idx] ?? "",
        })),
      };
      const { data, error } = await supabase.functions.invoke("auto-correct-exercise", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data as CorrectionResult);
      toast.success(`Score : ${data.score_normalized}%`);
    } catch (e: any) {
      toast.error("Erreur de correction", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen p-4" style={{ background: "hsl(40 30% 93%)" }}>
        <div className="max-w-lg mx-auto space-y-4 pt-4">
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !exercice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(40 30% 93%)" }}>
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Exercice indisponible</CardTitle>
            <CardDescription>
              {error || "Ce lien n'est pas valide ou l'exercice n'est plus disponible."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progressPct = items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0;
  const compColor = COMP_COLORS[exercice.competence] ?? COMP_COLORS["CO"];
  const compName = COMP_NAMES[exercice.competence] ?? exercice.competence;

  return (
    <div className="min-h-screen" style={{ background: "hsl(40 30% 93%)" }}>
      {/* Progress bar */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${result ? 100 : progressPct}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <div className={cn(
            "h-14 w-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shrink-0",
            compColor
          )}>
            {exercice.competence}
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">{compName}</p>
            <p className="text-sm text-muted-foreground">Niveau {exercice.niveau_vise}</p>
          </div>
        </div>

        {!result && user?.id && <SmartTextHint />}

        {/* Guest notice */}
        {!user && !result && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Mode invité — vos réponses ne seront pas enregistrées dans un historique.
          </p>
        )}

        {/* Result view */}
        {result ? (
          <>
            <div className={cn(
              "rounded-[0.625rem] p-6 shadow-md",
              result.score_normalized >= 70
                ? "bg-gradient-to-br from-green-600 to-green-500"
                : result.score_normalized >= 50
                ? "bg-gradient-to-br from-amber-500 to-orange-400"
                : "bg-gradient-to-br from-red-600 to-red-500"
            )}>
              <div className="text-white space-y-2">
                <p className="text-5xl font-extrabold">{result.score_normalized}%</p>
                <p className="text-white/80 font-medium">
                  {result.correct_count} / {result.total_items} bonnes réponses
                </p>
                <p className="text-sm text-white/90 mt-2 leading-relaxed">{result.feedback_text}</p>
                {result.anonymous && (
                  <p className="text-xs text-white/70 mt-3 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Connectez-vous pour suivre votre progression dans le temps.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Correction détaillée
              </h2>
              {items.map((item, idx) => {
                const r = result.item_results[String(idx)];
                if (!r) return null;
                return (
                  <Card key={idx} className={cn(
                    "border-l-4",
                    r.correct ? "border-l-green-500" : "border-l-destructive"
                  )}>
                    <CardContent className="py-3 px-4 space-y-2">
                      <div className="flex items-start gap-2">
                        {r.correct
                          ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">
                            {user?.id ? (
                              <SmartText text={r.question} studentId={user.id} contextSentence={supportText || r.question} />
                            ) : r.question}
                          </p>
                          {!r.correct && (
                            <>
                              <p className="text-xs text-destructive">
                                Votre réponse : {r.reponse_donnee || "—"}
                              </p>
                              <p className="text-xs text-green-700 font-medium">
                                Bonne réponse : {r.bonne_reponse}
                              </p>
                            </>
                          )}
                          {r.explication && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              {r.explication}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Support card */}
            {(audioUrl || supportText) && (
              <div className="rounded-[0.625rem] border bg-card shadow-sm overflow-hidden">
                <p className="text-sm font-medium px-4 pt-3 pb-2">Support</p>
                {audioUrl ? (
                  <AudioPlayer src={audioUrl} />
                ) : (
                  <div className="px-4 pb-4">
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {user?.id ? (
                        <SmartText text={supportText} studentId={user.id} contextSentence={supportText} />
                      ) : supportText}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Questions */}
            {items.map((item: any, idx: number) => (
              <div key={idx} className="space-y-4">
                {/* Consigne + question */}
                <div>
                  <p className="text-sm text-foreground leading-relaxed">{exercice.consigne}</p>
                  <p className="text-base font-bold text-foreground mt-1">
                    {user?.id ? (
                      <SmartText text={item.question} studentId={user.id} contextSentence={supportText || item.question} />
                    ) : item.question}
                  </p>
                </div>

                {/* Options */}
                {Array.isArray(item.options) && item.options.length > 0 ? (
                  <div className="space-y-2">
                    {item.options.map((opt: string, oi: number) => (
                      <button
                        key={oi}
                        className={cn(
                          "w-full py-4 rounded-2xl border-2 text-center font-medium text-sm transition-colors",
                          answers[idx] === opt
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-white border-primary text-foreground hover:bg-primary/5"
                        )}
                        onClick={() => handleAnswer(idx, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    placeholder="Votre réponse…"
                    value={answers[idx] ?? ""}
                    onChange={(e) => handleAnswer(idx, e.target.value)}
                    rows={3}
                  />
                )}
              </div>
            ))}

            <Button
              size="lg"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-base py-6"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {submitting ? "Correction en cours…" : "Valider la réponse"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayExercise;
