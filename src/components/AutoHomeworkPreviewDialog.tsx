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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Send, Loader2, Trash2, Clock, Users, AlertTriangle, BookOpen, Sparkles, CalendarDays,
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

type HomeworkDeliveryMode = "recommendation" | "validation" | "automatic";

export default function AutoHomeworkPreviewDialog({
  open, onOpenChange, sessionId, groupId, userId, durationMinutes, onSent,
}: AutoHomeworkPreviewDialogProps) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [studentHomework, setStudentHomework] = useState<StudentHomework[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<HomeworkDeliveryMode>("validation");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [volumePerStudent, setVolumePerStudent] = useState(() => Math.max(1, Math.round(durationMinutes / 4)));
  const [deadline, setDeadline] = useState(() => {
    const value = new Date(Date.now() + 7 * 86400000);
    return value.toISOString().slice(0, 10);
  });
  const generatedRef = useRef(false);
  const automaticSendRef = useRef(false);
  const storedAutomaticModeRef = useRef(false);

  // Generate homework when dialog opens
  useEffect(() => {
    if (open && !generatedRef.current) {
      generatedRef.current = true;
      void generateHomework();
      void supabase
        .from("groups")
        .select("homework_delivery_mode")
        .eq("id", groupId)
        .single()
        .then(({ data }) => {
          const mode = data?.homework_delivery_mode;
          if (mode === "recommendation" || mode === "validation" || mode === "automatic") {
            storedAutomaticModeRef.current = mode === "automatic";
            setDeliveryMode(mode);
          }
        });
    }
    if (!open) {
      generatedRef.current = false;
      automaticSendRef.current = false;
      storedAutomaticModeRef.current = false;
      setStudentHomework([]);
      setSelectedStudentIds(new Set());
    }
  }, [open]);

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
        for (let i = 0; i < consolidationCount; i++) {
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
      setSelectedStudentIds(new Set(allHomework.map((student) => student.eleveId)));
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setLoading(false);
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

  const handleSendAll = async () => {
    if (sending) return;
    if (deliveryMode === "recommendation") {
      setSending(true);
      const { error } = await supabase
        .from("groups")
        .update({ homework_delivery_mode: deliveryMode })
        .eq("id", groupId);
      setSending(false);
      if (error) {
        toast.error("Mode non enregistre", { description: error.message });
        return;
      }
      toast.info("Aucun devoir envoye. Le mode recommandation est memorise pour ce groupe.");
      onOpenChange(false);
      return;
    }
    setSending(true);

    try {
      const { error: modeError } = await supabase
        .from("groups")
        .update({ homework_delivery_mode: deliveryMode })
        .eq("id", groupId);
      if (modeError) throw modeError;

      // First, create the exercises in the DB, then create devoirs referencing them
      const allDevoirs: any[] = [];
      const dueIso = new Date(`${deadline}T23:59:00`).toISOString();

      for (const student of studentHomework) {
        if (!selectedStudentIds.has(student.eleveId)) continue;
        const allExercises = [...student.serie1, ...student.serie2].slice(0, volumePerStudent);
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
            date_echeance: dueIso,
            source_label: deliveryMode === "automatic"
              ? "session_personalized_automatic"
              : "session_personalized_validated",
          });
        }
      }

      if (allDevoirs.length > 0) {
        const { error: devoirErr } = await supabase.from("devoirs").insert(allDevoirs as any);
        if (devoirErr) throw devoirErr;
      }

      const totalEx = allDevoirs.length;
      const totalEleves = studentHomework.filter(
        (student) => selectedStudentIds.has(student.eleveId) && student.serie1.length + student.serie2.length > 0
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
    (sum, student) => selectedStudentIds.has(student.eleveId)
      ? sum + Math.min(volumePerStudent, student.serie1.length + student.serie2.length)
      : sum,
    0,
  );

  useEffect(() => {
    if (
      open &&
      deliveryMode === "automatic" &&
      storedAutomaticModeRef.current &&
      studentHomework.length > 0 &&
      selectedStudentIds.size > 0 &&
      !automaticSendRef.current
    ) {
      automaticSendRef.current = true;
      void handleSendAll();
    }
  }, [deliveryMode, open, selectedStudentIds.size, studentHomework.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <div className="grid gap-4 border-y py-4 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="space-y-2">
            <Label>Mode d'envoi</Label>
            <RadioGroup
              value={deliveryMode}
              onValueChange={(value) => setDeliveryMode(value as HomeworkDeliveryMode)}
              className="grid gap-2"
            >
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="recommendation" className="mt-0.5" />
                <span><strong>Recommandation seule</strong><br /><span className="text-xs text-muted-foreground">Aucun devoir n'est envoye.</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="validation" className="mt-0.5" />
                <span><strong>Validation groupee</strong><br /><span className="text-xs text-muted-foreground">Envoi apres votre validation.</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <RadioGroupItem value="automatic" className="mt-0.5" />
                <span><strong>Automatique autorise</strong><br /><span className="text-xs text-muted-foreground">Ce choix est memorise pour le groupe.</span></span>
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="homework-volume">Volume par eleve</Label>
            <Input
              id="homework-volume"
              type="number"
              min={1}
              max={30}
              value={volumePerStudent}
              onChange={(event) => setVolumePerStudent(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
            />
            <Button variant="outline" size="sm" className="w-full" onClick={() => void generateHomework()} disabled={loading}>
              Regenerer
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="homework-deadline" className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              Date limite
            </Label>
            <Input
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
                      <Checkbox
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSendAll}
            disabled={sending || loading || totalExercises === 0}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {deliveryMode === "recommendation"
              ? "Fermer sans envoyer"
              : deliveryMode === "automatic"
                ? "Autoriser et envoyer"
                : "Valider et envoyer"}
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
