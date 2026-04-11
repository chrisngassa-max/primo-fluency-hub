import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  BookOpen, Send, Loader2, CheckCircle2, Lock, AlertTriangle, Sparkles, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AutoHomeworkPreviewDialog from "@/components/AutoHomeworkPreviewDialog";

interface EndOfSessionSectionProps {
  sessionId: string;
  userId: string;
  sessionStatut: string;
  groupId: string;
  onHomeworkSent?: () => void;
  onCloseSession?: () => void;
}

const DURATION_OPTIONS = [15, 30, 45, 60] as const;

export default function EndOfSessionSection({
  sessionId, userId, sessionStatut, groupId, onHomeworkSent, onCloseSession,
}: EndOfSessionSectionProps) {
  const qc = useQueryClient();
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedExIds, setSelectedExIds] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [autoGenOpen, setAutoGenOpen] = useState(false);

  // Check if homework was already sent for this session
  const { data: sentHomework, isLoading: loadingSent } = useQuery({
    queryKey: ["session-homework-sent", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoirs")
        .select("id")
        .eq("session_id", sessionId)
        .eq("contexte", "devoir" as any);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sessionId,
  });

  const homeworkSent = (sentHomework ?? []).length > 0;

  // Fetch formateur's exercise bank for selection
  const { data: bankExercises, isLoading: loadingBank } = useQuery({
    queryKey: ["exercise-bank-for-homework", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, titre, competence, format, difficulte, niveau_vise")
        .eq("formateur_id", userId)
        .eq("is_devoir", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: selectOpen,
  });

  // Fetch group members
  const { data: members } = useQuery({
    queryKey: ["group-members-homework", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id")
        .eq("group_id", groupId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!groupId,
  });

  const selectedCount = useMemo(
    () => Object.values(selectedExIds).filter(Boolean).length,
    [selectedExIds]
  );

  const toggleEx = (exId: string) => {
    setSelectedExIds((prev) => ({ ...prev, [exId]: !prev[exId] }));
  };

  const handleSendHomework = async () => {
    const exIds = Object.entries(selectedExIds).filter(([, v]) => v).map(([k]) => k);
    if (exIds.length === 0) { toast.warning("Sélectionnez au moins un exercice."); return; }
    if (!members || members.length === 0) { toast.warning("Aucun élève dans le groupe."); return; }

    setSending(true);
    try {
      const devoirs = exIds.flatMap((exId) =>
        members.map((m: any) => ({
          eleve_id: m.eleve_id,
          exercice_id: exId,
          formateur_id: userId,
          raison: "consolidation" as const,
          statut: "en_attente" as const,
          session_id: sessionId,
          contexte: "devoir",
        }))
      );

      const { error } = await supabase.from("devoirs").insert(devoirs as any);
      if (error) throw error;

      toast.success(`Devoirs envoyés ✅ — ${exIds.length} exercice(s) disponibles pour les élèves`);
      setSelectOpen(false);
      setSelectedExIds({});
      qc.invalidateQueries({ queryKey: ["session-homework-sent", sessionId] });
      qc.invalidateQueries({ queryKey: ["devoirs-formateur-all"] });
      onHomeworkSent?.();
    } catch (e: any) {
      toast.error("Erreur d'envoi", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const handleCloseSession = () => {
    if (!homeworkSent) return;
    // Open auto-generation dialog instead of closing directly
    setAutoGenOpen(true);
  };

  const handleAutoHomeworkSent = async () => {
    // After auto homework is sent, close the session
    setClosing(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ statut: "terminee" as any, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;

      toast.success("Séance clôturée !");
      onCloseSession?.();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setClosing(false);
    }
  };

  // Only show when session is active (en_cours or planifiee)
  if (sessionStatut === "terminee" || sessionStatut === "annulee") return null;

  return (
    <>
      <Card className="border-primary/30 bg-primary/5 print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Fin de séance
          </CardTitle>
          <CardDescription>
            Envoyez les devoirs aux élèves avant de clôturer la séance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Homework sent confirmation */}
          {homeworkSent && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                Devoirs envoyés ✅ — {sentHomework?.length} devoir(s) disponibles pour les élèves
              </p>
            </div>
          )}

          {/* Duration selector for auto-generation */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Temps de devoirs par élève
            </p>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <Button
                  key={d}
                  variant={selectedDuration === d ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => setSelectedDuration(d)}
                >
                  ⏱ {d} min
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Send homework button (manual) */}
            <Button
              variant={homeworkSent ? "outline" : "default"}
              className="gap-2"
              onClick={() => setSelectOpen(true)}
            >
              <Send className="h-4 w-4" />
              {homeworkSent ? "Envoyer d'autres devoirs" : "Envoyer les devoirs"}
            </Button>

            {/* Close session button → triggers auto-generation */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={!homeworkSent || closing}
                      onClick={handleCloseSession}
                    >
                      {closing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : !homeworkSent ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Clôturer la séance
                    </Button>
                  </span>
                </TooltipTrigger>
                {!homeworkSent && (
                  <TooltipContent>
                    <p>Envoyez les devoirs avant de clôturer la séance</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Manual exercise selection dialog */}
      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Sélectionner les exercices à envoyer comme devoirs
            </DialogTitle>
            <DialogDescription>
              Les exercices sélectionnés seront envoyés à tous les élèves du groupe.
              Ils seront disponibles après la séance.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-0">
            {loadingBank ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (bankExercises ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Aucun exercice dans la banque.</p>
                <p className="text-xs">Générez d'abord des exercices.</p>
              </div>
            ) : (
              (bankExercises ?? []).map((ex: any) => (
                <label
                  key={ex.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    selectedExIds[ex.id] ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={!!selectedExIds[ex.id]}
                    onCheckedChange={() => toggleEx(ex.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ex.titre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px]">{ex.competence}</Badge>
                      <span className="text-[10px] text-muted-foreground">{ex.format}</span>
                      <span className="text-[10px] text-muted-foreground">Niv. {ex.niveau_vise}</span>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
            <p className="text-xs text-muted-foreground flex-1">
              {selectedCount} exercice(s) sélectionné(s)
              {members ? ` · ${members.length} élève(s) dans le groupe` : ""}
            </p>
            <Button variant="outline" onClick={() => setSelectOpen(false)}>Annuler</Button>
            <Button onClick={handleSendHomework} disabled={sending || selectedCount === 0} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer {selectedCount > 0 ? `(${selectedCount})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-generation preview dialog */}
      <AutoHomeworkPreviewDialog
        open={autoGenOpen}
        onOpenChange={setAutoGenOpen}
        sessionId={sessionId}
        groupId={groupId}
        userId={userId}
        durationMinutes={selectedDuration}
        onSent={handleAutoHomeworkSent}
      />
    </>
  );
}
