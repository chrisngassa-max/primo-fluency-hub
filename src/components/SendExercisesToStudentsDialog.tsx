import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { BookOpen, Calendar, Loader2, Radio, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendLibraryExercisesToStudents } from "@/lib/sessionDistribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SessionOption {
  id: string;
  titre: string;
  date_seance: string;
  statut: string;
  group_nom?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseIds: string[];
  /** session_id le plus récent par exercice (premier lien session_exercices) */
  exerciseOriginSessionMap?: Map<string, string>;
  onSent?: () => void;
}

function formatSessionLabel(session: SessionOption) {
  const date = format(new Date(session.date_seance), "EEE d MMM · HH:mm", { locale: fr });
  const group = session.group_nom ? ` · ${session.group_nom}` : "";
  return `${session.titre} — ${date}${group}`;
}

export default function SendExercisesToStudentsDialog({
  open,
  onOpenChange,
  exerciseIds,
  exerciseOriginSessionMap,
  onSent,
}: Props) {
  const { user } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["formateur-send-sessions", user?.id],
    queryFn: async (): Promise<SessionOption[]> => {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, nom")
        .eq("formateur_id", user!.id)
        .eq("is_active", true);
      if (!groups?.length) return [];

      const groupMap = Object.fromEntries(groups.map((g) => [g.id, g.nom]));
      const groupIds = groups.map((g) => g.id);

      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, statut, group_id")
        .in("group_id", groupIds)
        .not("statut", "in", "(terminee,annulee)")
        .order("date_seance", { ascending: false })
        .limit(30);
      if (error) throw error;

      return (data ?? []).map((s) => ({
        ...s,
        group_nom: groupMap[s.group_id] || undefined,
      }));
    },
    enabled: open && !!user,
  });

  const { data: todayLessons = [] } = useQuery({
    queryKey: ["formateur-today-lessons", user?.id, sessions.map((s) => s.id).join(",")],
    queryFn: async () => {
      const todayIds = sessions
        .filter((s) => {
          const d = new Date(s.date_seance);
          const now = new Date();
          return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          );
        })
        .map((s) => s.id);
      if (todayIds.length === 0) return [];

      const { data, error } = await supabase
        .from("ressources_pedagogiques" as never)
        .select("id, titre, session_id")
        .in("session_id", todayIds)
        .eq("type", "lecon");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && sessions.length > 0,
  });

  const activeSession = useMemo(
    () => sessions.find((s) => s.statut === "en_cours") ?? null,
    [sessions],
  );

  const todaySession = useMemo(() => {
    const now = new Date();
    return (
      sessions.find((s) => {
        const d = new Date(s.date_seance);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }) ?? null
    );
  }, [sessions]);

  const originSessionId = useMemo(() => {
    if (!exerciseOriginSessionMap || exerciseIds.length === 0) return null;
    const counts = new Map<string, number>();
    for (const exId of exerciseIds) {
      const sid = exerciseOriginSessionMap.get(exId);
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [sid, count] of counts) {
      if (count > bestCount) {
        best = sid;
        bestCount = count;
      }
    }
    return best;
  }, [exerciseIds, exerciseOriginSessionMap]);

  const defaultSessionId = useMemo(() => {
    if (activeSession) return activeSession.id;
    if (todaySession) return todaySession.id;
    if (originSessionId && sessions.some((s) => s.id === originSessionId)) return originSessionId;
    return sessions[0]?.id ?? "";
  }, [activeSession, todaySession, originSessionId, sessions]);

  useEffect(() => {
    if (open && defaultSessionId) {
      setSelectedSessionId(defaultSessionId);
    }
  }, [open, defaultSessionId]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const lessonForSession = todayLessons.find((l: { session_id: string }) => l.session_id === selectedSessionId);

  const handleSend = async () => {
    if (!selectedSessionId || exerciseIds.length === 0) return;
    setSending(true);
    try {
      await sendLibraryExercisesToStudents({
        sessionId: selectedSessionId,
        exerciseIds,
      });
      toast.success(
        `${exerciseIds.length} exercice${exerciseIds.length > 1 ? "s" : ""} envoyé${exerciseIds.length > 1 ? "s" : ""} aux élèves`,
        {
          description: selectedSession
            ? `Via la séance « ${selectedSession.titre} »`
            : undefined,
        },
      );
      onSent?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error("Envoi impossible", { description: message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Envoyer aux élèves
          </DialogTitle>
          <DialogDescription>
            {exerciseIds.length === 1
              ? "1 exercice sélectionné sera visible sur l'espace élève."
              : `${exerciseIds.length} exercices sélectionnés seront visibles sur l'espace élève.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des séances…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Aucune séance disponible. Créez une séance avant d'envoyer des exercices.
          </p>
        ) : (
          <div className="space-y-4">
            {activeSession && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Séance en cours</p>
                  <Badge variant="default" className="text-[10px]">Active</Badge>
                </div>
                <p className="text-sm">{formatSessionLabel(activeSession)}</p>
              </div>
            )}

            {todaySession && todaySession.id !== activeSession?.id && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <p className="text-sm font-semibold">Séance du jour</p>
                </div>
                <p className="text-sm">{formatSessionLabel(todaySession)}</p>
              </div>
            )}

            {lessonForSession && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-700 dark:text-violet-400" />
                  <p className="text-sm font-semibold">Leçon de la séance</p>
                </div>
                <p className="text-sm">{(lessonForSession as { titre: string }).titre}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Séance cible</Label>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une séance…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {formatSessionLabel(s)}
                        {s.statut === "en_cours" && (
                          <Badge variant="secondary" className="text-[10px]">En cours</Badge>
                        )}
                        {s.id === originSessionId && (
                          <Badge variant="outline" className="text-[10px]">Création</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {originSessionId && selectedSessionId === originSessionId && (
                <p className="text-xs text-muted-foreground">
                  Séance d'origine des exercices sélectionnés (par défaut).
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button
            className="gap-2"
            disabled={sending || !selectedSessionId || sessions.length === 0}
            onClick={handleSend}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
