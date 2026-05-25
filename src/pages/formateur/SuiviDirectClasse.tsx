import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Zap,
  Send,
  Volume2,
} from "lucide-react";
import LiveExercisesPanel from "@/components/LiveExercisesPanel";
import { useLiveSession, type NiveauxEleve } from "@/hooks/useLiveSession";
import { TuileEleveLive } from "@/components/formateur/TuileEleveLive";
import { FocusEleveSheet } from "@/components/formateur/FocusEleveSheet";
import { FinAtelierDialog } from "@/components/formateur/FinAtelierDialog";
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

// Sprint 6 — ligne d'intervention dans le dialog de sélection
function InterventionRow({
  iv,
  sending,
  onSend,
}: {
  iv: { id: string; titre: string; contenu_texte: string; type_erreur_id: string | null; audio_url: string | null };
  sending: boolean;
  onSend: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card p-3">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">{iv.titre}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{iv.contenu_texte}</p>
        {iv.audio_url && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
            <Volume2 className="h-2.5 w-2.5" /> Audio disponible
          </span>
        )}
      </div>
      <Button
        size="sm"
        className="shrink-0 h-8 gap-1.5 text-[11px]"
        disabled={sending}
        onClick={onSend}
      >
        {sending ? (
          <span className="h-3 w-3 rounded-full border-2 border-t-transparent border-white animate-spin" />
        ) : (
          <Send className="h-3 w-3" />
        )}
        Envoyer
      </Button>
    </div>
  );
}

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

  // Sprint 6 — envoi intervention
  const [interventionTarget, setInterventionTarget] = useState<Member | null>(null);
  const [sendingInterventionId, setSendingInterventionId] = useState<string | null>(null);

  // Sprint 7 — focus 1-to-1
  const [focusEleve, setFocusEleve] = useState<Member | null>(null);

  // Sprint 8 — fin d'atelier
  const [finAtelierOpen, setFinAtelierOpen] = useState(false);

  // Bibliothèque d'interventions — Sprint 6
  const { data: interventionsLib } = useQuery({
    queryKey: ["interventions-lib", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("interventions")
        .select("id, titre, contenu_texte, type_erreur_id, competence, niveau_cible, audio_url")
        .eq("formateur_id", user.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Array<{
        id: string; titre: string; contenu_texte: string;
        type_erreur_id: string | null; competence: string | null;
        niveau_cible: string | null; audio_url: string | null;
      }>;
    },
    enabled: !!user?.id,
  });

  // Niveaux CECRL par élève — Sprint 4 priorité (group_id résolu plus bas via selectedSession)
  const [niveauGroupId, setNiveauGroupId] = useState<string | null>(null);
  const { data: niveauxData } = useQuery({
    queryKey: ["live-niveaux", niveauGroupId],
    queryFn: async () => {
      if (!niveauGroupId) return [];
      const { data: gm } = await supabase
        .from("group_members")
        .select("eleve_id")
        .eq("group_id", niveauGroupId);
      const ids = (gm ?? []).map((r: any) => r.eleve_id as string);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("profils_eleves")
        .select("eleve_id, niveau_co, niveau_ce, niveau_ee, niveau_eo")
        .in("eleve_id", ids);
      return (data ?? []) as Array<{ eleve_id: string } & NiveauxEleve>;
    },
    enabled: !!niveauGroupId,
  });

  const niveauxMap = useMemo(() => {
    const m = new Map<string, NiveauxEleve>();
    (niveauxData ?? []).forEach((r) => m.set(r.eleve_id, r));
    return m;
  }, [niveauxData]);

  // Live events du Mode Atelier IA
  const { events: liveEvents, recentFeed, eleveStateMap, prioriteMap, connected: liveConnected } =
    useLiveSession(selectedSessionId || null, niveauxMap);

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
      <div className="relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Activity className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-primary">Suivi en direct de la classe</h1>
              <p className="text-sm text-muted-foreground">
                Séance en cours, présences, et réponses au bilan de début de séance.
              </p>
            </div>
          </div>
          <Button variant="default" size="sm" onClick={() => refetchResults()} className="gap-2 self-start sm:self-auto">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5 shadow-sm">
              <CardContent className="pt-6">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-3.5 w-3.5" /></span> Inscrits
                </div>
                <p className="text-2xl font-bold">{members?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5 shadow-sm">
              <CardContent className="pt-6">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 className="h-3.5 w-3.5" /></span> Présents
                </div>
                <p className="text-2xl font-bold">{presentMembers.length}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5 shadow-sm">
              <CardContent className="pt-6">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-3.5 w-3.5" /></span> Bilans envoyés
                </div>
                <p className="text-2xl font-bold">{bilans?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5 shadow-sm">
              <CardContent className="pt-6">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Clock className="h-3.5 w-3.5" /></span> Réponses reçues
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

          {/* Atelier en cours — Sprint 4 dashboard priorisé */}
          {(recentFeed.length > 0 || liveConnected) && (() => {
            // Élèves triés par priorité décroissante
            const alertEleves = presentMembers
              .filter((m) => (prioriteMap.get(m.eleve_id) ?? 0) > 10)
              .sort((a, b) => (prioriteMap.get(b.eleve_id) ?? 0) - (prioriteMap.get(a.eleve_id) ?? 0));
            const suggestEleves = presentMembers
              .filter((m) => {
                const p = prioriteMap.get(m.eleve_id) ?? 0;
                return p >= 4 && p <= 10;
              })
              .sort((a, b) => (prioriteMap.get(b.eleve_id) ?? 0) - (prioriteMap.get(a.eleve_id) ?? 0));

            const evLabel: Record<string, string> = {
              exercice_demarre: "a commencé un exercice",
              reponse_correcte: "a réussi",
              reponse_incorrecte: "a eu des difficultés",
              exercice_termine: "a terminé un exercice",
              fiche_terminee: "a terminé sa fiche",
              inactif: "inactif",
              aide_demandee: "a demandé de l'aide",
              intervention_recue: "a reçu une aide",
              erreur_repetee: "répète la même erreur",
            };

            return (
              <>
                {/* Bannière rouge — interventions urgentes */}
                {alertEleves.length > 0 && (
                  <div className="rounded-lg border border-red-500/40 bg-red-50/80 dark:bg-red-950/30 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Intervention recommandée
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {alertEleves.map((m) => {
                        const state = eleveStateMap.get(m.eleve_id);
                        const p = prioriteMap.get(m.eleve_id) ?? 0;
                        return (
                          <span
                            key={m.eleve_id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-[12px] font-medium text-red-800 dark:text-red-200"
                          >
                            {m.eleve?.prenom} {m.eleve?.nom}
                            <span className="tabular-nums text-red-500 font-bold">{p.toFixed(0)}</span>
                            {state?.dernier_type_erreur && (
                              <span className="text-red-600/70 dark:text-red-400/70 text-[10px]">
                                · {state.dernier_type_erreur}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Atelier en cours
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-7 text-[11px] gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setFinAtelierOpen(true)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Fin d'atelier
                      </Button>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded-full ${
                          liveConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            liveConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
                          }`}
                        />
                        {liveConnected ? "En direct" : "Connexion…"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Grille de tuiles */}
                    {presentMembers.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                        {presentMembers.map((m) => (
                          <TuileEleveLive
                            key={m.eleve_id}
                            prenom={m.eleve?.prenom ?? ""}
                            nom={m.eleve?.nom ?? ""}
                            state={eleveStateMap.get(m.eleve_id)}
                            priorite={prioriteMap.get(m.eleve_id) ?? 0}
                            onIntervenir={() => setInterventionTarget(m)}
                            onFocus={() => setFocusEleve(m)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Bannière orange — suggestions groupées */}
                    {suggestEleves.length > 0 && (
                      <div className="rounded-md border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] font-semibold">
                          <Zap className="h-3.5 w-3.5" />
                          Suivi conseillé
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestEleves.map((m) => {
                            const p = prioriteMap.get(m.eleve_id) ?? 0;
                            return (
                              <span
                                key={m.eleve_id}
                                className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200"
                              >
                                {m.eleve?.prenom}
                                <span className="font-bold tabular-nums">{p.toFixed(0)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Feed des derniers événements */}
                    {recentFeed.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                          Activité récente
                        </p>
                        {recentFeed.map((ev) => {
                          const member = (members ?? []).find((m) => m.eleve_id === ev.eleve_id);
                          const prenom = member?.eleve?.prenom ?? "Élève";
                          const label = evLabel[ev.event_type] ?? ev.event_type;
                          const score = (ev.payload as any)?.score;
                          return (
                            <div key={ev.id} className="flex items-center gap-2 text-[12px] py-0.5">
                              <span className="text-muted-foreground shrink-0 tabular-nums">
                                {new Date(ev.created_at).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                              <span className="font-medium text-foreground">{prenom}</span>
                              <span className="text-muted-foreground">{label}</span>
                              {score != null && (
                                <span
                                  className={`font-bold tabular-nums ${
                                    score >= 60 ? "text-emerald-600" : "text-red-500"
                                  }`}
                                >
                                  {score}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {recentFeed.length === 0 && liveConnected && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        En attente des premières activités des élèves…
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}

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

      {/* Dialog fin d'atelier — Sprint 8 */}
      {finAtelierOpen && selectedSessionId && (
        <FinAtelierDialog
          open={finAtelierOpen}
          onClose={() => setFinAtelierOpen(false)}
          sessionId={selectedSessionId}
          formateurId={user!.id}
          presentMembers={presentMembers}
          liveEvents={liveEvents}
          niveauxMap={niveauxMap}
        />
      )}

      {/* Sheet focus 1-to-1 — Sprint 7 */}
      {focusEleve && (
        <FocusEleveSheet
          prenom={focusEleve.eleve?.prenom ?? ""}
          nom={focusEleve.eleve?.nom ?? ""}
          eleveId={focusEleve.eleve_id}
          state={eleveStateMap.get(focusEleve.eleve_id)}
          priorite={prioriteMap.get(focusEleve.eleve_id) ?? 0}
          niveaux={niveauxMap.get(focusEleve.eleve_id)}
          allEvents={liveEvents}
          onClose={() => setFocusEleve(null)}
          onIntervenir={() => {
            setInterventionTarget(focusEleve);
            setFocusEleve(null);
          }}
        />
      )}

      {/* Dialog envoi intervention — Sprint 6 */}
      {interventionTarget && (() => {
        const targetState = eleveStateMap.get(interventionTarget.eleve_id);
        const erreurCible = targetState?.dernier_type_erreur ?? null;
        const suggested = erreurCible
          ? (interventionsLib ?? []).filter((iv) => iv.type_erreur_id === erreurCible)
          : [];
        const autres = (interventionsLib ?? []).filter(
          (iv) => !erreurCible || iv.type_erreur_id !== erreurCible,
        );

        async function sendIntervention(iv: (typeof interventionsLib)[0]) {
          if (!selectedSessionId || sendingInterventionId) return;
          setSendingInterventionId(iv.id);
          try {
            const { error } = await supabase.from("session_live_events").insert({
              session_id: selectedSessionId,
              eleve_id: interventionTarget!.eleve_id,
              event_type: "intervention_recue",
              payload: {
                intervention_id: iv.id,
                titre: iv.titre,
                contenu_texte: iv.contenu_texte,
                audio_url: iv.audio_url ?? null,
              },
            });
            if (error) throw error;
            setInterventionTarget(null);
          } catch (e: any) {
            console.error("sendIntervention failed:", e.message);
          } finally {
            setSendingInterventionId(null);
          }
        }

        const ErreurLabels: Record<string, string> = {
          LEX_CONFUSION: "Lexique", CONSIGNE_NC: "Consigne", GRAM_ACCORD: "Accord",
          GRAM_TEMPS: "Temps verbal", HORS_SUJET: "Hors sujet", INTERPRETATION: "Interprétation",
          JUSTIFICATION: "Justification", PHONO: "Phonologie", PRODUCTION_COURTE: "Prod. courte",
          REGISTRE: "Registre", COHERENCE_ADMIN: "Cohérence admin.",
        };

        return (
          <Dialog open onOpenChange={(o) => !o && setInterventionTarget(null)}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Envoyer une aide à {interventionTarget.eleve?.prenom} {interventionTarget.eleve?.nom}
                </DialogTitle>
                {erreurCible && (
                  <DialogDescription>
                    Dernière difficulté : <strong>{ErreurLabels[erreurCible] ?? erreurCible}</strong>
                  </DialogDescription>
                )}
              </DialogHeader>

              <ScrollArea className="flex-1 pr-1">
                {(interventionsLib ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucune intervention dans la bibliothèque.
                    <br />
                    <span className="text-xs">
                      Créez-en depuis <em>Bibliothèque interventions</em>.
                    </span>
                  </p>
                ) : (
                  <div className="space-y-4">
                    {suggested.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Suggérées pour {ErreurLabels[erreurCible!] ?? erreurCible}
                        </p>
                        {suggested.map((iv) => (
                          <InterventionRow
                            key={iv.id}
                            iv={iv}
                            sending={sendingInterventionId === iv.id}
                            onSend={() => sendIntervention(iv)}
                          />
                        ))}
                      </div>
                    )}
                    {autres.length > 0 && (
                      <div className="space-y-2">
                        {suggested.length > 0 && (
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Autres
                          </p>
                        )}
                        {autres.map((iv) => (
                          <InterventionRow
                            key={iv.id}
                            iv={iv}
                            sending={sendingInterventionId === iv.id}
                            onSend={() => sendIntervention(iv)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        );
      })()}

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
