import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Timer, Play, Pause, RotateCcw, ChevronDown, ChevronRight,
  Loader2, Sparkles, CheckCircle2, Send, X, Plus, Eye,
  AlertTriangle, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StudentStatus = "dans_les_temps" | "leger_retard" | "en_retard" | "termine" | "pas_commence";

interface StudentProgress {
  id: string;
  prenom: string;
  nom: string;
  questionsAnswered: number;
  totalQuestions: number;
  status: StudentStatus;
  finishTime?: number; // seconds taken to finish
}

interface LivePilotingSectionProps {
  sessionId: string;
  session: any;
  exercises: any[];
  groupMembers: any[];
  userId: string;
}

const STATUS_CONFIG: Record<StudentStatus, { label: string; emoji: string; color: string }> = {
  dans_les_temps: { label: "Dans les temps", emoji: "🟢", color: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800" },
  leger_retard: { label: "Léger retard", emoji: "🟠", color: "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800" },
  en_retard: { label: "Ne finira pas", emoji: "🔴", color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" },
  termine: { label: "Terminé", emoji: "✅", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" },
  pas_commence: { label: "Pas commencé", emoji: "⚪", color: "text-muted-foreground bg-muted/50 border-border" },
};

const LEVEL_MAP: Record<string, number> = { A0: 0, A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
const LEVEL_LABELS = ["A0", "A1", "A2", "B1", "B2", "C1"];

function getEstimatedSeconds(exercise: any): number {
  const contenu = exercise?.contenu;
  const duree = contenu?.duree_estimee_secondes;
  if (duree && typeof duree === "number") return duree;

  const items = Array.isArray(contenu?.items) ? contenu.items : [];
  const format = exercise?.format;
  if (format === "production_ecrite") return 900;
  if (format === "production_orale") return 480;
  const count = items.length || 5;
  return count * 60;
}

function computeStudentStatus(
  questionsAnswered: number,
  totalQuestions: number,
  elapsedSeconds: number,
  totalSeconds: number
): StudentStatus {
  if (totalQuestions > 0 && questionsAnswered >= totalQuestions) return "termine";
  if (questionsAnswered === 0 && elapsedSeconds < 10) return "pas_commence";
  if (totalSeconds <= 0) return "dans_les_temps";
  const expectedDone = (elapsedSeconds / totalSeconds) * totalQuestions;
  if (questionsAnswered >= expectedDone) return "dans_les_temps";
  if (questionsAnswered >= expectedDone - 1) return "leger_retard";
  return "en_retard";
}

const LivePilotingSection = ({ sessionId, session, exercises, groupMembers, userId }: LivePilotingSectionProps) => {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeExerciseIdx, setActiveExerciseIdx] = useState<number | null>(null);
  const [timeAllotted, setTimeAllotted] = useState(300); // seconds
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Bonus dialog
  const [bonusStudentId, setBonusStudentId] = useState<string | null>(null);
  const [bonusLevel, setBonusLevel] = useState<"same" | "harder" | "much_harder">("same");
  const [bonusGenerating, setBonusGenerating] = useState(false);
  const [bonusPreview, setBonusPreview] = useState<any>(null);
  const [bonusSending, setBonusSending] = useState(false);
  const [bonusSent, setBonusSent] = useState<Record<string, boolean>>({});

  // Alerts for students falling behind
  const [alertedStudents, setAlertedStudents] = useState<Set<string>>(new Set());

  const activeExercise = activeExerciseIdx !== null ? exercises[activeExerciseIdx]?.exercice : null;
  const activeSeId = activeExerciseIdx !== null ? exercises[activeExerciseIdx]?.id : null;

  const totalQuestions = useMemo(() => {
    if (!activeExercise) return 0;
    const items = activeExercise?.contenu?.items;
    return Array.isArray(items) ? items.length : 0;
  }, [activeExercise]);

  // Fetch results for current exercise from all students
  const { data: studentResults, refetch: refetchResults } = useQuery({
    queryKey: ["live-results", activeExercise?.id, sessionId],
    queryFn: async () => {
      if (!activeExercise) return [];
      const studentIds = groupMembers.map((m: any) => m.eleve_id);
      if (studentIds.length === 0) return [];
      const { data } = await supabase
        .from("resultats")
        .select("eleve_id, score, reponses_eleve, created_at")
        .eq("exercice_id", activeExercise.id)
        .in("eleve_id", studentIds);
      return data ?? [];
    },
    enabled: !!activeExercise && groupMembers.length > 0,
    refetchInterval: timerRunning ? 15000 : false,
  });

  // Realtime subscription for results
  useEffect(() => {
    if (!activeExercise || !timerRunning) return;
    const channel = supabase
      .channel(`live-results-${activeExercise.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "resultats",
          filter: `exercice_id=eq.${activeExercise.id}`,
        },
        () => {
          refetchResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeExercise?.id, timerRunning, refetchResults]);

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        const newElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(newElapsed);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Compute student progress
  const studentProgress: StudentProgress[] = useMemo(() => {
    if (!groupMembers || groupMembers.length === 0) return [];
    return groupMembers.map((m: any) => {
      const eleve = m.eleve;
      const results = (studentResults ?? []).filter((r: any) => r.eleve_id === m.eleve_id);
      const questionsAnswered = results.length;
      
      // Count individual answers from reponses_eleve
      let answeredCount = 0;
      if (results.length > 0) {
        const lastResult = results[results.length - 1];
        const reponses = lastResult.reponses_eleve;
        if (typeof reponses === "object" && reponses !== null) {
          answeredCount = Object.keys(reponses).length;
        }
        // If they submitted a result, they answered all questions
        answeredCount = Math.max(answeredCount, totalQuestions);
      }

      const status = computeStudentStatus(answeredCount, totalQuestions, elapsed, timeAllotted);
      
      let finishTime: number | undefined;
      if (status === "termine" && results.length > 0) {
        const lastResult = results[results.length - 1];
        if (lastResult.created_at && startTimeRef.current > 0) {
          finishTime = Math.floor((new Date(lastResult.created_at).getTime() - startTimeRef.current) / 1000);
          if (finishTime < 0) finishTime = undefined;
        }
      }

      return {
        id: m.eleve_id,
        prenom: eleve?.prenom || "Élève",
        nom: eleve?.nom || "",
        questionsAnswered: answeredCount,
        totalQuestions,
        status,
        finishTime,
      };
    });
  }, [groupMembers, studentResults, totalQuestions, elapsed, timeAllotted]);

  // Alert logic for students falling behind
  useEffect(() => {
    if (!timerRunning) return;
    studentProgress.forEach((sp) => {
      if (sp.status === "en_retard" && !alertedStudents.has(sp.id)) {
        toast.warning(`${sp.prenom} — risque de ne pas finir`, {
          duration: 4000,
        });
        setAlertedStudents((prev) => new Set(prev).add(sp.id));
      }
    });
  }, [studentProgress, timerRunning, alertedStudents]);

  const selectExercise = useCallback((idx: number) => {
    setActiveExerciseIdx(idx);
    const ex = exercises[idx]?.exercice;
    if (ex) {
      const secs = getEstimatedSeconds(ex);
      setTimeAllotted(secs);
    }
    setTimerRunning(false);
    setElapsed(0);
    setAlertedStudents(new Set());
    setBonusSent({});
  }, [exercises]);

  const startTimer = () => {
    setTimerRunning(true);
    startTimeRef.current = Date.now();
    setElapsed(0);
    setAlertedStudents(new Set());
  };

  const pauseTimer = () => setTimerRunning(false);
  const resetTimer = () => {
    setTimerRunning(false);
    setElapsed(0);
    setAlertedStudents(new Set());
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = timeAllotted > 0 ? Math.min(100, (elapsed / timeAllotted) * 100) : 0;
  const remaining = Math.max(0, timeAllotted - elapsed);

  // Bonus exercise generation
  const handleOpenBonus = (studentId: string) => {
    setBonusStudentId(studentId);
    setBonusLevel("same");
    setBonusPreview(null);
  };

  const handleGenerateBonus = async () => {
    if (!activeExercise || !bonusStudentId) return;
    setBonusGenerating(true);
    try {
      const currentLevel = activeExercise.niveau_vise || session?.niveau_cible || "A1";
      const currentLevelIdx = LEVEL_MAP[currentLevel] ?? 1;
      let targetLevel: string;
      if (bonusLevel === "harder") {
        targetLevel = LEVEL_LABELS[Math.min(currentLevelIdx + 1, 5)];
      } else if (bonusLevel === "much_harder") {
        targetLevel = LEVEL_LABELS[Math.min(currentLevelIdx + 2, 5)];
      } else {
        targetLevel = currentLevel;
      }

      const theme = activeExercise.contexte_irn || activeExercise.consigne?.split(" ").slice(0, 5).join(" ") || "Vie quotidienne";
      
      const { data, error } = await supabase.functions.invoke("tcf-generate-exercise", {
        body: {
          theme,
          level: targetLevel,
          apprenant: { id: bonusStudentId },
          type_demarche: session?.group?.type_demarche || "titre_sejour",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBonusPreview(data);
    } catch (e: any) {
      toast.error("Erreur de génération bonus", { description: e.message });
    } finally {
      setBonusGenerating(false);
    }
  };

  const handleSendBonus = async () => {
    if (!bonusPreview || !bonusStudentId || !activeExercise) return;
    setBonusSending(true);
    try {
      // Get a default point_a_maitriser_id
      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();

      // Insert the exercise
      const { data: newEx, error: exErr } = await supabase
        .from("exercices")
        .insert({
          titre: `${bonusPreview.titre || "Bonus"} (bonus)`,
          consigne: bonusPreview.consigne || "",
          competence: activeExercise.competence,
          format: (bonusPreview.type === "QCM" ? "qcm" : activeExercise.format || "qcm") as any,
          difficulte: activeExercise.difficulte || 3,
          contenu: bonusPreview.contenu ? (typeof bonusPreview.contenu === "string" ? { text: bonusPreview.contenu } : bonusPreview.contenu) : {},
          niveau_vise: bonusPreview.niveau_cecrl || activeExercise.niveau_vise || "A1",
          formateur_id: userId,
          point_a_maitriser_id: activeExercise.point_a_maitriser_id || defaultPoint?.id,
          is_ai_generated: true,
          is_template: false,
          is_devoir: false,
          eleve_id: bonusStudentId,
        })
        .select("id")
        .single();
      if (exErr) throw exErr;

      // Link to session with is_bonus flag
      const maxOrdre = exercises.length;
      const { error: linkErr } = await supabase
        .from("session_exercices")
        .insert({
          session_id: sessionId,
          exercice_id: newEx!.id,
          ordre: maxOrdre + 1,
          statut: "planifie" as any,
          is_bonus: true,
          eleve_id: bonusStudentId,
        });
      if (linkErr) throw linkErr;

      toast.success("Exercice bonus envoyé !");
      setBonusSent((prev) => ({ ...prev, [bonusStudentId]: true }));
      setBonusStudentId(null);
      setBonusPreview(null);
      qc.invalidateQueries({ queryKey: ["session-exercices", sessionId] });
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setBonusSending(false);
    }
  };

  // Only show when session is en_cours
  if (session?.statut !== "en_cours") return null;

  return (
    <div className="print:hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between gap-2 border-primary/30 hover:bg-primary/5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Pilotage en direct</span>
              {timerRunning && (
                <Badge variant="secondary" className="text-[10px] animate-pulse bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  En cours — {formatTime(remaining)}
                </Badge>
              )}
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4">
          {/* Exercise Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                Exercice actif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {exercises.map((se: any, idx: number) => (
                  <Button
                    key={se.id}
                    size="sm"
                    variant={activeExerciseIdx === idx ? "default" : "outline"}
                    className="text-xs h-8"
                    onClick={() => selectExercise(idx)}
                  >
                    {idx + 1}. {se.exercice?.titre?.slice(0, 25) || `Ex. ${idx + 1}`}
                  </Button>
                ))}
              </div>

              {activeExercise && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{activeExercise.titre}</p>
                      <p className="text-xs text-muted-foreground">
                        {activeExercise.competence} · {totalQuestions} question(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Temps (min) :</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={Math.ceil(timeAllotted / 60)}
                        onChange={(e) => setTimeAllotted(Number(e.target.value) * 60)}
                        className="w-16 h-8 text-center text-sm"
                        disabled={timerRunning}
                      />
                    </div>
                  </div>

                  {/* Timer controls */}
                  <div className="flex items-center gap-2">
                    {!timerRunning ? (
                      <Button onClick={startTimer} className="gap-2 flex-1" size="sm">
                        <Play className="h-4 w-4" />
                        {elapsed > 0 ? "Reprendre le chrono" : "Lancer le chrono"}
                      </Button>
                    ) : (
                      <Button onClick={pauseTimer} variant="secondary" className="gap-2 flex-1" size="sm">
                        <Pause className="h-4 w-4" />
                        Pause
                      </Button>
                    )}
                    <Button onClick={resetTimer} variant="outline" size="icon" className="h-8 w-8">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Timer bar */}
                  {(timerRunning || elapsed > 0) && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Écoulé : {formatTime(elapsed)}</span>
                        <span className={cn(
                          "font-bold",
                          remaining <= 60 && remaining > 0 ? "text-red-600 animate-pulse" : "text-foreground"
                        )}>
                          Restant : {formatTime(remaining)}
                        </span>
                      </div>
                      <Progress
                        value={progressPercent}
                        className={cn(
                          "h-3",
                          progressPercent >= 100 && "[&>div]:bg-red-500",
                          progressPercent >= 75 && progressPercent < 100 && "[&>div]:bg-orange-500"
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Student Progress */}
          {activeExercise && (timerRunning || elapsed > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Progression des élèves
                </CardTitle>
              </CardHeader>
              <CardContent>
                {studentProgress.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun élève dans le groupe.</p>
                ) : (
                  <div className="space-y-1.5">
                    {studentProgress.map((sp) => {
                      const cfg = STATUS_CONFIG[sp.status];
                      return (
                        <div
                          key={sp.id}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                            cfg.color
                          )}
                        >
                          <span className="text-base">{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {sp.prenom} {sp.nom}
                              {sp.status === "en_retard" && (
                                <AlertTriangle className="h-3.5 w-3.5 inline ml-1.5 text-red-500" />
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Q {sp.questionsAnswered} / {sp.totalQuestions}
                              {sp.status === "termine" && sp.finishTime && (
                                <span className="ml-2 font-medium">
                                  en {formatTime(sp.finishTime)}
                                </span>
                              )}
                            </p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0", cfg.color)}>
                            {cfg.label}
                          </Badge>
                          {sp.status === "termine" && !bonusSent[sp.id] && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={() => handleOpenBonus(sp.id)}
                            >
                              <Plus className="h-3 w-3" />Bonus
                            </Button>
                          )}
                          {bonusSent[sp.id] && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5" />Bonus envoyé
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Bonus Dialog */}
      <Dialog open={!!bonusStudentId} onOpenChange={(open) => { if (!open) { setBonusStudentId(null); setBonusPreview(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Exercice bonus
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const student = groupMembers.find((m: any) => m.eleve_id === bonusStudentId);
                return `Pour ${student?.eleve?.prenom || "l'élève"} ${student?.eleve?.nom || ""} — ${activeExercise?.competence || ""}`;
              })()}
            </DialogDescription>
          </DialogHeader>

          {!bonusPreview ? (
            <div className="space-y-4 py-2">
              <RadioGroup value={bonusLevel} onValueChange={(v: any) => setBonusLevel(v)} className="space-y-2">
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="same" id="same" />
                  <Label htmlFor="same" className="flex-1 cursor-pointer">
                    <span className="font-medium">⚪ Même niveau</span>
                    <p className="text-xs text-muted-foreground">Exercice identique, contexte différent</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="harder" id="harder" />
                  <Label htmlFor="harder" className="flex-1 cursor-pointer">
                    <span className="font-medium">🟡 Plus difficile</span>
                    <p className="text-xs text-muted-foreground">Palier supérieur, même compétence</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="much_harder" id="much_harder" />
                  <Label htmlFor="much_harder" className="flex-1 cursor-pointer">
                    <span className="font-medium">🔴 Beaucoup plus difficile</span>
                    <p className="text-xs text-muted-foreground">Deux paliers au-dessus</p>
                  </Label>
                </div>
              </RadioGroup>

              <Button onClick={handleGenerateBonus} disabled={bonusGenerating} className="w-full gap-2">
                {bonusGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Générer et prévisualiser
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <p className="font-semibold text-sm">{bonusPreview.titre}</p>
                  <p className="text-xs text-muted-foreground">{bonusPreview.consigne}</p>
                  {bonusPreview.niveau_cecrl && (
                    <Badge variant="secondary" className="text-[10px]">Niveau {bonusPreview.niveau_cecrl}</Badge>
                  )}
                  {bonusPreview.choix && Array.isArray(bonusPreview.choix) && (
                    <div className="space-y-1 mt-2">
                      {bonusPreview.choix.slice(0, 4).map((c: string, i: number) => (
                        <p key={i} className="text-xs p-1.5 rounded bg-muted/50 border">{c}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setBonusPreview(null)} className="gap-1">
                  <X className="h-4 w-4" />Annuler
                </Button>
                <Button onClick={handleSendBonus} disabled={bonusSending} className="gap-2">
                  {bonusSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer à l'élève
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LivePilotingSection;
