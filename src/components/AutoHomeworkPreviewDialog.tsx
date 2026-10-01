import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeworkContentErrors } from "@/lib/homeworkExecutable";
import { clearHomeworkRequest, preserveHomeworkRequest, recoveryDeadline } from "@/lib/homeworkSendRecovery";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Send, Loader2, Trash2, Clock, AlertTriangle, BookOpen, Sparkles, CalendarDays,
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
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [volumePerStudent, setVolumePerStudent] = useState(() => Math.max(1, Math.round(durationMinutes / 4)));
  const [deadline, setDeadline] = useState(() => {
    const value = new Date(Date.now() + 7 * 86400000);
    return value.toISOString().slice(0, 10);
  });
  const epoch = useRef(0);
  const preparation = useRef(0);
  const sendLock = useRef(false);
  const mounted = useRef(true);
  const request = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // Opening only reads. Never persist a group preference or send from an effect.
  useEffect(() => {
    epoch.current += 1;
    preparation.current += 1;
    setConfirmation(null);
    setSendError(null);
    setStudentHomework([]);
    setSelectedStudentIds(new Set());
    setSending(sendLock.current);
    if (open) {
      const savedDeadline = recoveryDeadline({ userId, sessionId, groupId });
      if (savedDeadline) setDeadline(savedDeadline);
      void generateHomework();
    }
    return () => { epoch.current += 1; preparation.current += 1; };
  }, [open, sessionId, groupId, userId]);

  const generateHomework = async () => {
    if (sendLock.current) return;
    const currentEpoch = epoch.current;
    const currentPreparation = ++preparation.current;
    const current = () => mounted.current && epoch.current === currentEpoch && preparation.current === currentPreparation;
    setConfirmation(null);
    setLoading(true);
    try {
      // Fetch group members with profiles
      const { data: members, error: membersErr } = await supabase
        .from("group_members")
        .select("eleve_id, profiles:eleve_id(id, nom, prenom)")
        .eq("group_id", groupId)
        .order("eleve_id");
      if (!current()) return;
      if (membersErr) throw membersErr;
      if (!members || members.length === 0) {
        toast.warning("Aucun élève dans le groupe.");
        setLoading(false);
        return;
      }

      // Fetch session exercises and their results for this session
      const { data: sessionExercises, error: sessionError } = await supabase
        .from("session_exercices")
        .select("exercice_id, exercices:exercice_id(competence, niveau_vise, difficulte, format, titre, consigne, contenu, point_a_maitriser_id)")
        .eq("session_id", sessionId)
        .order("exercice_id");

      if (sessionError) throw sessionError;
      // Fetch results for this session's exercises
      const exerciseIds = (sessionExercises ?? []).map((se: any) => se.exercice_id);
      const { data: allResults, error: resultsError } = exerciseIds.length > 0
        ? await supabase
            .from("resultats")
            .select("eleve_id, exercice_id, score")
            .in("exercice_id", exerciseIds)
            .order("id")
        : { data: [], error: null };

      if (resultsError) throw resultsError;
      if (!current()) return;
      // Fetch a default point_a_maitriser_id to use for generated exercises
      const { data: defaultPoint } = await supabase
        .from("points_a_maitriser")
        .select("id")
        .order("id")
        .limit(1)
        .single();

      const defaultPointId = defaultPoint?.id || null;

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

        const remediationCount = Math.max(1, Math.ceil(volumePerStudent / 2));
        const consolidationCount = Math.max(0, volumePerStudent - remediationCount);

        // Generate Serie 1 (Remediation)
        const serie1: GeneratedExercise[] = [];
        for (let i = 0; i < remediationCount; i++) {
          const comp = remediationComps[i % remediationComps.length];
          const refEx = (sessionExercises ?? []).find((se: any) => (se.exercices as any)?.competence === comp);
          const refData = refEx?.exercices as any;
          serie1.push({
            id: crypto.randomUUID(),
            titre: refData?.titre || `Remédiation ${comp} #${i + 1}`,
            competence: comp,
            format: refData?.format || "qcm",
            niveau_vise: refData?.niveau_vise || "A1",
            difficulte: (refData?.difficulte ?? 3),
            consigne: refData?.consigne || "",
            contenu: structuredClone(refData?.contenu ?? {}),
            serie: 1,
            point_a_maitriser_id: refData?.point_a_maitriser_id || defaultPointId,
          });
        }

        // Generate Serie 2 (Consolidation)
        const serie2: GeneratedExercise[] = [];
        for (let i = 0; i < consolidationCount; i++) {
          const comp = consolidationComps[i % consolidationComps.length];
          const refEx = (sessionExercises ?? []).find((se: any) => (se.exercices as any)?.competence === comp);
          const refData = refEx?.exercices as any;
          serie2.push({
            id: crypto.randomUUID(),
            titre: refData?.titre || `Consolidation ${comp} #${i + 1}`,
            competence: comp,
            format: refData?.format || "qcm",
            niveau_vise: refData?.niveau_vise || "A1",
            difficulte: (refData?.difficulte ?? 3),
            consigne: refData?.consigne || "",
            contenu: structuredClone(refData?.contenu ?? {}),
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

      if (!current()) return;
      setStudentHomework(allHomework);
      setSelectedStudentIds(new Set(allHomework.map((student) => student.eleveId)));
    } catch (e: any) {
      if (current()) {
        setStudentHomework([]);
        toast.error("Préparation impossible", { description: e.message });
      }
    } finally {
      if (current()) setLoading(false);
    }
  };

  const removeExercise = (eleveIdx: number, serie: 1 | 2, exIdx: number) => {
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

  const entries = studentHomework.flatMap(student => selectedStudentIds.has(student.eleveId)
    ? [...student.serie1, ...student.serie2].slice(0, volumePerStudent).map(ex => ({
      student_id: student.eleveId, serie: ex.serie,
      exercise: { titre: ex.titre, consigne: ex.consigne, competence: ex.competence,
        format: ex.format, niveau_vise: ex.niveau_vise, difficulte: ex.difficulte,
        contenu: ex.contenu, point_a_maitriser_id: ex.point_a_maitriser_id },
    })) : []);
  const validDeadline = /^\d{4}-\d{2}-\d{2}$/.test(deadline)
    && Number.isFinite(new Date(`${deadline}T23:59:00`).getTime())
    && new Date(`${deadline}T23:59:00`).getTime() > Date.now();
  const invalidContent = entries.some(entry => homeworkContentErrors(entry.exercise, true).length > 0);
  const batchKey = JSON.stringify({ userId, sessionId, groupId, deadline, entries });
  const ready = open && !loading && !sending && entries.length > 0 && validDeadline && !invalidContent;
  useEffect(() => { setConfirmation(null); setSendError(null); }, [batchKey]);

  const handleSendAll = async () => {
    if (!ready || confirmation !== batchKey || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setSendError(null);
    const sendingEpoch = epoch.current;
    try {
      const deadlineIso = new Date(`${deadline}T23:59:00`).toISOString();
      const recovery = await preserveHomeworkRequest({ userId, sessionId, groupId }, deadline,
        { deadline: deadlineIso, entries }, request.current?.key === batchKey ? request.current.id : undefined);
      // Account/dialog may have changed while the digest was being calculated.
      if (!mounted.current || epoch.current !== sendingEpoch) return;
      const requestId = recovery.requestId;
      request.current = { key: batchKey, id: requestId };
      const { data, error } = await supabase.rpc("send_automatic_homework" as any, {
        p_request_id: requestId, p_session_id: sessionId, p_group_id: groupId,
        p_deadline: deadlineIso, p_entries: entries,
      } as any);
      if (error) throw error;
      if (!data || (data as any).request_id !== requestId || (data as any).homework_count !== entries.length) {
        throw new Error("Réponse non confirmée. Réessayez le même lot pour vérifier son envoi sans doublon.");
      }
      clearHomeworkRequest(recovery);
      if (!mounted.current || epoch.current !== sendingEpoch) return;
      request.current = null;
      toast.success(`Devoirs envoyés — ${entries.length} exercice(s)`);
      void qc.invalidateQueries({ queryKey: ["session-homework-sent", sessionId] });
      void qc.invalidateQueries({ queryKey: ["devoirs-formateur-all"] });
      onSent?.();
      onOpenChange(false);
    } catch (error: any) {
      if (mounted.current && epoch.current === sendingEpoch) {
        setSendError(error.message || "Envoi non confirmé. Réessayez ce même lot sans créer de doublon.");
      }
    } finally {
      sendLock.current = false;
      if (mounted.current) setSending(false);
    }
  };

  const totalExercises = studentHomework.reduce(
    (sum, student) => selectedStudentIds.has(student.eleveId)
      ? sum + Math.min(volumePerStudent, student.serie1.length + student.serie2.length)
      : sum,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prévisualiser les devoirs préparés
          </DialogTitle>
          <DialogDescription>
            {durationMinutes} min prévues par élève. Contenus repris de la séance, sans nouvelle génération ni adaptation. Examinez-les avant de confirmer l’envoi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 border-y py-4 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <p className="text-sm">Aucun devoir n’est envoyé à l’ouverture. L’envoi nécessite votre confirmation du lot affiché.</p>
          <div className="space-y-2">
            <Label htmlFor="homework-volume">Volume par eleve</Label>
            <Input
              disabled={sending}
              id="homework-volume"
              type="number"
              min={1}
              max={30}
              value={volumePerStudent}
              onChange={(event) => setVolumePerStudent(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
            />
            <Button variant="outline" size="sm" className="w-full" onClick={() => void generateHomework()} disabled={loading || sending}>
              Repréparer
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="homework-deadline" className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Date limite
            </Label>
            <Input
              disabled={sending}
              id="homework-deadline"
              type="date"
              value={deadline}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-0">
          {loading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Préparation de la prévisualisation...
                </p>
              </div>
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : studentHomework.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun exercice préparé. Utilisez le chemin manuel ou complétez les exercices de la séance.</p>
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={studentHomework.map((_, i) => `student-${i}`)}>
              {studentHomework.map((student, sIdx) => (
                <AccordionItem key={student.eleveId} value={`student-${sIdx}`}>
                  <div className="flex items-center gap-3">
                      <Checkbox
                        disabled={sending}
                        checked={selectedStudentIds.has(student.eleveId)}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={(checked) => {
                          setSelectedStudentIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(student.eleveId);
                            else next.delete(student.eleveId);
                            return next;
                          });
                        }}
                        aria-label={`Selectionner ${student.eleveName}`}
                      />
                    <AccordionTrigger className="hover:no-underline flex-1">
                      <span className="font-medium text-sm">{student.eleveName}</span>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" />
                        ~{student.estimatedMinutes} min
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {student.serie1.length + student.serie2.length} ex.
                      </Badge>
                    </AccordionTrigger>
                  </div>
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
                              disabled={sending}
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
                              disabled={sending}
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

        {invalidContent && <p role="alert" className="text-sm text-destructive">Contenu incomplet ou inexécutable : retirez les exercices signalés ou complétez-les avant l’envoi.</p>}
        {!validDeadline && <p role="alert" className="text-sm text-destructive">Choisissez une date limite valide, non passée.</p>}
        {sendError && <p role="alert" className="text-sm text-destructive">{sendError}</p>}
        {confirmation === batchKey && ready && <section aria-label="Confirmation du lot" className="rounded border p-3 space-y-2">
          <p>Confirmer l’envoi de {entries.length} exercice(s), pour le {deadline} ? Toute modification du lot annule cette confirmation.</p>
          <Button onClick={handleSendAll}>Confirmer l’envoi</Button>
          <Button variant="outline" onClick={() => setConfirmation(null)}>Revenir à la prévisualisation</Button>
        </section>}
        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
          <p className="text-xs text-muted-foreground flex-1">{selectedStudentIds.size} élève(s) · {totalExercises} exercice(s)</p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => { if (ready && !sendLock.current) setConfirmation(batchKey); }} disabled={!ready} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Valider et envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExerciseRow({ exercise, onRemove, disabled }: { exercise: GeneratedExercise; onRemove: () => void; disabled: boolean }) {
  const errors = homeworkContentErrors(exercise, true);
  const content = exercise.contenu && typeof exercise.contenu === "object" ? exercise.contenu : {};
  const image = content.image || content.image_url || content.visual || content.support_visuel || content.illustration || content.media_url;
  const colorClass = COMPETENCE_COLORS[exercise.competence] || "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-muted/30 transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{exercise.titre}</p>
        <p className="text-sm whitespace-pre-wrap">{exercise.consigne}</p>
        {typeof content.texte === "string" && <p className="text-sm whitespace-pre-wrap">{content.texte}</p>}
        {typeof image === "string" && /^https?:\/\//.test(image) && <img src={image} alt="Support de l’exercice" className="max-h-80 max-w-full object-contain" />}
        {typeof content.script_audio === "string" && <p className="text-sm whitespace-pre-wrap">Support audio (script) : {content.script_audio}</p>}
        {content.audio && <p className="text-sm">Audio original lié à sa publication : envoi par le chemin manuel.</p>}
        {Array.isArray(content.items) && <ol className="list-decimal pl-5 text-sm">{content.items.map((item: any, index: number) => <li key={index}>
          {typeof item?.question === "string" ? item.question : "Question manquante"}
          {Array.isArray(item?.options) && <ul>{item.options.map((option: unknown, oi: number) => <li key={oi}>{typeof option === "string" ? option : "Option invalide"}</li>)}</ul>}
          {typeof item?.bonne_reponse === "string" && <p>Réponse attendue : {item.bonne_reponse}</p>}
        </li>)}</ol>}
        {errors.length > 0 && <ul aria-label="Contenu incomplet" className="text-sm text-destructive">{errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}
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
        disabled={disabled}
        aria-label={`Retirer ${exercise.titre}`}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
