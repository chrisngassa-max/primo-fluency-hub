import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Brain, BookOpen, AlertTriangle, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle, Clock, Users, BarChart3, Target, Loader2,
  Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPETENCE_COLORS } from "@/lib/competences";

interface StartOfSessionBilanProps {
  sessionId: string;
  session: {
    id: string;
    titre: string;
    objectifs: string | null;
    niveau_cible: string;
    date_seance: string;
    group_id: string;
    competences_cibles?: string[] | null;
  };
  groupId: string;
  userId: string;
}

interface PrevSessionData {
  prevSessionId: string | null;
  prevSessionTitre: string | null;
  // Homework
  homeworkTotal: number;
  homeworkDone: number;
  homeworkExpired: number;
  homeworkPending: number;
  homeworkAvgScore: number;
  homeworkCompletionRate: number;
  homeworkLowScores: Array<{ eleve: string; exercice: string; score: number; competence: string }>;
  // Previous session exercise results
  sessionResultsCount: number;
  sessionAvgScore: number;
  sessionScoresByCompetence: Record<string, { avg: number; count: number }>;
  sessionLowScores: Array<{ eleve: string; exercice: string; score: number; competence: string }>;
  // Bilan test from previous session
  bilanTestId: string | null;
  bilanTestAvgScore: number;
  bilanTestScoresByComp: Record<string, number>;
  bilanTestParticipants: number;
  // Weak competences summary
  weakCompetences: string[];
  strongCompetences: string[];
}

const StartOfSessionBilan: React.FC<StartOfSessionBilanProps> = ({
  sessionId,
  session,
  groupId,
  userId,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [generatingDiag, setGeneratingDiag] = useState(false);

  // ─── Fetch comprehensive previous session data ───
  const { data: prevData, isLoading } = useQuery<PrevSessionData | null>({
    queryKey: ["start-of-session-bilan", groupId, sessionId],
    queryFn: async () => {
      // 1. Find previous session
      const { data: prevSessions } = await supabase
        .from("sessions")
        .select("id, titre")
        .eq("group_id", groupId)
        .lt("date_seance", session.date_seance)
        .order("date_seance", { ascending: false })
        .limit(1);

      if (!prevSessions || prevSessions.length === 0) return null;

      const prevSessionId = prevSessions[0].id;
      const prevSessionTitre = prevSessions[0].titre;

      // 2. Get group members
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, eleve:profiles(id, nom, prenom)")
        .eq("group_id", groupId);

      const memberIds = (members ?? []).map((m: any) => m.eleve_id);
      const memberMap = new Map<string, string>();
      (members ?? []).forEach((m: any) => {
        memberMap.set(m.eleve_id, `${m.eleve?.prenom || ""} ${m.eleve?.nom || ""}`);
      });

      // 3. Homework: ALL devoirs for group members between prev and current session
      const { data: devoirs } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(titre, competence)")
        .in("eleve_id", memberIds)
        .gte("created_at", prevSessions[0].date_seance || "2000-01-01")
        .lt("created_at", session.date_seance);

      // Also include devoirs explicitly linked to the previous session
      const { data: sessionDevoirs } = await supabase
        .from("devoirs")
        .select("*, exercice:exercices(titre, competence)")
        .eq("session_id", prevSessionId);

      // Merge and deduplicate
      const allDevoirsMap = new Map<string, any>();
      [...(devoirs ?? []), ...(sessionDevoirs ?? [])].forEach((d: any) => allDevoirsMap.set(d.id, d));
      const hw = Array.from(allDevoirsMap.values());

      const prevExIds = (prevSeExercices ?? []).map((se: any) => se.exercice_id);
      let sessionResultsCount = 0;
      let sessionAvgScore = 0;
      const sessionScoresByCompetence: Record<string, { avg: number; count: number; total: number }> = {};
      const sessionLowScores: PrevSessionData["sessionLowScores"] = [];

      if (prevExIds.length > 0 && memberIds.length > 0) {
        const { data: sessionResults } = await supabase
          .from("resultats")
          .select("score, eleve_id, exercice_id")
          .in("exercice_id", prevExIds)
          .in("eleve_id", memberIds);

        if (sessionResults && sessionResults.length > 0) {
          sessionResultsCount = sessionResults.length;
          sessionAvgScore = Math.round(sessionResults.reduce((s: number, r: any) => s + Number(r.score), 0) / sessionResults.length);

          // Group by competence
          sessionResults.forEach((r: any) => {
            const se = prevSeExercices?.find((s: any) => s.exercice_id === r.exercice_id);
            const comp = (se as any)?.exercice?.competence || "?";
            if (!sessionScoresByCompetence[comp]) {
              sessionScoresByCompetence[comp] = { avg: 0, count: 0, total: 0 };
            }
            sessionScoresByCompetence[comp].count++;
            sessionScoresByCompetence[comp].total += Number(r.score);
          });
          Object.keys(sessionScoresByCompetence).forEach((comp) => {
            const d = sessionScoresByCompetence[comp];
            d.avg = Math.round(d.total / d.count);
          });

          sessionResults
            .filter((r: any) => Number(r.score) < 60)
            .forEach((r: any) => {
              const se = prevSeExercices?.find((s: any) => s.exercice_id === r.exercice_id);
              sessionLowScores.push({
                eleve: memberMap.get(r.eleve_id) || "Élève",
                exercice: (se as any)?.exercice?.titre || "Exercice",
                score: Number(r.score),
                competence: (se as any)?.exercice?.competence || "?",
              });
            });
        }
      }

      // 5. Bilan test from previous session
      const { data: bilanTest } = await supabase
        .from("bilan_tests")
        .select("id")
        .eq("session_id", prevSessionId)
        .eq("statut", "envoye")
        .maybeSingle();

      let bilanTestId: string | null = null;
      let bilanTestAvgScore = 0;
      const bilanTestScoresByComp: Record<string, number> = {};
      let bilanTestParticipants = 0;

      if (bilanTest) {
        bilanTestId = bilanTest.id;
        const { data: bilanResults } = await supabase
          .from("bilan_test_results")
          .select("score_global, scores_par_competence")
          .eq("bilan_test_id", bilanTest.id);

        if (bilanResults && bilanResults.length > 0) {
          bilanTestParticipants = bilanResults.length;
          bilanTestAvgScore = Math.round(
            bilanResults.reduce((s: number, r: any) => s + Number(r.score_global), 0) / bilanResults.length
          );

          // Aggregate scores by competence
          const compTotals: Record<string, { total: number; count: number }> = {};
          bilanResults.forEach((r: any) => {
            const scores = r.scores_par_competence as Record<string, number>;
            if (scores && typeof scores === "object") {
              Object.entries(scores).forEach(([comp, score]) => {
                if (!compTotals[comp]) compTotals[comp] = { total: 0, count: 0 };
                compTotals[comp].total += Number(score);
                compTotals[comp].count++;
              });
            }
          });
          Object.entries(compTotals).forEach(([comp, d]) => {
            bilanTestScoresByComp[comp] = Math.round(d.total / d.count);
          });
        }
      }

      // 6. Determine weak and strong competences
      const allCompScores: Record<string, number[]> = {};
      // From homework
      homeworkLowScores.forEach((ls) => {
        if (!allCompScores[ls.competence]) allCompScores[ls.competence] = [];
        allCompScores[ls.competence].push(ls.score);
      });
      // From session
      Object.entries(sessionScoresByCompetence).forEach(([comp, d]) => {
        if (!allCompScores[comp]) allCompScores[comp] = [];
        allCompScores[comp].push(d.avg);
      });
      // From bilan
      Object.entries(bilanTestScoresByComp).forEach(([comp, score]) => {
        if (!allCompScores[comp]) allCompScores[comp] = [];
        allCompScores[comp].push(score);
      });

      const compAverages: Record<string, number> = {};
      Object.entries(allCompScores).forEach(([comp, scores]) => {
        compAverages[comp] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      });

      const weakCompetences = Object.entries(compAverages)
        .filter(([, avg]) => avg < 60)
        .sort(([, a], [, b]) => a - b)
        .map(([comp]) => comp);

      const strongCompetences = Object.entries(compAverages)
        .filter(([, avg]) => avg >= 80)
        .sort(([, a], [, b]) => b - a)
        .map(([comp]) => comp);

      return {
        prevSessionId,
        prevSessionTitre,
        homeworkTotal,
        homeworkDone,
        homeworkExpired,
        homeworkPending,
        homeworkAvgScore,
        homeworkCompletionRate,
        homeworkLowScores,
        sessionResultsCount,
        sessionAvgScore,
        sessionScoresByCompetence: Object.fromEntries(
          Object.entries(sessionScoresByCompetence).map(([k, v]) => [k, { avg: v.avg, count: v.count }])
        ),
        sessionLowScores,
        bilanTestId,
        bilanTestAvgScore,
        bilanTestScoresByComp,
        bilanTestParticipants,
        weakCompetences,
        strongCompetences,
      };
    },
    enabled: !!groupId && !!session?.date_seance,
  });

  // ─── Generate diagnostic test ───
  const handleGenerateDiagnostic = async () => {
    setGeneratingDiag(true);
    try {
      const competences = session.competences_cibles?.length
        ? session.competences_cibles
        : prevData?.weakCompetences?.length
          ? prevData.weakCompetences.slice(0, 2)
          : ["CE"];

      const { data, error } = await supabase.functions.invoke("generate-diagnostic-test", {
        body: {
          sessionId,
          groupId,
          competences,
          niveau: session.niveau_cible,
          weakPoints: prevData?.homeworkLowScores?.slice(0, 3).map((ls) => ({
            competence: ls.competence,
            exercice: ls.exercice,
            score: ls.score,
          })),
          previousSessionScores: prevData?.sessionScoresByCompetence,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Test diagnostique généré (${data.nbQuestions} questions) !`, {
        description: "Envoyé aux élèves du groupe.",
      });
    } catch (e: any) {
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGeneratingDiag(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="print:hidden">
        <CardContent className="py-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const noPrevSession = !prevData;
  const hasHomework = prevData ? prevData.homeworkTotal > 0 : false;
  const hasSessionResults = prevData ? prevData.sessionResultsCount > 0 : false;
  const hasBilanTest = prevData ? !!prevData.bilanTestId : false;
  const hasAnyData = hasHomework || hasSessionResults || hasBilanTest;

  const scoreColor = (score: number) =>
    score >= 80 ? "text-green-600 dark:text-green-400" :
    score >= 60 ? "text-orange-600 dark:text-orange-400" :
    "text-destructive";

  const scoreBg = (score: number) =>
    score >= 80 ? "bg-green-50 dark:bg-green-950/30" :
    score >= 60 ? "bg-orange-50 dark:bg-orange-950/30" :
    "bg-destructive/5";

  return (
    <Card className="border-primary/20 print:hidden">
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Bilan de début de séance
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>
          {noPrevSession || !hasAnyData
            ? "Aucune séance précédente — lancez un diagnostic pré-séance pour évaluer vos élèves"
            : `Rétrospective de « ${prevData.prevSessionTitre} » — Devoirs, résultats de séance et bilan`}
        </CardDescription>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4">
          <Tabs defaultValue={noPrevSession || !hasAnyData ? "diagnostic" : "retrospective"}>
            <TabsList className="w-full">
              {hasAnyData && (
                <TabsTrigger value="retrospective" className="flex-1 text-xs">
                  📋 Rétrospective
                </TabsTrigger>
              )}
              <TabsTrigger value="diagnostic" className="flex-1 text-xs">
                🎯 Diagnostic pré-séance
              </TabsTrigger>
            </TabsList>

            {/* ─── TAB: Rétrospective ─── */}
            {hasAnyData && (
            <TabsContent value="retrospective" className="space-y-4 mt-3">
              {/* Global synthesis */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {hasHomework && (
                  <>
                    <div className={cn("text-center p-3 rounded-lg", scoreBg(prevData.homeworkAvgScore))}>
                      <p className={cn("text-xl font-bold", scoreColor(prevData.homeworkAvgScore))}>
                        {prevData.homeworkCompletionRate}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Devoirs complétés</p>
                    </div>
                    <div className={cn("text-center p-3 rounded-lg", scoreBg(prevData.homeworkAvgScore))}>
                      <p className={cn("text-xl font-bold", scoreColor(prevData.homeworkAvgScore))}>
                        {prevData.homeworkAvgScore > 0 ? `${prevData.homeworkAvgScore}%` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Score moyen devoirs</p>
                    </div>
                  </>
                )}
                {hasSessionResults && (
                  <div className={cn("text-center p-3 rounded-lg", scoreBg(prevData.sessionAvgScore))}>
                    <p className={cn("text-xl font-bold", scoreColor(prevData.sessionAvgScore))}>
                      {prevData.sessionAvgScore}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Score séance</p>
                  </div>
                )}
                {hasBilanTest && (
                  <div className={cn("text-center p-3 rounded-lg", scoreBg(prevData.bilanTestAvgScore))}>
                    <p className={cn("text-xl font-bold", scoreColor(prevData.bilanTestAvgScore))}>
                      {prevData.bilanTestAvgScore}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Score bilan ({prevData.bilanTestParticipants} élèves)</p>
                  </div>
                )}
              </div>

              {/* Scores by competence — merged view */}
              {(hasSessionResults || hasBilanTest) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Scores par compétence
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["CO", "CE", "EE", "EO", "Structures"].map((comp) => {
                      const sessionScore = prevData.sessionScoresByCompetence[comp]?.avg;
                      const bilanScore = prevData.bilanTestScoresByComp[comp];
                      const bestScore = sessionScore != null && bilanScore != null
                        ? Math.round((sessionScore + bilanScore) / 2)
                        : sessionScore ?? bilanScore;

                      if (bestScore == null) return null;
                      return (
                        <div key={comp} className={cn("p-2.5 rounded-lg border", scoreBg(bestScore))}>
                          <div className="flex items-center justify-between">
                            <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full", COMPETENCE_COLORS[comp] || "")}>
                              {comp}
                            </span>
                            <span className={cn("text-sm font-bold", scoreColor(bestScore))}>{bestScore}%</span>
                          </div>
                          <Progress value={bestScore} className="h-1.5 mt-1.5" />
                          <div className="flex justify-between mt-1">
                            {sessionScore != null && (
                              <span className="text-[9px] text-muted-foreground">Séance: {sessionScore}%</span>
                            )}
                            {bilanScore != null && (
                              <span className="text-[9px] text-muted-foreground">Bilan: {bilanScore}%</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Weak / Strong competences */}
              <div className="flex gap-3 flex-wrap">
                {prevData.weakCompetences.length > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10 flex-1 min-w-[200px]">
                    <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-destructive uppercase">À renforcer</p>
                      <div className="flex gap-1 mt-0.5">
                        {prevData.weakCompetences.map((c) => (
                          <Badge key={c} variant="destructive" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {prevData.strongCompetences.length > 0 && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 flex-1 min-w-[200px]">
                    <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase">Points forts</p>
                      <div className="flex gap-1 mt-0.5">
                        {prevData.strongCompetences.map((c) => (
                          <Badge key={c} className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion details */}
              <Accordion type="multiple" className="w-full">
                {/* Homework details */}
                {hasHomework && (
                  <AccordionItem value="devoirs">
                    <AccordionTrigger className="text-xs font-semibold py-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        Devoirs ({prevData.homeworkDone}/{prevData.homeworkTotal} faits)
                        {prevData.homeworkExpired > 0 && (
                          <Badge variant="destructive" className="text-[9px]">{prevData.homeworkExpired} expiré(s)</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <Progress value={prevData.homeworkCompletionRate} className="h-2" />
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded bg-green-50 dark:bg-green-950/20">
                          <p className="text-lg font-bold text-green-600">{prevData.homeworkDone}</p>
                          <p className="text-[10px] text-muted-foreground">Faits</p>
                        </div>
                        <div className="p-2 rounded bg-orange-50 dark:bg-orange-950/20">
                          <p className="text-lg font-bold text-orange-600">{prevData.homeworkPending}</p>
                          <p className="text-[10px] text-muted-foreground">En attente</p>
                        </div>
                        <div className="p-2 rounded bg-destructive/5">
                          <p className="text-lg font-bold text-destructive">{prevData.homeworkExpired}</p>
                          <p className="text-[10px] text-muted-foreground">Expirés</p>
                        </div>
                      </div>
                      {prevData.homeworkLowScores.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <p className="text-[10px] font-semibold text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Scores &lt; 60%
                          </p>
                          {prevData.homeworkLowScores.slice(0, 5).map((ls, i) => (
                            <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-destructive/5 border border-destructive/10">
                              <span className="font-medium truncate">{ls.eleve}</span>
                              <span className="text-muted-foreground truncate mx-2">{ls.exercice}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge variant="outline" className="text-[9px]">{ls.competence}</Badge>
                                <Badge variant="destructive" className="text-[9px]">{ls.score}%</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Session results details */}
                {hasSessionResults && (
                  <AccordionItem value="resultats-seance">
                    <AccordionTrigger className="text-xs font-semibold py-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Résultats en séance (score moyen: {prevData.sessionAvgScore}%)
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      {prevData.sessionLowScores.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Points de blocage en séance
                          </p>
                          {prevData.sessionLowScores.slice(0, 5).map((ls, i) => (
                            <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-destructive/5 border border-destructive/10">
                              <span className="font-medium truncate">{ls.eleve}</span>
                              <span className="text-muted-foreground truncate mx-2">{ls.exercice}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge variant="outline" className="text-[9px]">{ls.competence}</Badge>
                                <Badge variant="destructive" className="text-[9px]">{ls.score}%</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {prevData.sessionLowScores.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-green-600 p-3 rounded bg-green-50 dark:bg-green-950/20">
                          <CheckCircle2 className="h-4 w-4" />
                          Tous les scores de séance sont au-dessus de 60%
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Bilan test details */}
                {hasBilanTest && (
                  <AccordionItem value="bilan-test">
                    <AccordionTrigger className="text-xs font-semibold py-2">
                      <div className="flex items-center gap-2">
                        <Target className="h-3.5 w-3.5" />
                        Bilan de séance (score moyen: {prevData.bilanTestAvgScore}%, {prevData.bilanTestParticipants} participants)
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(prevData.bilanTestScoresByComp).map(([comp, score]) => (
                          <div key={comp} className={cn("text-center p-2 rounded-lg", scoreBg(score))}>
                            <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full", COMPETENCE_COLORS[comp] || "")}>{comp}</span>
                            <p className={cn("text-lg font-bold mt-1", scoreColor(score))}>{score}%</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </TabsContent>
            )}

            {/* ─── TAB: Diagnostic pré-séance ─── */}
            <TabsContent value="diagnostic" className="space-y-4 mt-3">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Test diagnostique exhaustif (~5 min)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Génère un test QCM de 8-15 questions (format TCF IRN) basé sur les compétences ciblées
                      de cette séance{prevData?.weakCompetences && prevData.weakCompetences.length > 0 && ` et les points faibles détectés (${prevData.weakCompetences.join(", ")})`}.
                      Les résultats calibrent automatiquement le générateur d'exercices.
                    </p>
                  </div>
                </div>

                {/* Competences covered */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Compétences testées :</span>
                  {(session.competences_cibles?.length
                    ? session.competences_cibles
                    : prevData?.weakCompetences?.length
                      ? prevData.weakCompetences.slice(0, 2)
                      : ["CE"]
                  ).map((comp) => (
                    <span key={comp} className={cn("inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold", COMPETENCE_COLORS[comp] || "bg-muted text-muted-foreground")}>
                      {comp}
                    </span>
                  ))}
                </div>

                <Button
                  onClick={handleGenerateDiagnostic}
                  disabled={generatingDiag}
                  className="w-full gap-2"
                >
                  {generatingDiag ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Générer et envoyer le diagnostic
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
};

export default StartOfSessionBilan;
