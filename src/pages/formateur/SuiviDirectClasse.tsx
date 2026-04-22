import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  CheckCircle2,
  Clock,
  Users,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  UserX,
  Hourglass,
} from "lucide-react";
import LiveExercisesPanel from "@/components/LiveExercisesPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import CorrectionDetaillee from "@/components/CorrectionDetaillee";

type Session = {
  id: string;
  titre: string;
  date_seance: string;
  niveau_cible: string;
  group_id: string;
  statut: string;
  groups?: { nom: string } | null;
};

type Member = {
  eleve_id: string;
  eleve: { id: string; prenom: string; nom: string } | null;
};

type BilanTest = {
  id: string;
  session_id: string;
  statut: string;
  contenu: any;
  nb_questions: number;
  competences_couvertes: string[];
  created_at: string;
};

type BilanResult = {
  id: string;
  bilan_test_id: string;
  eleve_id: string;
  score_global: number;
  scores_par_competence: any;
  reponses: any;
  created_at: string;
};

function initials(prenom?: string, nom?: string) {
  return `${(prenom?.[0] ?? "").toUpperCase()}${(nom?.[0] ?? "").toUpperCase()}` || "?";
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (score >= 60) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
}

const SuiviDirectClasse = () => {
  const { user } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [openBilanAnswers, setOpenBilanAnswers] = useState<{
    bilan: BilanTest;
    result: BilanResult;
    eleveName: string;
  } | null>(null);

  // Sessions en cours (du formateur)
  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ["live-sessions-en-cours", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("id, titre, date_seance, niveau_cible, group_id, statut, groups:groups!inner(nom, formateur_id)")
        .eq("groups.formateur_id", user.id)
        .in("statut", ["en_cours", "planifiee"])
        .order("date_seance", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Session[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Auto-sélection de la 1re séance en_cours sinon la 1re planifiée
  useEffect(() => {
    if (!selectedSessionId && sessions && sessions.length > 0) {
      const enCours = sessions.find((s) => s.statut === "en_cours");
      setSelectedSessionId((enCours ?? sessions[0]).id);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions?.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  // Membres du groupe
  const { data: members } = useQuery({
    queryKey: ["live-members", selectedSession?.group_id],
    queryFn: async () => {
      if (!selectedSession?.group_id) return [];
      const { data, error } = await supabase
        .from("group_members")
        .select("eleve_id, eleve:profiles(id, prenom, nom)")
        .eq("group_id", selectedSession.group_id);
      if (error) throw error;
      return (data ?? []) as unknown as Member[];
    },
    enabled: !!selectedSession?.group_id,
  });

  // Présences
  const { data: presences } = useQuery({
    queryKey: ["live-presences", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [];
      const { data } = await supabase
        .from("presences")
        .select("eleve_id, present")
        .eq("session_id", selectedSessionId);
      return data ?? [];
    },
    enabled: !!selectedSessionId,
    refetchInterval: 15000,
  });

  // Bilans (tests de début de séance) envoyés pour cette séance
  const { data: bilans, isLoading: loadingBilans } = useQuery({
    queryKey: ["live-bilans", selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return [];
      const { data, error } = await supabase
        .from("bilan_tests")
        .select("id, session_id, statut, contenu, nb_questions, competences_couvertes, created_at")
        .eq("session_id", selectedSessionId)
        .eq("statut", "envoye")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BilanTest[];
    },
    enabled: !!selectedSessionId,
    refetchInterval: 15000,
  });

  // Résultats du / des bilans
  const bilanIds = useMemo(() => bilans?.map((b) => b.id) ?? [], [bilans]);
  const { data: bilanResults, refetch: refetchResults } = useQuery({
    queryKey: ["live-bilan-results", bilanIds.join(",")],
    queryFn: async () => {
      if (bilanIds.length === 0) return [];
      const { data, error } = await supabase
        .from("bilan_test_results")
        .select("id, bilan_test_id, eleve_id, score_global, scores_par_competence, reponses, created_at")
        .in("bilan_test_id", bilanIds);
      if (error) throw error;
      return (data ?? []) as BilanResult[];
    },
    enabled: bilanIds.length > 0,
    refetchInterval: 10000,
  });

  // Realtime
  useEffect(() => {
    if (bilanIds.length === 0) return;
    const channel = supabase
      .channel(`bilan-results-${bilanIds[0]}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bilan_test_results" },
        () => refetchResults(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bilanIds, refetchResults]);

  const presenceMap = useMemo(() => {
    const m = new Map<string, boolean>();
    (presences ?? []).forEach((p: any) => m.set(p.eleve_id, p.present));
    return m;
  }, [presences]);

  const presentMembers = useMemo(
    () => (members ?? []).filter((m) => presenceMap.get(m.eleve_id) !== false),
    [members, presenceMap],
  );

  // Header
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Activity className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Suivi en direct de la classe</h1>
          <p className="text-sm text-muted-foreground">
            Séance en cours, présences, et réponses au bilan de début de séance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchResults()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Sélecteur de séance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Séance suivie</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <Skeleton className="h-10 w-full" />
          ) : !sessions || sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune séance en cours ou planifiée.
            </p>
          ) : (
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une séance" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          s.statut === "en_cours"
                            ? "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30"
                            : ""
                        }
                      >
                        {s.statut === "en_cours" ? "En cours" : "Planifiée"}
                      </Badge>
                      {s.titre} · {s.groups?.nom}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedSession && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="h-3.5 w-3.5" /> Inscrits
                </div>
                <p className="text-2xl font-bold">{members?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Présents
                </div>
                <p className="text-2xl font-bold">{presentMembers.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <ClipboardList className="h-3.5 w-3.5" /> Bilans envoyés
                </div>
                <p className="text-2xl font-bold">{bilans?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3.5 w-3.5" /> Réponses reçues
                </div>
                <p className="text-2xl font-bold">{bilanResults?.length ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Bilan(s) de début de séance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Bilan de début de séance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBilans ? (
                <Skeleton className="h-32 w-full" />
              ) : !bilans || bilans.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Aucun bilan de début de séance n'a encore été envoyé pour cette séance.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Va dans <strong>Piloter la séance</strong> → bloc « Bilan de début de séance » pour le générer.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {bilans.map((bilan) => {
                    const results = (bilanResults ?? []).filter((r) => r.bilan_test_id === bilan.id);
                    const resultMap = new Map(results.map((r) => [r.eleve_id, r]));
                    const totalPresents = presentMembers.length || (members?.length ?? 0);
                    const repondus = results.length;
                    const tauxReponse = totalPresents > 0 ? Math.round((repondus / totalPresents) * 100) : 0;
                    const moyenne =
                      results.length > 0
                        ? Math.round(
                            results.reduce((s, r) => s + Number(r.score_global || 0), 0) / results.length,
                          )
                        : 0;

                    return (
                      <div key={bilan.id} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{bilan.nb_questions} questions</Badge>
                            {(bilan.competences_couvertes ?? []).map((c) => (
                              <Badge key={c} variant="outline" className="bg-primary/5">
                                {c}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-muted-foreground">
                              {repondus}/{totalPresents} ({tauxReponse}%)
                            </span>
                            {results.length > 0 && (
                              <Badge variant="outline" className={scoreColor(moyenne)}>
                                Moyenne : {moyenne}%
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {(members ?? []).map((m) => {
                            const r = resultMap.get(m.eleve_id);
                            const present = presenceMap.get(m.eleve_id) !== false;
                            const scoresComp = (r?.scores_par_competence ?? {}) as Record<string, number>;
                            const score = r ? Math.round(Number(r.score_global)) : null;
                            const accentBorder = !present
                              ? "border-l-muted-foreground/40"
                              : !r
                                ? "border-l-amber-400"
                                : score! >= 80
                                  ? "border-l-emerald-500"
                                  : score! >= 60
                                    ? "border-l-amber-500"
                                    : "border-l-red-500";
                            const scoreText = !r
                              ? "text-muted-foreground"
                              : score! >= 80
                                ? "text-emerald-600 dark:text-emerald-400"
                                : score! >= 60
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400";
                            return (
                              <Card
                                key={m.eleve_id}
                                onClick={() => {
                                  if (r) {
                                    setOpenBilanAnswers({
                                      bilan,
                                      result: r,
                                      eleveName: `${m.eleve?.prenom ?? ""} ${m.eleve?.nom ?? ""}`.trim(),
                                    });
                                  }
                                }}
                                className={`border-l-4 ${accentBorder} ${!present ? "opacity-60" : ""} ${r ? "cursor-pointer hover:shadow-md hover:border-primary/40" : ""} transition-all`}
                              >
                                <CardContent className="p-4 space-y-3">
                                  {/* Header: avatar + name + status badge */}
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
                                        ) : !r ? (
                                          <span className="text-[11px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                                            <Hourglass className="h-3 w-3" /> En attente
                                          </span>
                                        ) : (
                                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Répondu
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className={`text-2xl font-black tabular-nums ${scoreText}`}>
                                      {score !== null ? `${score}%` : "—"}
                                    </div>
                                  </div>

                                  {/* Progress bar du score global */}
                                  {r && (
                                    <Progress
                                      value={score!}
                                      className="h-1.5"
                                    />
                                  )}

                                  {/* Mini gauges par compétence */}
                                  {r && Object.keys(scoresComp).length > 0 ? (
                                    <div className="space-y-1.5 pt-1">
                                      {Object.entries(scoresComp).map(([comp, s]) => {
                                        const v = Math.round(Number(s));
                                        return (
                                          <div key={comp} className="flex items-center gap-2">
                                            <span className="text-[11px] font-medium w-16 text-muted-foreground">{comp}</span>
                                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${
                                                  v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-500"
                                                }`}
                                                style={{ width: `${Math.min(100, v)}%` }}
                                              />
                                            </div>
                                            <span className={`text-[11px] tabular-nums w-9 text-right font-medium ${
                                              v >= 80 ? "text-emerald-600 dark:text-emerald-400" : v >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                                            }`}>
                                              {v}%
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : !r && present ? (
                                    <p className="text-[11px] text-muted-foreground italic pt-1">
                                      Pas encore de réponse soumise.
                                    </p>
                                  ) : null}
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exercices en cours (session_exercices + devoirs) */}
          <LiveExercisesPanel
            sessionId={selectedSession.id}
            groupId={selectedSession.group_id}
            members={members ?? []}
            presenceMap={presenceMap}
            sessionDate={selectedSession.date_seance}
          />
        </>
      )}

      {/* Dialog réponses bilan */}
      <Dialog open={!!openBilanAnswers} onOpenChange={(o) => !o && setOpenBilanAnswers(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Réponses de {openBilanAnswers?.eleveName}
            </DialogTitle>
            <DialogDescription>
              Bilan de début de séance · {openBilanAnswers?.bilan.nb_questions} questions
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4 -mr-4">
            {openBilanAnswers && (() => {
              const reponses = openBilanAnswers.result.reponses as any;
              const contenu = openBilanAnswers.bilan.contenu as any;
              const questions: any[] = Array.isArray(contenu) ? contenu : (contenu?.questions ?? contenu?.items ?? []);
              const items = questions.map((q: any, idx: number) => {
                const key = q.id ?? String(idx);
                const reponseEleve = reponses?.[key] ?? reponses?.[idx] ?? "—";
                const bonneReponse = q.bonne_reponse ?? q.reponse_correcte ?? q.correct_answer ?? "";
                const correct = String(reponseEleve).trim().toLowerCase() === String(bonneReponse).trim().toLowerCase();
                return {
                  question: q.enonce ?? q.question ?? q.consigne ?? `Question ${idx + 1}`,
                  reponse_eleve: reponseEleve,
                  bonne_reponse: bonneReponse,
                  correct,
                  explication: q.explication,
                };
              });
              return (
                <CorrectionDetaillee
                  itemResults={items}
                  scoreNormalized={Math.round(Number(openBilanAnswers.result.score_global ?? 0))}
                />
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuiviDirectClasse;
