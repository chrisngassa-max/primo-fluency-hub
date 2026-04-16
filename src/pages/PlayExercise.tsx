import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

  // 1) Load exercise via edge function
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

  // 2) If user logged in, try to find an assignment for this exercise
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
        learner_id: user?.id ?? null,
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

  // ─── UI States ───
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !exercice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl">{exercice.titre}</CardTitle>
                <CardDescription className="text-sm">{exercice.consigne}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{exercice.competence}</Badge>
                <Badge variant="outline">Niv. {exercice.niveau_vise}</Badge>
              </div>
            </div>
            {!user && !result && (
              <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Mode invité — vos réponses ne seront pas enregistrées dans un historique.
              </p>
            )}
          </CardHeader>
        </Card>

        {/* Result view */}
        {result ? (
          <>
            <Card className={cn(
              "border-l-4",
              result.score_normalized >= 80 ? "border-l-green-500"
                : result.score_normalized >= 60 ? "border-l-amber-500"
                : "border-l-destructive"
            )}>
              <CardHeader>
                <CardTitle className="text-3xl">{result.score_normalized}%</CardTitle>
                <CardDescription>
                  {result.correct_count} / {result.total_items} bonnes réponses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{result.feedback_text}</p>
                {result.anonymous && (
                  <p className="text-xs text-muted-foreground mt-3">
                    💡 Connectez-vous pour suivre votre progression dans le temps.
                  </p>
                )}
              </CardContent>
            </Card>

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
                          <p className="text-sm font-medium">{r.question}</p>
                          {!r.correct && (
                            <>
                              <p className="text-xs text-destructive">
                                Votre réponse : {r.reponse_donnee || "—"}
                              </p>
                              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
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
            {/* Question list */}
            {items.map((item: any, idx: number) => (
              <Card key={idx}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-primary shrink-0 mt-0.5">
                      Q{idx + 1}
                    </span>
                    <p className="text-sm font-medium flex-1">{item.question}</p>
                  </div>

                  {Array.isArray(item.options) && item.options.length > 0 ? (
                    <RadioGroup
                      value={answers[idx] ?? ""}
                      onValueChange={(v) => handleAnswer(idx, v)}
                      className="space-y-1.5 ml-6"
                    >
                      {item.options.map((opt: string, oi: number) => (
                        <div key={oi} className="flex items-center space-x-2 p-2 rounded-md border hover:bg-accent transition-colors">
                          <RadioGroupItem value={opt} id={`q${idx}-o${oi}`} />
                          <Label htmlFor={`q${idx}-o${oi}`} className="flex-1 cursor-pointer font-normal text-sm">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="ml-6">
                      <Textarea
                        placeholder="Votre réponse…"
                        value={answers[idx] ?? ""}
                        onChange={(e) => handleAnswer(idx, e.target.value)}
                        rows={2}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Correction en cours…" : "Soumettre mes réponses"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayExercise;
