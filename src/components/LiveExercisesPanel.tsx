import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import StudentAnswersDialog from "@/components/StudentAnswersDialog";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  CheckCircle2,
  Hourglass,
  PlayCircle,
  UserX,
  BookOpen,
  Send,
} from "lucide-react";

type Member = {
  eleve_id: string;
  eleve: { id: string; prenom: string; nom: string } | null;
};

type SessionExercice = {
  id: string;
  exercice_id: string;
  eleve_id: string | null;
  is_sent: boolean;
  statut: string;
  created_at: string;
  exercice: {
    id: string;
    titre: string;
    competence: string;
    format: string;
    contenu: any;
  } | null;
};

type Devoir = {
  id: string;
  exercice_id: string;
  eleve_id: string;
  statut: string;
  created_at: string;
  contexte: string;
  exercice: {
    id: string;
    titre: string;
    competence: string;
    format: string;
    contenu: any;
  } | null;
};

type Attempt = {
  id: string;
  exercise_id: string;
  learner_id: string;
  status: string;
  score_normalized: number | null;
  item_results: any;
  completed_at: string | null;
  started_at: string | null;
};

function initials(prenom?: string, nom?: string) {
  return `${(prenom?.[0] ?? "").toUpperCase()}${(nom?.[0] ?? "").toUpperCase()}` || "?";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function borderColor(score: number | null, hasStarted: boolean, present: boolean) {
  if (!present) return "border-l-muted-foreground/40";
  if (score === null) return hasStarted ? "border-l-blue-500" : "border-l-amber-400";
  if (score >= 80) return "border-l-emerald-500";
  if (score >= 60) return "border-l-amber-500";
  return "border-l-red-500";
}

interface Props {
  sessionId: string;
  groupId: string;
  members: Member[];
  presenceMap: Map<string, boolean>;
  sessionDate: string; // ISO date — pour filtrer les devoirs faits "pendant" la séance
}

export default function LiveExercisesPanel({
  sessionId,
  groupId,
  members,
  presenceMap,
  sessionDate,
}: Props) {
  const [openAnswers, setOpenAnswers] = useState<{
    exerciceId: string;
    eleveId: string;
    eleveName: string;
    exerciceTitre?: string;
  } | null>(null);

  // 1. Exercices envoyés via session_exercices
  const { data: sessionExercices, refetch: refetchSE, isLoading: loadingSE } = useQuery({
    queryKey: ["live-session-exercices", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select(
          "id, exercice_id, eleve_id, is_sent, statut, created_at, exercice:exercices(id, titre, competence, format, contenu)"
        )
        .eq("session_id", sessionId)
        .eq("is_sent", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SessionExercice[];
    },
    enabled: !!sessionId,
    refetchInterval: 15000,
  });

  // 2. Devoirs des élèves du groupe créés autour de la séance (24h avant -> maintenant)
  const sessionDayStart = useMemo(() => {
    const d = new Date(sessionDate);
    d.setHours(d.getHours() - 2);
    return d.toISOString();
  }, [sessionDate]);

  const memberIds = useMemo(() => members.map((m) => m.eleve_id), [members]);

  const { data: devoirs, refetch: refetchDevoirs, isLoading: loadingDevoirs } = useQuery({
    queryKey: ["live-devoirs", sessionId, memberIds.join(",")],
    queryFn: async () => {
      if (memberIds.length === 0) return [];
      const { data, error } = await supabase
        .from("devoirs")
        .select(
          "id, exercice_id, eleve_id, statut, created_at, contexte, exercice:exercices(id, titre, competence, format, contenu)"
        )
        .in("eleve_id", memberIds)
        .gte("created_at", sessionDayStart)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Devoir[];
    },
    enabled: memberIds.length > 0,
    refetchInterval: 20000,
  });

  // 3. Attempts pour tous les exercices listés
  const exerciceIds = useMemo(() => {
    const set = new Set<string>();
    (sessionExercices ?? []).forEach((se) => se.exercice_id && set.add(se.exercice_id));
    (devoirs ?? []).forEach((d) => d.exercice_id && set.add(d.exercice_id));
    return Array.from(set);
  }, [sessionExercices, devoirs]);

  const { data: attempts, refetch: refetchAttempts } = useQuery({
    queryKey: ["live-attempts", exerciceIds.join(",")],
    queryFn: async () => {
      if (exerciceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("exercise_attempts")
        .select("id, exercise_id, learner_id, status, score_normalized, item_results, completed_at, started_at")
        .in("exercise_id", exerciceIds);
      if (error) throw error;
      return (data ?? []) as Attempt[];
    },
    enabled: exerciceIds.length > 0,
    refetchInterval: 5000,
  });

  // Realtime sur exercise_attempts
  useEffect(() => {
    if (exerciceIds.length === 0) return;
    const channel = supabase
      .channel(`live-attempts-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercise_attempts" },
        () => refetchAttempts()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [exerciceIds, sessionId, refetchAttempts]);

  // Map attempts par couple (exercise_id, learner_id) — privilégier completed > in_progress
  const attemptMap = useMemo(() => {
    const m = new Map<string, Attempt>();
    (attempts ?? []).forEach((a) => {
      const key = `${a.exercise_id}:${a.learner_id}`;
      const existing = m.get(key);
      if (!existing) m.set(key, a);
      else {
        // completed wins
        if (a.status === "completed" && existing.status !== "completed") m.set(key, a);
        else if (a.status === existing.status) {
          // garde le plus récent
          const aDate = a.completed_at || a.started_at || "";
          const eDate = existing.completed_at || existing.started_at || "";
          if (aDate > eDate) m.set(key, a);
        }
      }
    });
    return m;
  }, [attempts]);

  // Construire la liste unifiée des "exercices live" à afficher
  type LiveExo = {
    key: string;
    source: "session" | "devoir";
    exercice_id: string;
    exercice: SessionExercice["exercice"];
    target_eleve_id: string | null; // null = collectif (toute la classe), sinon ciblé
    label: string;
    created_at: string;
  };

  const liveExos: LiveExo[] = useMemo(() => {
    const list: LiveExo[] = [];
    (sessionExercices ?? []).forEach((se) => {
      if (!se.exercice) return;
      list.push({
        key: `se-${se.id}`,
        source: "session",
        exercice_id: se.exercice_id,
        exercice: se.exercice,
        target_eleve_id: se.eleve_id,
        label: se.eleve_id ? "Exercice ciblé" : "Exercice de séance",
        created_at: se.created_at,
      });
    });
    (devoirs ?? []).forEach((d) => {
      if (!d.exercice) return;
      // Eviter de dupliquer si l'exercice est déjà listé dans session_exercices pour ce même élève
      const dupe = list.some(
        (l) => l.exercice_id === d.exercice_id && (l.target_eleve_id === d.eleve_id || l.target_eleve_id === null)
      );
      if (dupe) return;
      list.push({
        key: `dev-${d.id}`,
        source: "devoir",
        exercice_id: d.exercice_id,
        exercice: d.exercice,
        target_eleve_id: d.eleve_id,
        label: "Devoir",
        created_at: d.created_at,
      });
    });
    return list;
  }, [sessionExercices, devoirs]);

  if (loadingSE || loadingDevoirs) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (liveExos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Exercices en cours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center space-y-2">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Aucun exercice envoyé pour cette séance pour le moment.
            </p>
            <p className="text-xs text-muted-foreground">
              Les exercices envoyés pendant la séance apparaîtront ici en temps réel.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Exercices en cours ({liveExos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {liveExos.map((exo) => {
          // Cibles : si exercice ciblé sur 1 élève, afficher juste lui, sinon tous les membres
          const targets = exo.target_eleve_id
            ? members.filter((m) => m.eleve_id === exo.target_eleve_id)
            : members;

          const completedCount = targets.filter((m) => {
            const a = attemptMap.get(`${exo.exercice_id}:${m.eleve_id}`);
            return a?.status === "completed";
          }).length;

          const inProgressCount = targets.filter((m) => {
            const a = attemptMap.get(`${exo.exercice_id}:${m.eleve_id}`);
            return a?.status === "in_progress";
          }).length;

          const scoresCompleted = targets
            .map((m) => attemptMap.get(`${exo.exercice_id}:${m.eleve_id}`))
            .filter((a) => a?.status === "completed" && a.score_normalized != null)
            .map((a) => Math.round((a!.score_normalized as number) * 100));
          const moyenne =
            scoresCompleted.length > 0
              ? Math.round(scoresCompleted.reduce((s, v) => s + v, 0) / scoresCompleted.length)
              : null;

          return (
            <div key={exo.key} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    {exo.label}
                  </Badge>
                  <span className="text-sm font-semibold">{exo.exercice?.titre}</span>
                  <Badge variant="outline" className="text-xs">
                    {exo.exercice?.competence}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {exo.exercice?.format?.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {completedCount}/{targets.length} terminé
                    {inProgressCount > 0 && ` · ${inProgressCount} en cours`}
                  </span>
                  {moyenne !== null && (
                    <Badge variant="outline" className={scoreColor(moyenne)}>
                      Moyenne : {moyenne}%
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {targets.map((m) => {
                  const present = presenceMap.get(m.eleve_id) !== false;
                  const a = attemptMap.get(`${exo.exercice_id}:${m.eleve_id}`);
                  const status = a?.status ?? "not_started";
                  const ir = a?.item_results as any;
                  const answered = ir?.answered ?? 0;
                  const total = ir?.total ?? (exo.exercice?.contenu?.items?.length ?? 0);
                  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
                  const score = a?.score_normalized != null ? Math.round(a.score_normalized * 100) : null;
                  const displayScore = status === "completed" ? score : null;
                  const accent = borderColor(displayScore, status !== "not_started", present);

                  return (
                    <Card
                      key={m.eleve_id}
                      onClick={() => {
                        if (status !== "not_started") {
                          setOpenAnswers({
                            exerciceId: exo.exercice_id,
                            eleveId: m.eleve_id,
                            eleveName: `${m.eleve?.prenom ?? ""} ${m.eleve?.nom ?? ""}`.trim(),
                            exerciceTitre: exo.exercice?.titre,
                          });
                        }
                      }}
                      className={`border-l-4 ${accent} ${!present ? "opacity-60" : ""} ${status !== "not_started" ? "cursor-pointer hover:shadow-md hover:border-primary/40" : ""} transition-all`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                                {initials(m.eleve?.prenom, m.eleve?.nom)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {m.eleve?.prenom} {m.eleve?.nom}
                              </p>
                              {!present ? (
                                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                  <UserX className="h-3 w-3" /> Absent
                                </span>
                              ) : status === "not_started" ? (
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                                  <Hourglass className="h-3 w-3" /> En attente
                                </span>
                              ) : status === "in_progress" ? (
                                <span className="text-[11px] text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
                                  <PlayCircle className="h-3 w-3" /> En cours · {answered}/{total}
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Terminé
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`text-2xl font-black tabular-nums ${displayScore !== null ? scoreColor(displayScore) : "text-muted-foreground"}`}>
                            {displayScore !== null ? `${displayScore}%` : "—"}
                          </div>
                        </div>

                        {/* Barre d'avancement items */}
                        {status !== "not_started" && total > 0 && (
                          <div className="space-y-1">
                            <Progress value={status === "completed" ? 100 : progressPct} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground">
                              {status === "completed" ? `Score : ${displayScore ?? 0}%` : `${answered} sur ${total} questions`}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
