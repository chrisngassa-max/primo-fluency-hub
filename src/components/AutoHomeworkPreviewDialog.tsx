import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Send, Loader2, Trash2, Clock, Users, AlertTriangle, BookOpen, Sparkles, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPETENCE_COLORS } from "@/lib/competences";

interface StudentHomework {
  eleveId: string;
  eleveName: string;
  serie1: GeneratedExercise[];
  serie2: GeneratedExercise[];
  estimatedMinutes: number;
}

interface GeneratedExercise {
  id: string; // temp client id
  titre: string;
  competence: string;
  format: string;
  niveau_vise: string;
  difficulte: number;
  consigne: string;
  contenu: any;
  serie: 1 | 2;
  point_a_maitriser_id?: string;
}

interface AutoHomeworkPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  groupId: string;
  userId: string;
  durationMinutes: number;
  onSent?: () => void;
}

// Time estimates per format (minutes)
const FORMAT_TIME: Record<string, number> = {
  qcm: 3,
  vrai_faux: 2,
  appariement: 4,
  texte_lacunaire: 5,
  transformation: 5,
  production_ecrite: 10,
  production_orale: 8,
};

export default function AutoHomeworkPreviewDialog({
  open, onOpenChange, sessionId, groupId, userId, durationMinutes, onSent,
}: AutoHomeworkPreviewDialogProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [studentHomework, setStudentHomework] = useState<StudentHomework[]>([]);
  const [countdown, setCountdown] = useState(60);
  const [countdownActive, setCountdownActive] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatedRef = useRef(false);

  // Generate homework when dialog opens
  useEffect(() => {
    if (open && !generatedRef.current) {
      generatedRef.current = true;
      generateHomework();
    }
    if (!open) {
      generatedRef.current = false;
      setStudentHomework([]);
      setCountdown(60);
      setCountdownActive(false);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [open]);

  // Countdown timer
  useEffect(() => {
    if (countdownActive && countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [countdownActive]);

  // Auto-send when countdown reaches 0
  useEffect(() => {
    if (countdownActive && countdown === 0 && studentHomework.length > 0 && !sending) {
      handleSendAll();
    }
  }, [countdown, countdownActive, studentHomework.length, sending]);

  const generateHomework = async () => {
    setLoading(true);
    try {
      // Fetch group members with profiles
      const { data: members, error: membersErr } = await supabase
        .from("group_members")
        .select("eleve_id, profiles:eleve_id(id, nom, prenom)")
        .eq("group_id", groupId);
      if (membersErr) throw membersErr;
      if (!members || members.length === 0) {
        toast.warning("Aucun élève dans le groupe.");
        setLoading(false);
        return;
      }

      // Fetch session exercises and their results for this session
      const { data: sessionExercises } = await supabase
        .from("session_exercices")
        .select("exercice_id, exercices:exercice_id(competence, niveau_vise, difficulte, format, titre, contenu, point_a_maitriser_id)")
        .eq("session_id", sessionId);

      // Fetch results for this session's exercises
      const exerciseIds = (sessionExercises ?? []).map((se: any) => se.exercice_id);
      const { data: allResults } = exerciseIds.length > 0
        ? await supabase
            .from("resultats")
            .select("eleve_id, exercice_id, score")
            .in("exercice_id", exerciseIds)
        : { data: [] };

      // Fetch a default point_a_maitriser_id to use for generated exercises
      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .limit(1)
        .single();

      const defaultPointId = defaultPoint?.id || null;

      const halfTime = durationMinutes / 2;

      // For each student, analyze and generate
      const allHomework: StudentHomework[] = [];

      for (const member of members) {
        const profile = member.profiles as any;
        const eleveName = profile ? `${profile.prenom || ""} ${profile.nom || ""}`.trim() : "Élève";
        const eleveId = member.eleve_id;

        // Get this student's results
        const studentResults = (allResults ?? []).filter((r: any) => r.eleve_id === eleveId);

        // Identify weak competences (score < 60) and strong ones (score >= 70)
        const compScores: Record<string, { total: number; count: number }> = {};
        for (const se of (sessionExercises ?? [])) {
          const ex = se.exercices as any;
          if (!ex) continue;
          const result = studentResults.find((r: any) => r.exercice_id === se.exercice_id);
          const comp = ex.competence;
          if (!compScores[comp]) compScores[comp] = { total: 0, count: 0 };
          compScores[comp].count++;
          compScores[comp].total += result ? result.score : 0;
        }

        const weakComps: string[] = [];
        const strongComps: string[] = [];
        for (const [comp, data] of Object.entries(compScores)) {
          const avg = data.count > 0 ? data.total / data.count : 0;
          if (avg < 60) weakComps.push(comp);
          else strongComps.push(comp);
        }

        // If no session data, use all competences
        const allComps = Object.keys(compScores);
        const remediationComps = weakComps.length > 0 ? weakComps : (allComps.length > 0 ? [allComps[0]] : ["CE"]);
        const consolidationComps = strongComps.length > 0 ? strongComps : (allComps.length > 0 ? [allComps[allComps.length - 1]] : ["CO"]);

        // Determine exercise counts based on time budget
        const avgTimePerEx = 4; // minutes
        const exPerSerie = Math.max(1, Math.floor(halfTime / avgTimePerEx));

        // Generate Serie 1 (Remediation)
        const serie1: GeneratedExercise[] = [];
        for (let i = 0; i < Math.min(exPerSerie, remediationComps.length * 2); i++) {
          const comp = remediationComps[i % remediationComps.length];
          const refEx = (sessionExercises ?? []).find((se: any) => (se.exercices as any)?.competence === comp);
          const refData = refEx?.exercices as any;
          serie1.push({
            id: crypto.randomUUID(),
            titre: `Remédiation ${comp} #${i + 1}`,
            competence: comp,
            format: refData?.format || "qcm",
            niveau_vise: refData?.niveau_vise || "A1",
            difficulte: Math.max(1, (refData?.difficulte || 3) - 1),
            consigne: `Exercice de remédiation en ${comp}`,
            contenu: {},
            serie: 1,
            point_a_maitriser_id: refData?.point_a_maitriser_id || defaultPointId,
          });
        }

        // Generate Serie 2 (Consolidation)
        const serie2: GeneratedExercise[] = [];
        for (let i = 0; i < Math.min(exPerSerie, consolidationComps.length * 2); i++) {
          const comp = consolidationComps[i % consolidationComps.length];
          const refEx = (sessionExercises ?? []).find((se: any) => (se.exercices as any)?.competence === comp);
          const refData = refEx?.exercices as any;
          serie2.push({
            id: crypto.randomUUID(),
            titre: `Consolidation ${comp} #${i + 1}`,
            competence: comp,
            format: refData?.format || "qcm",
            niveau_vise: refData?.niveau_vise || "A1",
            difficulte: Math.min(10, (refData?.difficulte || 3) + 1),
            consigne: `Exercice de consolidation en ${comp}`,
            contenu: {},
            serie: 2,
            point_a_maitriser_id: refData?.point_a_maitriser_id || defaultPointId,
          });
        }

        const estTime = [...serie1, ...serie2].reduce(
          (sum, ex) => sum + (FORMAT_TIME[ex.format] || 4), 0
        );

        allHomework.push({
          eleveId,
          eleveName,
          serie1,
          serie2,
          estimatedMinutes: estTime,
        });
      }

      setStudentHomework(allHomework);
      setCountdownActive(true);
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const pauseCountdown = useCallback(() => {
    setCountdownActive(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const removeExercise = (eleveIdx: number, serie: 1 | 2, exIdx: number) => {
    pauseCountdown();
    setStudentHomework((prev) => {
      const copy = [...prev];
      const student = { ...copy[eleveIdx] };
      if (serie === 1) {
        student.serie1 = student.serie1.filter((_, i) => i !== exIdx);
      } else {
        student.serie2 = student.serie2.filter((_, i) => i !== exIdx);
      }
      student.estimatedMinutes = [...student.serie1, ...student.serie2].reduce(
        (sum, ex) => sum + (FORMAT_TIME[ex.format] || 4), 0
      );
      copy[eleveIdx] = student;
      return copy;
    });
  };

  const handleSendAll = async () => {
    if (sending) return;
    setSending(true);
    pauseCountdown();

    try {
      // First, create the exercises in the DB, then create devoirs referencing them
      const allDevoirs: any[] = [];

      for (const student of studentHomework) {
        const allExercises = [...student.serie1, ...student.serie2];
        if (allExercises.length === 0) continue;

        for (const ex of allExercises) {
          // Insert exercise
          const { data: insertedEx, error: exErr } = await supabase
            .from("exercices")
            .insert({
              formateur_id: userId,
              competence: ex.competence as any,
              format: ex.format as any,
              niveau_vise: ex.niveau_vise,
              difficulte: ex.difficulte,
              titre: ex.titre,
              consigne: ex.consigne,
              contenu: ex.contenu,
              is_devoir: true,
              is_ai_generated: true,
              eleve_id: student.eleveId,
              point_a_maitriser_id: ex.point_a_maitriser_id,
            })
            .select("id")
            .single();

          if (exErr) throw exErr;

          allDevoirs.push({
            eleve_id: student.eleveId,
            exercice_id: insertedEx.id,
            formateur_id: userId,
            session_id: sessionId,
            contexte: "devoir",
            serie: ex.serie,
            raison: ex.serie === 1 ? ("remediation" as const) : ("consolidation" as const),
            statut: "en_attente" as const,
          });
        }
      }

      if (allDevoirs.length > 0) {
        const { error: devoirErr } = await supabase.from("devoirs").insert(allDevoirs as any);
        if (devoirErr) throw devoirErr;
      }

      const totalEx = allDevoirs.length;
      const totalEleves = studentHomework.filter(
        (s) => s.serie1.length + s.serie2.length > 0
      ).length;

      toast.success(
        `Devoirs envoyés ✅ — ${totalEx} exercice(s) pour ${totalEleves} élève(s)`
      );

      qc.invalidateQueries({ queryKey: ["session-homework-sent", sessionId] });
      qc.invalidateQueries({ queryKey: ["devoirs-formateur-all"] });
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const totalExercises = studentHomework.reduce(
    (sum, s) => sum + s.serie1.length + s.serie2.length, 0
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) pauseCountdown(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Devoirs générés automatiquement
          </DialogTitle>
          <DialogDescription>
            {durationMinutes} min de devoirs par élève — Série 1 : Remédiation · Série 2 : Consolidation
          </DialogDescription>
        </DialogHeader>

        {/* Countdown banner */}
        {countdownActive && !loading && !sending && studentHomework.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Envoi automatique dans {countdown}s
              </p>
              <Progress value={((60 - countdown) / 60) * 100} className="h-1.5 mt-1" />
            </div>
            <Button variant="outline" size="sm" onClick={pauseCountdown}>
              Modifier
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-0">
          {loading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Analyse des résultats et génération des devoirs...
                </p>
              </div>
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : studentHomework.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun devoir à générer.</p>
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={studentHomework.map((_, i) => `student-${i}`)}>
              {studentHomework.map((student, sIdx) => (
                <AccordionItem key={student.eleveId} value={`student-${sIdx}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 w-full pr-2">
                      <span className="font-medium text-sm">{student.eleveName}</span>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" />
                        ~{student.estimatedMinutes} min
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {student.serie1.length + student.serie2.length} ex.
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    {/* Serie 1 */}
                    {student.serie1.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Série 1 — Remédiation
                        </p>
                        <div className="space-y-1">
                          {student.serie1.map((ex, exIdx) => (
                            <ExerciseRow
                              key={ex.id}
                              exercise={ex}
                              onRemove={() => removeExercise(sIdx, 1, exIdx)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Serie 2 */}
                    {student.serie2.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          Série 2 — Consolidation
                        </p>
                        <div className="space-y-1">
                          {student.serie2.map((ex, exIdx) => (
                            <ExerciseRow
                              key={ex.id}
                              exercise={ex}
                              onRemove={() => removeExercise(sIdx, 2, exIdx)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
          <p className="text-xs text-muted-foreground flex-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {studentHomework.length} élève(s) · {totalExercises} exercice(s)
          </p>
          <Button variant="outline" onClick={() => { pauseCountdown(); onOpenChange(false); }}>
            Annuler
          </Button>
          <Button
            onClick={handleSendAll}
            disabled={sending || loading || totalExercises === 0}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer à tous ✅
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseRow({ exercise, onRemove }: { exercise: GeneratedExercise; onRemove: () => void }) {
  const colorClass = COMPETENCE_COLORS[exercise.competence] || "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-muted/30 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{exercise.titre}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge className={cn("text-[10px]", colorClass)}>{exercise.competence}</Badge>
          <span className="text-[10px] text-muted-foreground">{exercise.format}</span>
          <span className="text-[10px] text-muted-foreground">Niv. {exercise.niveau_vise}</span>
          <span className="text-[10px] text-muted-foreground">Diff. {exercise.difficulte}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
