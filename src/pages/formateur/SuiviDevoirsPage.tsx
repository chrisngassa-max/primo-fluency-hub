import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  User, Users, BookOpen, ClipboardCheck, BarChart2, TrendingUp,
  ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, FileText,
  Download, ArrowRight, Loader2, Bell, Calendar, Brain, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";
import CompetenceLabel from "@/components/CompetenceLabel";

const COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;

const compColor = (pct: number) =>
  pct >= 80 ? "text-green-600" : pct >= 60 ? "text-orange-600" : "text-destructive";

const compBadge = (pct: number) =>
  pct >= 80 ? "Acquis" : pct >= 60 ? "À consolider" : "À renforcer";

const SuiviDevoirsPage = () => {
  const { user } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [expandedBilan, setExpandedBilan] = useState<string | null>(null);
  const [integratingId, setIntegratingId] = useState<string | null>(null);

  // Fetch groups
  const { data: groups } = useQuery({
    queryKey: ["formateur-groups-suivi", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, nom, niveau")
        .eq("formateur_id", user!.id)
        .eq("is_active", true)
        .order("nom");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Auto-select first group
  const activeGroup = selectedGroup || groups?.[0]?.id || "";

  // Fetch individual bilans (post-devoirs)
  const { data: bilansDevoirsRaw, isLoading: bilansLoading } = useQuery({
    queryKey: ["suivi-bilans-devoirs", user?.id, activeGroup],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bilan_post_devoirs")
        .select("*, session:sessions(titre, date_seance, group_id), eleve:profiles!bilan_post_devoirs_eleve_id_fkey(prenom, nom)")
        .eq("formateur_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  // Filter by group
  const bilansDevoirs = (bilansDevoirsRaw ?? []).filter((b: any) =>
    !activeGroup || b.session?.group_id === activeGroup
  );

  // Fetch bilan test results for group view
  const { data: testResultsRaw } = useQuery({
    queryKey: ["suivi-test-results", user?.id, activeGroup],
    queryFn: async () => {
      // Get sessions for this group
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, titre, date_seance")
        .eq("group_id", activeGroup)
        .eq("statut", "terminee")
        .order("date_seance", { ascending: false })
        .limit(20);
      if (!sessions?.length) return [];

      const sessionIds = sessions.map((s) => s.id);

      // Get bilan tests for these sessions
      const { data: tests } = await supabase
        .from("bilan_tests")
        .select("id, session_id, nb_questions, competences_couvertes")
        .in("session_id", sessionIds)
        .eq("statut", "envoye");
      if (!tests?.length) return [];

      const testIds = (tests as any[]).map((t: any) => t.id);

      // Get results
      const { data: results } = await supabase
        .from("bilan_test_results")
        .select("*, eleve:profiles!bilan_test_results_eleve_id_fkey(prenom, nom)")
        .in("bilan_test_id", testIds);

      // Get group members
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, eleve:profiles!group_members_eleve_id_fkey(prenom, nom)")
        .eq("group_id", activeGroup);

      return {
        sessions,
        tests: tests as any[],
        results: (results ?? []) as any[],
        members: (members ?? []) as any[],
      };
    },
    enabled: !!activeGroup,
  });

  // Group progression data for chart
  const progressionData = (() => {
    if (!testResultsRaw || !("sessions" in (testResultsRaw as any))) return [];
    const { sessions, tests, results } = testResultsRaw as any;
    return (sessions as any[]).reverse().map((s: any) => {
      const sessionTests = tests.filter((t: any) => t.session_id === s.id);
      const testIds = sessionTests.map((t: any) => t.id);
      const sessionResults = results.filter((r: any) => testIds.includes(r.bilan_test_id));
      const avg = sessionResults.length > 0
        ? Math.round(sessionResults.reduce((sum: number, r: any) => sum + Number(r.score_global), 0) / sessionResults.length)
        : null;
      return {
        seance: s.titre?.substring(0, 15) || "Séance",
        date: format(new Date(s.date_seance), "dd/MM", { locale: fr }),
        scoreMoyen: avg,
        objectif: 80,
      };
    }).filter((d: any) => d.scoreMoyen !== null);
  })();

  // Group table data
  const groupTableData = (() => {
    if (!testResultsRaw || !("members" in (testResultsRaw as any))) return [];
    const { tests, results, members } = testResultsRaw as any;
    // Get most recent test
    const latestTest = tests?.[0];
    if (!latestTest) return [];

    return (members as any[]).map((m: any) => {
      const result = results.find((r: any) => r.bilan_test_id === latestTest.id && r.eleve_id === m.eleve_id);
      const scores = result?.scores_par_competence || {};
      return {
        eleveId: m.eleve_id,
        nom: `${m.eleve?.prenom || ""} ${m.eleve?.nom || ""}`.trim(),
        scoreGlobal: result ? Number(result.score_global) : null,
        CO: scores.CO?.pct ?? null,
        CE: scores.CE?.pct ?? null,
        EE: scores.EE?.pct ?? null,
        EO: scores.EO?.pct ?? null,
        Structures: scores.Structures?.pct ?? null,
        completed: !!result,
      };
    });
  })();

  const completedCount = groupTableData.filter((r) => r.completed).length;
  const totalMembers = groupTableData.length;
  const pendingCount = totalMembers - completedCount;

  // AI synthesis
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<string | null>(null);

  const generateSynthesis = async () => {
    setSynthesizing(true);
    try {
      const groupName = groups?.find((g) => g.id === activeGroup)?.nom || "Groupe";
      // Build trajectory data from progressionData for the edge function
      const trajectoryData = (progressionData || []).map((p: any, i: number) => ({
        seance: i + 1,
        titre: p.session || `Séance ${i + 1}`,
        date: null,
        cible: Math.round(((i + 1) / Math.max(progressionData.length, 1)) * 10),
        groupe: p.score ?? 0,
        competences: [],
        eleves: groupTableData.reduce((acc: any, el: any) => {
          acc[el.nom] = el.score ?? null;
          return acc;
        }, {}),
      }));
      const { data, error } = await supabase.functions.invoke("analyze-trajectory", {
        body: {
          groupNom: groupName,
          trajectoryData,
          totalSeances: progressionData.length || 10,
        },
      });
      if (error) throw error;
      setSynthesis(data?.analysis || data?.message || "Analyse indisponible.");
      toast.success("Synthèse IA générée");
    } catch (e: any) {
      toast.error("Erreur de synthèse", { description: e.message });
    } finally {
      setSynthesizing(false);
    }
  };

  // Integrate bilan to next session
  const integrateBilan = async (bilanId: string, sessionId: string | null) => {
    if (!sessionId) {
      toast.error("Aucune séance associée");
      return;
    }
    setIntegratingId(bilanId);
    try {
      const bilan = bilansDevoirs.find((b) => b.id === bilanId);
      const analyse = bilan?.analyse_data as any;
      const bilanFormateur = analyse?.bilan_formateur;
      const notes = bilanFormateur
        ? `[Bilan post-devoirs] ${bilanFormateur.points_a_developper?.join("; ") || ""}\n${bilanFormateur.conseils_remediation?.join("; ") || ""}`
        : "[Bilan intégré]";

      // Find next session after this one
      const { data: nextSess } = await supabase
        .from("sessions")
        .select("id, objectifs")
        .eq("group_id", activeGroup)
        .gt("date_seance", bilan?.session?.date_seance || new Date().toISOString())
        .order("date_seance")
        .limit(1)
        .maybeSingle();

      if (nextSess) {
        const currentObj = nextSess.objectifs || "";
        await supabase.from("sessions").update({
          objectifs: currentObj ? `${currentObj}\n\n${notes}` : notes,
          updated_at: new Date().toISOString(),
        }).eq("id", nextSess.id);
      }

      await supabase.from("bilan_post_devoirs").update({
        is_integrated: true,
      }).eq("id", bilanId);

      toast.success("Bilan intégré à la séance N+1");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setIntegratingId(null);
    }
  };

  const handlePrintBilan = (bilan: any) => {
    const analyse = bilan.analyse_data as any;
    const bf = analyse?.bilan_formateur;
    if (!bf) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Bilan post-devoirs</title>
      <style>body{font-family:system-ui;padding:2rem;max-width:800px;margin:auto}
      h1{font-size:1.5rem}h2{font-size:1.1rem;margin-top:1.5rem}
      .score{display:flex;gap:2rem;margin:.5rem 0}
      .badge{padding:2px 8px;border-radius:4px;font-size:.8rem}
      .green{background:#dcfce7;color:#166534}.orange{background:#ffedd5;color:#9a3412}
      .red{background:#fee2e2;color:#991b1b}
      ul{margin:.5rem 0;padding-left:1.5rem}li{margin:.3rem 0}</style></head><body>`);
    w.document.write(`<h1>Bilan post-devoirs — ${bilan.eleve?.prenom} ${bilan.eleve?.nom}</h1>`);
    w.document.write(`<p>Séance : ${bilan.session?.titre || "—"} · ${bilan.session?.date_seance ? format(new Date(bilan.session.date_seance), "d MMMM yyyy", { locale: fr }) : ""}</p>`);
    if (bf.scores_par_competence) {
      w.document.write(`<h2>Scores par compétence</h2><div class="score">`);
      for (const [comp, info] of Object.entries(bf.scores_par_competence as Record<string, any>)) {
        const cls = (info.pct || 0) >= 80 ? "green" : (info.pct || 0) >= 60 ? "orange" : "red";
        w.document.write(`<span>${comp}: <span class="badge ${cls}">${info.correct || "?"}/${info.total || "?"}</span></span>`);
      }
      w.document.write(`</div>`);
    }
    if (bf.erreurs_observees?.length) {
      w.document.write(`<h2>Erreurs observées</h2><ul>`);
      bf.erreurs_observees.forEach((e: string) => w.document.write(`<li>${e}</li>`));
      w.document.write(`</ul>`);
    }
    if (bf.points_a_developper?.length) {
      w.document.write(`<h2>Points à développer en séance</h2><ul>`);
      bf.points_a_developper.forEach((p: string) => w.document.write(`<li>${p}</li>`));
      w.document.write(`</ul>`);
    }
    if (bf.conseils_remediation?.length) {
      w.document.write(`<h2>Conseils de remédiation IA</h2><ul>`);
      bf.conseils_remediation.forEach((c: string) => w.document.write(`<li>${c}</li>`));
      w.document.write(`</ul>`);
    }
    w.document.write(`</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />Suivi des devoirs
          </h1>
          <p className="text-sm text-muted-foreground">Bilans individuels et collectifs après les devoirs et tests de séance</p>
        </div>
        <Select value={activeGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Sélectionner un groupe" />
          </SelectTrigger>
          <SelectContent>
            {(groups ?? []).map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.nom} ({g.niveau})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="individuel">
        <TabsList>
          <TabsTrigger value="individuel" className="gap-1.5">
            <User className="h-4 w-4" />Vue individuelle
          </TabsTrigger>
          <TabsTrigger value="groupe" className="gap-1.5">
            <Users className="h-4 w-4" />Vue groupe
          </TabsTrigger>
        </TabsList>

        {/* ─── VUE INDIVIDUELLE ─── */}
        <TabsContent value="individuel" className="space-y-4 mt-4">
          {bilansLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : bilansDevoirs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Aucun bilan post-devoirs</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Les bilans apparaîtront ici quand les élèves auront soumis leurs devoirs.
                </p>
              </CardContent>
            </Card>
          ) : (
            bilansDevoirs.map((bilan: any) => {
              const analyse = bilan.analyse_data as any;
              const bf = analyse?.bilan_formateur;
              const isExpanded = expandedBilan === bilan.id;
              const eleveNom = `${bilan.eleve?.prenom || ""} ${bilan.eleve?.nom || ""}`.trim();
              const sessionTitle = bilan.session?.titre || "Séance";
              const sessionDate = bilan.session?.date_seance
                ? format(new Date(bilan.session.date_seance), "d MMMM yyyy", { locale: fr })
                : "";

              return (
                <Collapsible key={bilan.id} open={isExpanded} onOpenChange={() => setExpandedBilan(isExpanded ? null : bilan.id)}>
                  <Card className={cn("transition-all", !bilan.is_read && "border-primary/30")}>
                    <CollapsibleTrigger className="w-full text-left">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Bilan post-devoirs — {eleveNom}
                            {!bilan.is_read && <Badge variant="default" className="text-[10px]">Nouveau</Badge>}
                          </CardTitle>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                        <CardDescription>
                          {sessionTitle} · {sessionDate}
                          {bilan.is_integrated && <Badge variant="secondary" className="ml-2 text-[10px]">Intégré</Badge>}
                        </CardDescription>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="space-y-4 pt-0">
                        {bf ? (
                          <>
                            {/* Scores par compétence */}
                            {bf.scores_par_competence && (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scores par compétence</p>
                                {Object.entries(bf.scores_par_competence as Record<string, any>).map(([comp, info]: [string, any]) => (
                                  <div key={comp} className="flex items-center gap-3">
                                    <Badge variant="outline" className="w-24 justify-center">{comp}</Badge>
                                    <div className="flex-1">
                                      <Progress value={info.pct || 0} className={cn("h-2.5",
                                        (info.pct || 0) >= 80 ? "[&>div]:bg-green-500" : (info.pct || 0) >= 60 ? "[&>div]:bg-orange-500" : "[&>div]:bg-destructive"
                                      )} />
                                    </div>
                                    <span className={cn("text-sm font-bold w-28 text-right", compColor(info.pct || 0))}>
                                      {info.correct ?? "?"}/{info.total ?? "?"} [{compBadge(info.pct || 0)}]
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Erreurs observées */}
                            {bf.erreurs_observees?.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Erreurs observées</p>
                                {bf.erreurs_observees.map((e: string, i: number) => (
                                  <p key={i} className="text-sm text-muted-foreground">· {e}</p>
                                ))}
                              </div>
                            )}

                            {/* Points à développer */}
                            {bf.points_a_developper?.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Points à développer en séance</p>
                                <ol className="list-decimal list-inside space-y-1">
                                  {bf.points_a_developper.map((p: string, i: number) => (
                                    <li key={i} className="text-sm">{p}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Conseils de remédiation */}
                            {bf.conseils_remediation?.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Conseils de remédiation IA</p>
                                {bf.conseils_remediation.map((c: string, i: number) => (
                                  <p key={i} className="text-sm text-muted-foreground">· {c}</p>
                                ))}
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                onClick={() => integrateBilan(bilan.id, bilan.session_id)}
                                disabled={bilan.is_integrated || integratingId === bilan.id}
                                className="gap-1.5"
                              >
                                {integratingId === bilan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                                {bilan.is_integrated ? "Déjà intégré" : "Intégrer à la séance N+1"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handlePrintBilan(bilan)} className="gap-1.5">
                                <Download className="h-3 w-3" />Télécharger PDF
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Données de bilan non disponibles.</p>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })
          )}
        </TabsContent>

        {/* ─── VUE GROUPE ─── */}
        <TabsContent value="groupe" className="space-y-6 mt-4">
          {!activeGroup ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                Sélectionnez un groupe pour voir le bilan collectif.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Section 1: Résultats du test du jour */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Résultats du dernier test de séance
                  </CardTitle>
                  {pendingCount > 0 && (
                    <CardDescription className="flex items-center gap-1 text-orange-600">
                      <AlertTriangle className="h-3 w-3" />
                      {pendingCount} élève(s) n'ont pas encore passé le test
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {groupTableData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Aucun test de séance disponible pour ce groupe.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Élève</TableHead>
                            {COMPETENCES.map((c) => (
                              <TableHead key={c} className="text-center w-20">{c}</TableHead>
                            ))}
                            <TableHead className="text-center w-24">Score global</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupTableData.map((row) => (
                            <TableRow key={row.eleveId}>
                              <TableCell className="font-medium">
                                {row.nom}
                                {!row.completed && <Badge variant="outline" className="ml-2 text-[10px]">En attente</Badge>}
                              </TableCell>
                              {COMPETENCES.map((c) => {
                                const val = row[c] as number | null;
                                return (
                                  <TableCell key={c} className="text-center">
                                    {val !== null ? (
                                      <span className={cn("font-bold text-sm", compColor(val))}>{val}%</span>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center">
                                {row.scoreGlobal !== null ? (
                                  <Badge className={cn(
                                    row.scoreGlobal >= 80 ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                    row.scoreGlobal >= 60 ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                                    "bg-red-100 text-red-700 hover:bg-red-100"
                                  )}>
                                    {row.scoreGlobal}%
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section 2: Courbe de progression */}
              {progressionData.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Courbe de progression du groupe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressionData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis domain={[0, 100]} className="text-xs" />
                          <RechartsTooltip
                            contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="scoreMoyen"
                            name="Score moyen"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="objectif"
                            name="Objectif"
                            stroke="hsl(var(--muted-foreground))"
                            strokeDasharray="5 5"
                            strokeWidth={1}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Trend indicator */}
                    {progressionData.length >= 2 && (() => {
                      const last = progressionData[progressionData.length - 1].scoreMoyen;
                      const prev = progressionData[progressionData.length - 2].scoreMoyen;
                      const diff = (last || 0) - (prev || 0);
                      return (
                        <div className="flex items-center gap-2 mt-3 text-sm">
                          <TrendingUp className={cn("h-4 w-4", diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground")} />
                          <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"}>
                            {diff > 0 ? `En progression (+${diff}%)` : diff < 0 ? `En recul (${diff}%)` : "Stable"}
                          </span>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Section 3: Synthèse IA */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-primary" />
                    Synthèse IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {synthesis ? (
                    <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">{synthesis}</div>
                  ) : (
                    <div className="text-center py-4">
                      <Button onClick={generateSynthesis} disabled={synthesizing || groupTableData.length === 0} className="gap-2">
                        {synthesizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
                        Générer la synthèse IA
                      </Button>
                      {groupTableData.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">Aucune donnée de test disponible.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alertes automatiques */}
              {groupTableData.filter((r) => {
                if (!r.completed) return false;
                const lowCount = COMPETENCES.filter((c) => (r[c] as number | null) !== null && (r[c] as number) < 50).length;
                return lowCount >= 2;
              }).length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Élèves en difficulté
                    </CardTitle>
                    <CardDescription>Score &lt; 50% sur 2 compétences ou plus</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {groupTableData
                      .filter((r) => {
                        if (!r.completed) return false;
                        return COMPETENCES.filter((c) => (r[c] as number | null) !== null && (r[c] as number) < 50).length >= 2;
                      })
                      .map((r) => {
                        const lowComps = COMPETENCES.filter((c) => (r[c] as number | null) !== null && (r[c] as number) < 50);
                        return (
                          <div key={r.eleveId} className="flex items-center gap-2 text-sm">
                            <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                            <span className="font-medium">{r.nom}</span>
                            <span className="text-muted-foreground">—</span>
                            {lowComps.map((c) => (
                              <Badge key={c} variant="destructive" className="text-[10px]">{c}: {r[c]}%</Badge>
                            ))}
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuiviDevoirsPage;
