import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import { Sparkles, Volume2, ChevronLeft, ChevronRight, CheckCircle2, Users, Clock, AlertTriangle, Save, BarChart3, ChevronDown, TrendingUp, Minus as TrendingFlat } from "lucide-react";
// TCF questions now loaded from database (tcf_questions table)
const SECTIONS_META: Record<string, { title: string; icon: string; color: string; description: string }> = {
  CO: { title: "Compréhension Orale", icon: "🎧", color: "bg-primary", description: "Écoutez l'audio puis choisissez la bonne image ou réponse." },
  Structures: { title: "Structures de la langue", icon: "📝", color: "bg-accent", description: "Complétez la phrase avec le mot correct." },
  CE: { title: "Compréhension Écrite", icon: "📖", color: "bg-success", description: "Lisez le document puis répondez à la question." },
};
const EXAM_DURATION_SECONDS = 90 * 60;

/* ───────── Sub-items definition ───────── */
const DIAGNOSTIC_SOUS_ITEMS: Record<string, string[]> = {
  CO: [
    "Nombres et chiffres",
    "Consignes simples",
    "Salutations et présentations",
    "Indications de lieu",
    "Horaires et rendez-vous",
    "Conversations téléphoniques simples",
  ],
  CE: [
    "Alphabet et épellation",
    "Panneaux et signalétique",
    "Étiquettes de prix",
    "Formulaires administratifs",
    "Messages courts (SMS, email)",
    "Documents officiels simples",
  ],
  EO: [
    "Se présenter",
    "Demander un renseignement",
    "Exprimer un besoin",
    "Décrire une situation",
    "Interaction au guichet",
  ],
  EE: [
    "Écrire son identité",
    "Remplir un formulaire",
    "Rédiger un message court",
    "Décrire son logement",
    "Écrire une demande simple",
  ],
  Structures: [
    "Articles définis / indéfinis",
    "Pluriel des noms",
    "Conjugaison présent (être/avoir)",
    "Négation simple",
    "Prépositions de lieu",
    "Pronoms personnels sujets",
  ],
};

const COMPETENCES = ["CO", "CE", "EO", "EE", "Structures"] as const;
const COMP_LABELS: Record<string, string> = {
  CO: "Compréhension Orale",
  CE: "Compréhension Écrite",
  EO: "Expression Orale",
  EE: "Expression Écrite",
  Structures: "Structures",
};
const COMP_COLORS: Record<string, string> = {
  CO: "hsl(var(--primary))",
  CE: "hsl(210, 70%, 50%)",
  EO: "hsl(150, 60%, 45%)",
  EE: "hsl(30, 80%, 50%)",
  Structures: "hsl(280, 60%, 55%)",
};

type SubItemScores = Record<string, Record<string, number>>;

function getScoreColor(score: number) {
  if (score <= 30) return "bg-red-500";
  if (score <= 70) return "bg-amber-500";
  return "bg-emerald-500";
}
function getScoreTextColor(score: number) {
  if (score <= 30) return "text-red-600 dark:text-red-400";
  if (score <= 70) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}
function getScoreBgColor(score: number) {
  if (score <= 30) return "bg-red-100 dark:bg-red-900/30";
  if (score <= 70) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-emerald-100 dark:bg-emerald-900/30";
}

function scoreToDifficulty(score: number): number {
  return Math.round(score / 10);
}

/* ───────── TTS helper ───────── */
function speak(text: string) {
  if (!("speechSynthesis" in window)) {
    toast.error("Votre navigateur ne supporte pas la synthèse vocale.");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find((v) => v.lang.startsWith("fr"));
  if (fr) u.voice = fr;
  window.speechSynthesis.speak(u);
}

/* ───────── Timer helper ───────── */
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════
   DIAGNOSTIC PAR SOUS-ITEMS (Action 1-4)
   ═══════════════════════════════════════════════════════════════ */
function DiagnosticSousItems() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEleve, setSelectedEleve] = useState<string>("");
  const [scores, setScores] = useState<SubItemScores>(() => {
    const init: SubItemScores = {};
    for (const comp of COMPETENCES) {
      init[comp] = {};
      for (const item of DIAGNOSTIC_SOUS_ITEMS[comp]) {
        init[comp][item] = 0;
      }
    }
    return init;
  });
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [showObjectif, setShowObjectif] = useState(false);
  // Load students
  const { data: eleves, isLoading: loadingEleves } = useQuery({
    queryKey: ["formateur-eleves", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase.from("groups").select("id").eq("formateur_id", user!.id);
      if (!groups?.length) return [];
      const { data: members } = await supabase
        .from("group_members")
        .select("eleve_id, profiles:eleve_id(id, prenom, nom)")
        .in("group_id", groups.map((g) => g.id));
      if (!members) return [];
      const unique = new Map<string, { id: string; prenom: string; nom: string }>();
      members.forEach((m: any) => {
        if (m.profiles && !unique.has(m.profiles.id)) unique.set(m.profiles.id, m.profiles);
      });
      return Array.from(unique.values());
    },
    enabled: !!user,
  });

  // Load existing diagnostic for selected student
  const { data: existingDiag } = useQuery({
    queryKey: ["diagnostic-entree", selectedEleve],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostic_entree" as any)
        .select("*")
        .eq("eleve_id", selectedEleve);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedEleve,
  });

  // Populate scores from existing data
  useEffect(() => {
    if (!existingDiag) return;
    const newScores: SubItemScores = {};
    for (const comp of COMPETENCES) {
      newScores[comp] = {};
      for (const item of DIAGNOSTIC_SOUS_ITEMS[comp]) {
        const found = existingDiag.find((d: any) => d.competence === comp && d.sous_item === item);
        newScores[comp][item] = found ? Number(found.score) : 0;
      }
    }
    setScores(newScores);
    setAnalysis(null);
  }, [existingDiag]);

  // Compute averages
  const compAverages = useMemo(() => {
    const avgs: Record<string, number> = {};
    for (const comp of COMPETENCES) {
      const items = DIAGNOSTIC_SOUS_ITEMS[comp];
      const sum = items.reduce((s, item) => s + (scores[comp]?.[item] ?? 0), 0);
      avgs[comp] = Math.round(sum / items.length);
    }
    return avgs;
  }, [scores]);

  const globalAvg = useMemo(() => {
    const vals = Object.values(compAverages);
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [compAverages]);

  const radarData = useMemo(
    () => COMPETENCES.map((c) => ({ competence: c, score: compAverages[c], fullMark: 100 })),
    [compAverages],
  );

  // Query sessions count for "expected at session T" calculation
  const { data: sessionsData } = useQuery({
    queryKey: ["formateur-sessions-count", user?.id],
    queryFn: async () => {
      const { data: groups } = await supabase.from("groups").select("id").eq("formateur_id", user!.id);
      if (!groups?.length) return { total: 10, completed: 0 };
      const { count: total } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .in("group_id", groups.map((g) => g.id));
      const { count: completed } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .in("group_id", groups.map((g) => g.id))
        .in("statut", ["terminee"]);
      return { total: Math.max(total || 10, 1), completed: completed || 0 };
    },
    enabled: !!user,
  });

  const expectedAtT = useMemo(() => {
    const t = sessionsData?.total || 10;
    const c = sessionsData?.completed || 0;
    const ratio = Math.min(c / t, 1);
    return Math.round(ratio * 100);
  }, [sessionsData]);

  const multiRadarData = useMemo(
    () => COMPETENCES.map((comp) => ({
      competence: comp,
      actuel: compAverages[comp],
      attendu: expectedAtT,
      objectif: 100,
      fullMark: 100,
    })),
    [compAverages, expectedAtT],
  );

  // Trend indicator: compare current avg to initial diagnostic score
  const compTrends = useMemo(() => {
    const trends: Record<string, "up" | "flat" | "down"> = {};
    for (const comp of COMPETENCES) {
      const avg = compAverages[comp];
      // If no existing diagnostic, treat as flat; otherwise compare
      const initial = existingDiag?.filter((d: any) => d.competence === comp);
      if (!initial?.length) { trends[comp] = "flat"; continue; }
      const initAvg = Math.round(initial.reduce((s: number, d: any) => s + Number(d.score), 0) / initial.length);
      if (avg > initAvg + 5) trends[comp] = "up";
      else if (avg < initAvg - 5) trends[comp] = "down";
      else trends[comp] = "flat";
    }
    return trends;
  }, [compAverages, existingDiag]);

  const niveauEstime = globalAvg >= 80 ? "B1" : globalAvg >= 60 ? "A2" : globalAvg >= 30 ? "A1" : "A0";

  // Save scores
  const handleSave = async () => {
    if (!selectedEleve || !user) return;
    setSaving(true);
    try {
      const rows: any[] = [];
      for (const comp of COMPETENCES) {
        for (const item of DIAGNOSTIC_SOUS_ITEMS[comp]) {
          rows.push({
            eleve_id: selectedEleve,
            competence: comp,
            sous_item: item,
            score: scores[comp][item],
            formateur_id: user.id,
            updated_at: new Date().toISOString(),
          });
        }
      }
      // Upsert all rows
      const { error } = await supabase.from("diagnostic_entree" as any).upsert(rows, {
        onConflict: "eleve_id,competence,sous_item",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["diagnostic-entree", selectedEleve] });
      toast.success("Diagnostic sauvegardé avec succès");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // AI Analysis
  const handleAnalyze = async () => {
    if (!selectedEleve) {
      toast.error("Sélectionnez un élève d'abord");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const eleveObj = eleves?.find((e) => e.id === selectedEleve);
      const detailScores: Record<string, any> = {};
      for (const comp of COMPETENCES) {
        detailScores[comp] = {
          moyenne: compAverages[comp],
          niveau_difficulte: scoreToDifficulty(compAverages[comp]),
          sous_items: Object.entries(scores[comp]).map(([item, score]) => ({
            item,
            score,
            niveau_difficulte: scoreToDifficulty(score),
          })),
        };
      }
      const { data, error } = await supabase.functions.invoke("analyze-test-entree", {
        body: {
          scores: {
            CO: compAverages.CO,
            CE: compAverages.CE,
            EO: compAverages.EO,
            EE: compAverages.EE,
          },
          eleveNom: eleveObj ? `${eleveObj.prenom} ${eleveObj.nom}` : null,
          detailScores,
          globalAvg,
          niveauEstime,
        },
      });
      if (error) throw error;
      setAnalysis(data.analysis);
      toast.success("Diagnostic IA généré avec succès");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header: student selector + summary badges */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-[200px] max-w-xs">
              {loadingEleves ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedEleve} onValueChange={setSelectedEleve}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un élève" />
                  </SelectTrigger>
                  <SelectContent>
                    {eleves?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.prenom} {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Badge variant="outline" className="text-base px-3 py-1">
              Niveau estimé : <span className="font-bold ml-1">{niveauEstime}</span>
            </Badge>
            <Badge variant="secondary" className="text-base px-3 py-1">
              Moyenne : <span className={`font-bold ml-1 ${getScoreTextColor(globalAvg)}`}>{globalAvg}/100</span>
            </Badge>
            <Badge variant="secondary" className="text-base px-3 py-1">
              Difficulté suggérée : <span className="font-bold ml-1">{scoreToDifficulty(globalAvg)}/10</span>
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Radar de Trajectoire Multicouche */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Radar de Trajectoire
                </h3>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={showExpected} onCheckedChange={setShowExpected} />
                    <span className="text-muted-foreground">Attendu (Séance T)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={showObjectif} onCheckedChange={setShowObjectif} />
                    <span className="text-muted-foreground">Objectif TCF A1</span>
                  </label>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={multiRadarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="competence" tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 11 }} />
                  {showObjectif && (
                    <Radar name="Objectif TCF A1" dataKey="objectif" stroke="hsl(0, 70%, 55%)" fill="none" strokeWidth={2} strokeDasharray="0" />
                  )}
                  {showExpected && (
                    <Radar name="Attendu (T)" dataKey="attendu" stroke="hsl(30, 80%, 50%)" fill="none" strokeWidth={2} strokeDasharray="6 3" />
                  )}
                  <Radar name="Niveau actuel" dataKey="actuel" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm bg-primary inline-block opacity-60" /> Niveau actuel</span>
                {showExpected && <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed inline-block" style={{ borderColor: "hsl(30,80%,50%)" }} /> Attendu (T)</span>}
                {showObjectif && <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 inline-block" style={{ borderColor: "hsl(0,70%,55%)" }} /> Objectif 100%</span>}
              </div>
            </div>

            {/* Compact summary sidebar */}
            <div className="flex flex-col justify-center space-y-3 min-w-[220px]">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Synthèse</h3>
              {COMPETENCES.map((comp) => {
                const avg = compAverages[comp];
                return (
                  <div key={comp} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{comp}</span>
                      <span className={`text-sm font-bold tabular-nums ${getScoreTextColor(avg)}`}>{avg}/100</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getScoreColor(avg)}`} style={{ width: `${avg}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accordion détail par compétence — fermés par défaut */}
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" className="w-full">
            {COMPETENCES.map((comp) => {
              const avg = compAverages[comp];
              const trend = compTrends[comp];
              return (
                <AccordionItem key={comp} value={comp}>
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center justify-between w-full mr-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${getScoreColor(avg)}`} />
                        <span className="font-semibold text-sm">{COMP_LABELS[comp]}</span>
                        {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                        {trend === "flat" && <TrendingFlat className="h-4 w-4 text-muted-foreground" />}
                        {trend === "down" && <TrendingUp className="h-4 w-4 text-destructive rotate-180" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold tabular-nums ${getScoreTextColor(avg)}`}>{avg}/100</span>
                        <Badge variant="outline" className="text-xs">Niv. {scoreToDifficulty(avg)}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2 pb-2">
                      {DIAGNOSTIC_SOUS_ITEMS[comp].map((item) => {
                        const val = scores[comp]?.[item] ?? 0;
                        return (
                          <div key={item} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium truncate mr-2">{item}</label>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-bold tabular-nums ${getScoreTextColor(val)}`}>{val}</span>
                                <span className="text-xs text-muted-foreground">→ Niv.{scoreToDifficulty(val)}</span>
                              </div>
                            </div>
                            <Slider
                              value={[val]}
                              onValueChange={([v]) =>
                                setScores((prev) => ({ ...prev, [comp]: { ...prev[comp], [item]: v } }))
                              }
                              max={100}
                              step={1}
                              className="w-full"
                            />
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${getScoreColor(val)}`} style={{ width: `${val}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving || !selectedEleve} variant="outline" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde…" : "Sauvegarder le diagnostic"}
        </Button>
        <Button onClick={handleAnalyze} disabled={analyzing || !selectedEleve} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {analyzing ? "Analyse en cours…" : "Générer Diagnostic de Départ"}
        </Button>
      </div>

      {/* AI Analysis result */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Diagnostic IA de Départ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none bg-muted/50 rounded-lg p-6 border">
              {analysis.split("\n").map((line, i) => {
                if (line.startsWith("###")) return <h4 key={i} className="text-base font-semibold mt-4 mb-1">{line.replace(/^###\s*/, "")}</h4>;
                if (line.startsWith("##")) return <h3 key={i} className="text-lg font-bold mt-4 mb-1">{line.replace(/^##\s*/, "")}</h3>;
                if (line.startsWith("#")) return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace(/^#\s*/, "")}</h2>;
                if (line.startsWith("- ")) return <li key={i} className="ml-4 text-sm">{line.slice(2)}</li>;
                if (line.trim() === "") return <br key={i} />;
                return <p key={i} className="text-sm leading-relaxed">{line}</p>;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PASSATION TEST (loads questions from database)
   ═══════════════════════════════════════════════════════════════ */
type TCFQuestionRow = { id: string; competence: string; enonce: string; choix: { label: string; emoji?: string }[]; bonne_reponse: string; audio?: string | null; visual?: string | null };
type MappedQ = { section: string; question: string; options: { label: string; emoji?: string }[]; correct: number; audio?: string; visual?: string };

function mapDbQuestions(rows: TCFQuestionRow[]): MappedQ[] {
  const order = ["CO", "Structures", "CE"];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.competence) - order.indexOf(b.competence));
  return sorted.map((r) => {
    const choix = (r.choix ?? []) as { label: string; emoji?: string }[];
    const correctIdx = choix.findIndex((c) => c.label === r.bonne_reponse);
    return { section: r.competence, question: r.enonce, options: choix, correct: correctIdx >= 0 ? correctIdx : 0, audio: r.audio ?? undefined, visual: r.visual ?? undefined };
  });
}

function PassationTest() {
  const { data: dbRows, isLoading: loadingQ } = useQuery({
    queryKey: ["tcf-questions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tcf_questions").select("*");
      if (error) throw error;
      return data as unknown as TCFQuestionRow[];
    },
  });

  const questions = useMemo(() => (dbRows ? mapDbQuestions(dbRows) : []), [dbRows]);
  const totalCount = questions.length;

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sectionIntro, setSectionIntro] = useState(true);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset answers when questions load
  useEffect(() => { if (totalCount > 0 && answers.length !== totalCount) setAnswers(Array(totalCount).fill(null)); }, [totalCount]);

  useEffect(() => {
    if (started && !submitted) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [started, submitted]);

  const doSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitted(true);
    const score = answers.reduce<number>((acc, a, i) => acc + (a === questions[i]?.correct ? 1 : 0), 0);
    if (timeLeft === 0) toast.error("Temps écoulé ! Le test est terminé automatiquement.");
    else toast.success(`Test terminé ! Score : ${score}/${totalCount}`);
  }, [answers, timeLeft, questions, totalCount]);

  useEffect(() => {
    if (timeLeft === 0 && started && !submitted) doSubmit();
  }, [timeLeft, started, submitted, doSubmit]);

  const handleAnswer = (idx: number) => {
    if (submitted) return;
    setAnswers((prev) => { const copy = [...prev]; copy[current] = idx; return copy; });
  };

  const handleNext = () => {
    if (current < totalCount - 1) {
      const nextQ = questions[current + 1];
      const currentQ = questions[current];
      if (nextQ.section !== currentQ.section) setSectionIntro(true);
      setCurrent((c) => c + 1);
    }
  };

  const isUrgent = timeLeft <= 600;
  const totalScore = submitted ? answers.reduce<number>((acc, a, i) => acc + (a === questions[i]?.correct ? 1 : 0), 0) : null;
  const scoreCO = submitted ? questions.reduce((acc, qq, i) => acc + (qq.section === "CO" && answers[i] === qq.correct ? 1 : 0), 0) : 0;
  const scoreStr = submitted ? questions.reduce((acc, qq, i) => acc + (qq.section === "Structures" && answers[i] === qq.correct ? 1 : 0), 0) : 0;
  const scoreCE = submitted ? questions.reduce((acc, qq, i) => acc + (qq.section === "CE" && answers[i] === qq.correct ? 1 : 0), 0) : 0;

  if (loadingQ || totalCount === 0) return <Skeleton className="h-64 w-full rounded-xl" />;

  const q = questions[current];
  const prevSection = current > 0 ? questions[current - 1].section : null;
  const isNewSection = q.section !== prevSection;
  const meta = SECTIONS_META[q.section];
  const sectionQuestions = questions.filter((qq) => qq.section === q.section);
  const sectionStart = questions.findIndex((qq) => qq.section === q.section);
  const sectionTotal = sectionQuestions.length;
  const sectionIndex = current - sectionStart + 1;

  if (!started) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-primary p-8 text-center text-primary-foreground">
          <h2 className="text-2xl font-bold">TCF IRN — Simulateur officiel</h2>
          <p className="mt-2 text-primary-foreground/80">Test de Connaissance du Français</p>
        </div>
        <CardContent className="pt-8 space-y-6 text-center">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">30</p>
              <p className="text-sm text-muted-foreground mt-1">🎧 Compréhension Orale</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">10</p>
              <p className="text-sm text-muted-foreground mt-1">📝 Structures</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">40</p>
              <p className="text-sm text-muted-foreground mt-1">📖 Compréhension Écrite</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Durée : 1h30 (90 minutes)</span>
          </div>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Le chronomètre démarre dès que vous cliquez sur « Commencer ». Le test se termine automatiquement à la fin du temps imparti.
          </p>
          <Button size="lg" onClick={() => setStarted(true)} className="text-lg px-10">
            Commencer le test
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (sectionIntro && isNewSection && !submitted) {
    return (
      <div className="space-y-4">
        <TimerBar timeLeft={timeLeft} isUrgent={isUrgent} />
        <Card className="overflow-hidden">
          <div className={`${meta.color} p-6 text-center`}>
            <span className="text-5xl">{meta.icon}</span>
          </div>
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-bold">{meta.title}</h2>
            <p className="text-muted-foreground text-base">{meta.description}</p>
            <p className="text-sm text-muted-foreground">{sectionTotal} questions dans cette partie</p>
            <Button onClick={() => setSectionIntro(false)} size="lg" className="mt-4">
              Commencer <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimerBar timeLeft={timeLeft} isUrgent={isUrgent} />

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{meta.icon}</span>
              <span className="font-semibold text-sm">{meta.title}</span>
              <span className="text-sm text-muted-foreground">—</span>
              <span className="font-bold text-sm">Question {sectionIndex} / {sectionTotal}</span>
            </div>
            <Badge variant="secondary" className="text-xs">{current + 1}/{TCF_QUESTIONS.length} total</Badge>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: sectionTotal }).map((_, i) => {
              const globalIdx = sectionStart + i;
              return (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                  globalIdx === current ? "bg-primary"
                    : answers[globalIdx] !== null
                      ? submitted
                        ? answers[globalIdx] === TCF_QUESTIONS[globalIdx].correct ? "bg-emerald-500" : "bg-destructive"
                        : "bg-primary/40"
                      : "bg-muted"
                }`} />
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {q.section === "CO" && q.audio && (
            <div className="flex flex-col items-center gap-3 mb-6 p-6 bg-muted/50 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground font-medium">🎧 Cliquez pour écouter</p>
              <Button variant="outline" size="lg" onClick={() => speak(q.audio!)} className="gap-2 text-base px-8">
                <Volume2 className="h-5 w-5 text-primary" /> Écouter l'audio
              </Button>
              <p className="text-base font-medium mt-2">{q.question}</p>
            </div>
          )}

          {q.section === "CE" && q.visual && (
            <div className="mb-6 p-5 bg-card border-2 border-dashed border-muted-foreground/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Document</p>
              <div className="text-lg font-medium whitespace-pre-line leading-relaxed">{q.visual}</div>
              <div className="flex items-center gap-2 mt-4">
                <p className="text-base font-medium flex-1">{q.question}</p>
                <Button variant="ghost" size="icon" onClick={() => speak(`${q.visual}. ${q.question}`)} title="Écouter">
                  <Volume2 className="h-5 w-5 text-primary" />
                </Button>
              </div>
            </div>
          )}

          {q.section === "Structures" && (
            <div className="mb-6">
              <div className="flex items-start gap-3">
                <p className="text-lg font-medium leading-relaxed flex-1">
                  {q.question.split("___").map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="inline-block mx-1 px-4 py-0.5 border-b-2 border-primary bg-primary/5 rounded text-primary font-bold min-w-[60px] text-center">
                          {answers[current] !== null ? q.options[answers[current]!].label : "___"}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
                <Button variant="ghost" size="icon" onClick={() => speak(q.question.replace("___", "blanc"))} title="Écouter">
                  <Volume2 className="h-5 w-5 text-primary" />
                </Button>
              </div>
            </div>
          )}

          <div className={`${q.section === "CO" ? "grid grid-cols-2 gap-3" : "space-y-3"}`}>
            {q.options.map((opt, idx) => {
              const selected = answers[current] === idx;
              const isCorrect = submitted && idx === q.correct;
              const isWrong = submitted && selected && idx !== q.correct;
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={submitted}
                  className={`w-full flex items-center gap-3 rounded-lg border text-left transition-all ${
                    q.section === "CO" ? "p-5 flex-col text-center justify-center" : "p-4"
                  } ${
                    isCorrect ? "border-emerald-500 bg-emerald-500/10"
                    : isWrong ? "border-destructive bg-destructive/10"
                    : selected ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  {q.section === "CO" && opt.emoji && <span className="text-3xl">{opt.emoji}</span>}
                  <span className={`font-medium text-[15px] ${q.section === "CO" ? "text-center" : ""}`}>{opt.label}</span>
                  {q.section !== "CO" && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); speak(opt.label); }} className="shrink-0 h-8 w-8 ml-auto" title="Écouter">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {isCorrect && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
        </Button>
        {current === TCF_QUESTIONS.length - 1 && !submitted ? (
          <Button onClick={doSubmit} disabled={answers[current] === null}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Soumettre le test
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={answers[current] === null}>
            Suivant <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {submitted && totalScore !== null && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-2xl font-bold text-center">Score global : {totalScore}/{TCF_QUESTIONS.length}</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">🎧 CO</p>
                <p className="text-lg font-bold">{scoreCO}/30</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">📝 Structures</p>
                <p className="text-lg font-bold">{scoreStr}/10</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">📖 CE</p>
                <p className="text-lg font-bold">{scoreCE}/40</p>
              </div>
            </div>
            <p className="text-center text-muted-foreground">
              {totalScore >= 64 ? "Excellent !" : totalScore >= 48 ? "Bon niveau !" : totalScore >= 32 ? "Des points à retravailler." : "Accompagnement renforcé recommandé."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ───────── Timer Bar Component ───────── */
function TimerBar({ timeLeft, isUrgent }: { timeLeft: number; isUrgent: boolean }) {
  return (
    <Card className={`border-2 ${isUrgent ? "border-destructive bg-destructive/5" : "border-transparent"}`}>
      <CardContent className="py-3 flex items-center justify-center gap-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-destructive" : "text-foreground"}`}>
          {formatTime(timeLeft)}
        </span>
        {isUrgent && <span className="text-sm text-destructive font-medium">Temps presque écoulé !</span>}
      </CardContent>
    </Card>
  );
}

/* ───────── Main Page ───────── */
const TestsEntreePage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tests d'entrée</h1>
        <p className="text-muted-foreground mt-1">
          Diagnostic précis par sous-items, radar de compétences et analyse IA.
        </p>
      </div>

      <Tabs defaultValue="diagnostic">
        <TabsList>
          <TabsTrigger value="diagnostic">Diagnostic par sous-items</TabsTrigger>
          <TabsTrigger value="passation">Passage du Test (Aperçu)</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostic" className="mt-4">
          <DiagnosticSousItems />
        </TabsContent>

        <TabsContent value="passation" className="mt-4">
          <PassationTest />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestsEntreePage;
