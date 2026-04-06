import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Target,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  Timer,
  Shield,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const competenceColors: Record<string, string> = {
  CO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EO: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Structures: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const ParcoursDetail = () => {
  const { parcoursId } = useParams<{ parcoursId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  // Bilan state for a specific seance
  const [bilanSeanceId, setBilanSeanceId] = useState<string | null>(null);
  const [checkedExercises, setCheckedExercises] = useState<number>(0);
  const [totalExercises, setTotalExercises] = useState<number>(0);

  // Arbitrage state
  const [showArbitrage, setShowArbitrage] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [adaptationResult, setAdaptationResult] = useState<any>(null);
  const [showAdaptResult, setShowAdaptResult] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: parcours, isLoading: pLoading } = useQuery({
    queryKey: ["parcours-detail", parcoursId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcours")
        .select("*, group:groups(nom)")
        .eq("id", parcoursId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!parcoursId,
  });

  const { data: seances, isLoading: sLoading } = useQuery({
    queryKey: ["parcours-seances", parcoursId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcours_seances")
        .select("*")
        .eq("parcours_id", parcoursId!)
        .order("ordre");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!parcoursId,
  });

  // Fetch student profiles for the group to detect gaps
  const { data: groupProfiles } = useQuery({
    queryKey: ["parcours-group-profiles", parcours?.group_id],
    queryFn: async () => {
      if (!parcours?.group_id) return null;
      const { data: members } = await supabase.from("group_members").select("eleve_id").eq("group_id", parcours.group_id);
      if (!members?.length) return null;
      const ids = members.map(m => m.eleve_id);
      const { data: profils } = await supabase.from("profils_eleves").select("*").in("eleve_id", ids);
      if (!profils?.length) return null;
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return {
        CO: avg(profils.map(p => Number(p.taux_reussite_co))),
        CE: avg(profils.map(p => Number(p.taux_reussite_ce))),
        EE: avg(profils.map(p => Number(p.taux_reussite_ee))),
        EO: avg(profils.map(p => Number(p.taux_reussite_eo))),
        Structures: avg(profils.map(p => Number(p.taux_reussite_structures))),
        global: avg(profils.map(p => Number(p.taux_reussite_global))),
      };
    },
    enabled: !!parcours?.group_id,
  });

  const [readjusting, setReadjusting] = useState(false);

  const allSeances = seances || [];
  const completedSeances = allSeances.filter((s) => s.statut === "termine");
  const currentSeance = allSeances.find((s) => s.statut === "en_cours") || allSeances.find((s) => s.statut === "prevu");
  const remainingSeances = allSeances.filter((s) => s.statut === "prevu");
  const progressPercent = allSeances.length > 0 ? Math.round((completedSeances.length / allSeances.length) * 100) : 0;

  // Compute gap: expected progress vs real
  const expectedProgress = allSeances.length > 0 ? (completedSeances.length / allSeances.length) * 100 : 0;
  const realProgress = groupProfiles?.global ?? 0;
  const competenceGaps = groupProfiles ? (["CO", "CE", "EE", "EO", "Structures"] as const).filter(c => {
    const target = expectedProgress; // simplified target
    const actual = groupProfiles[c];
    return target > 0 && actual < target * 0.8; // 20% behind
  }) : [];

  const handleReadjust = async () => {
    if (!parcours || remainingSeances.length === 0) return;
    setReadjusting(true);
    try {
      const { data, error } = await supabase.functions.invoke("adapt-parcours", {
        body: {
          mode: "garder_exigence",
          parcoursTitle: parcours.titre,
          niveauDepart: parcours.niveau_depart,
          niveauCible: parcours.niveau_cible,
          heuresTotalesPrevues: parcours.heures_totales_prevues,
          seancesRestantes: remainingSeances.map((s: any) => ({
            titre: s.titre,
            objectif_principal: s.objectif_principal,
            competences_cibles: s.competences_cibles,
            duree_minutes: s.duree_minutes,
            nb_exercices_suggeres: s.nb_exercices_suggeres,
          })),
          retard: {
            exercicesNonFaits: 0,
            minutesRetard: 0,
            competencesEnRetard: competenceGaps,
            progressionReelle: groupProfiles,
          },
          seanceActuelle: null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAdaptationResult({ ...data.adaptation, mode: "garder_exigence" });
      setShowAdaptResult(true);
      toast.success("Réajustement généré !");
    } catch (e: any) {
      toast.error("Erreur IA", { description: e.message });
    } finally {
      setReadjusting(false);
    }
  };

  const startBilan = (seance: any) => {
    setBilanSeanceId(seance.id);
    setTotalExercises(seance.exercices_total || seance.nb_exercices_suggeres || 5);
    setCheckedExercises(seance.exercices_total || seance.nb_exercices_suggeres || 5);
  };

  const handleBilanValidate = async () => {
    if (!bilanSeanceId) return;
    const seance = allSeances.find((s) => s.id === bilanSeanceId);
    if (!seance) return;

    const total = seance.exercices_total || seance.nb_exercices_suggeres || 5;
    const nonFaits = total - checkedExercises;

    // Update seance as completed
    const { error } = await supabase
      .from("parcours_seances")
      .update({
        statut: "termine",
        exercices_faits: checkedExercises,
        heures_reelles: seance.duree_minutes,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", bilanSeanceId);

    if (error) {
      toast.error("Erreur", { description: error.message });
      return;
    }

    setBilanSeanceId(null);

    // If there's a delay, show arbitrage modal
    if (nonFaits > 0 && remainingSeances.length > 1) {
      setShowArbitrage(true);
    } else {
      qc.invalidateQueries({ queryKey: ["parcours-seances", parcoursId] });
      toast.success("Séance validée !");
    }
  };

  const handleArbitrage = async (mode: "respecter_chrono" | "garder_exigence") => {
    setShowArbitrage(false);
    setAdapting(true);

    const seance = allSeances.find((s) => s.id === bilanSeanceId) || currentSeance;
    const total = seance?.exercices_total || seance?.nb_exercices_suggeres || 5;
    const nonFaits = total - checkedExercises;

    try {
      const { data, error } = await supabase.functions.invoke("adapt-parcours", {
        body: {
          mode,
          parcoursTitle: parcours?.titre,
          niveauDepart: parcours?.niveau_depart,
          niveauCible: parcours?.niveau_cible,
          heuresTotalesPrevues: parcours?.heures_totales_prevues,
          seancesRestantes: remainingSeances.filter((s) => s.id !== bilanSeanceId).map((s) => ({
            titre: s.titre,
            objectif_principal: s.objectif_principal,
            competences_cibles: s.competences_cibles,
            duree_minutes: s.duree_minutes,
            nb_exercices_suggeres: s.nb_exercices_suggeres,
          })),
          retard: {
            exercicesNonFaits: nonFaits,
            minutesRetard: Math.round(nonFaits * (seance?.duree_minutes || 90) / total),
          },
          seanceActuelle: seance ? { titre: seance.titre } : null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAdaptationResult({ ...data.adaptation, mode });
      setShowAdaptResult(true);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur d'adaptation IA", { description: e.message });
    } finally {
      setAdapting(false);
    }
  };

  const applyAdaptation = async () => {
    if (!adaptationResult) return;
    setSaving(true);
    try {
      // Delete remaining planned seances
      const remainingIds = remainingSeances.filter((s) => s.id !== bilanSeanceId).map((s) => s.id);
      if (remainingIds.length > 0) {
        await supabase.from("parcours_seances").delete().in("id", remainingIds);
      }

      // Insert adapted seances
      const startOrdre = completedSeances.length + 2; // +1 for current, +1 for 1-indexed
      const newSeances = (adaptationResult.seances_adaptees || []).map((s: any, i: number) => ({
        parcours_id: parcoursId,
        ordre: startOrdre + i,
        titre: s.titre,
        objectif_principal: s.objectif_principal,
        competences_cibles: s.competences_cibles || [],
        duree_minutes: s.duree_minutes,
        nb_exercices_suggeres: s.nb_exercices_suggeres,
        exercices_total: s.nb_exercices_suggeres,
        statut: "prevu",
      }));

      if (newSeances.length > 0) {
        await supabase.from("parcours_seances").insert(newSeances as any);
      }

      // Update parcours totals
      await supabase
        .from("parcours")
        .update({
          heures_totales_prevues: adaptationResult.heures_totales_ajustees,
          nb_seances_prevues: completedSeances.length + 1 + newSeances.length,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", parcoursId!);

      // Create notification
      await supabase.from("notifications").insert({
        user_id: user!.id,
        titre: adaptationResult.mode === "respecter_chrono" ? "Plan allégé par l'IA" : "Plan étendu par l'IA",
        message: adaptationResult.message_formateur,
      });

      qc.invalidateQueries({ queryKey: ["parcours-seances", parcoursId] });
      qc.invalidateQueries({ queryKey: ["parcours-detail", parcoursId] });

      toast.success("Plan adapté !", { description: adaptationResult.message_formateur });
      setShowAdaptResult(false);
      setAdaptationResult(null);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (pLoading || sLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/formateur/parcours")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{parcours?.titre}</h1>
          <p className="text-sm text-muted-foreground">
            {parcours?.niveau_depart} → {parcours?.niveau_cible}
            {parcours?.group?.nom && ` · ${parcours.group.nom}`}
            {` · ${parcours?.heures_totales_prevues}h prévues`}
            {parcours?.date_examen_cible && ` · Examen : ${parcours.date_examen_cible}`}
          </p>
        </div>
      </div>

      {/* Progress overview */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progression du plan</span>
            <span className="text-sm text-muted-foreground">{completedSeances.length} / {allSeances.length} séances</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {completedSeances.length} terminée(s)
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {remainingSeances.length} restante(s)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic adjustment banner */}
      {competenceGaps.length > 0 && remainingSeances.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-50/30 dark:bg-orange-950/10">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Réajustement suggéré</p>
                  <p className="text-xs text-muted-foreground">
                    Retard &gt;20% sur : {competenceGaps.join(", ")}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleReadjust} disabled={readjusting}>
                {readjusting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Réajuster par l'IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adapting overlay */}
      {adapting && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
            <p className="font-medium">L'IA adapte votre plan de formation...</p>
            <p className="text-sm text-muted-foreground mt-1">Analyse des retards et recalcul de la progression</p>
          </CardContent>
        </Card>
      )}

      {/* Seances list */}
      <div className="space-y-2">
        {allSeances.map((s, i) => {
          const isCompleted = s.statut === "termine";
          const isCurrent = s.id === currentSeance?.id && !isCompleted;
          const isInBilan = s.id === bilanSeanceId;

          return (
            <Card
              key={s.id}
              className={cn(
                "transition-all",
                isCompleted && "border-green-500/20 bg-green-50/30 dark:bg-green-950/10",
                isCurrent && "border-primary/30 bg-primary/5",
                isInBilan && "ring-2 ring-primary"
              )}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 mt-0.5",
                    isCompleted ? "bg-green-500/20 text-green-600" : "bg-primary/10 text-primary"
                  )}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{s.titre}</span>
                      <span className="text-xs text-muted-foreground">{s.duree_minutes} min</span>
                      {isCompleted && s.exercices_faits != null && (
                        <Badge variant="outline" className="text-[10px]">
                          {s.exercices_faits}/{s.exercices_total || s.nb_exercices_suggeres} ex.
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.objectif_principal}</p>
                    <div className="flex gap-1 flex-wrap">
                      {(s.competences_cibles || []).map((c: string) => (
                        <Badge key={c} className={`text-[10px] ${competenceColors[c] || ""}`}>{c}</Badge>
                      ))}
                    </div>

                    {/* Bilan inline */}
                    {isInBilan && (
                      <div className="mt-3 p-3 rounded-lg border bg-background space-y-3">
                        <Label className="text-sm font-semibold">Bilan — Combien d'exercices ont été faits ?</Label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            value={checkedExercises}
                            onChange={(e) => setCheckedExercises(Math.max(0, Math.min(totalExercises, Number(e.target.value))))}
                            min={0}
                            max={totalExercises}
                            className="w-24 h-9"
                          />
                          <span className="text-sm text-muted-foreground">/ {totalExercises} exercices</span>
                          {checkedExercises < totalExercises && (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {totalExercises - checkedExercises} non faits
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleBilanValidate}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Valider
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setBilanSeanceId(null)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex gap-1">
                    {!isCompleted && !isInBilan && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/formateur/session-builder", {
                              state: {
                                titre: s.titre,
                                objectifs: s.objectif_principal,
                                competences_cibles: s.competences_cibles || [],
                                duree_minutes: s.duree_minutes,
                                niveau_cible: parcours?.niveau_cible || "A1",
                                source: "parcours",
                                groupId: parcours?.group_id,
                              },
                            });
                          }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" /> Construire
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startBilan(s)}>
                          Bilan
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Arbitrage Modal */}
      <Dialog open={showArbitrage} onOpenChange={setShowArbitrage}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Arbitrage pédagogique
            </DialogTitle>
            <DialogDescription>
              Des exercices n'ont pas été terminés. Comment souhaitez-vous adapter la suite du parcours ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleArbitrage("respecter_chrono")}
            >
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-3">
                  <Timer className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Option A — Respecter le chrono</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Le volume horaire total reste identique. L'IA allège les prochaines séances
                      en fusionnant des concepts et en retirant les exercices secondaires.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleArbitrage("garder_exigence")}
            >
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Option B — Garder l'exigence</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tous les exercices prévus sont maintenus. L'IA rajoute des heures
                      ou une séance supplémentaire pour absorber le retard.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adaptation result dialog */}
      <Dialog open={showAdaptResult} onOpenChange={setShowAdaptResult}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Parcours adapté
              {adaptationResult?.mode === "respecter_chrono" ? " (Chrono respecté)" : " (Exigence maintenue)"}
            </DialogTitle>
            <DialogDescription>{adaptationResult?.message_formateur}</DialogDescription>
          </DialogHeader>
          {adaptationResult && (
            <div className="space-y-3 py-2">
              <div className="flex gap-3 text-sm">
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {adaptationResult.heures_totales_ajustees}h total
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <BookOpen className="h-3 w-3" />
                  {adaptationResult.seances_adaptees?.length} séances
                </Badge>
              </div>
              {(adaptationResult.seances_adaptees || []).map((s: any, i: number) => (
                <div key={i} className={cn(
                  "p-3 rounded-lg border space-y-1",
                  s.est_nouvelle && "border-green-500/30 bg-green-50/30 dark:bg-green-950/10"
                )}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.titre}</span>
                    <span className="text-xs text-muted-foreground">{s.duree_minutes} min · {s.nb_exercices_suggeres} ex.</span>
                    {s.est_nouvelle && <Badge className="text-[10px] bg-green-500/20 text-green-700">+ Nouvelle</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.objectif_principal}</p>
                  <div className="flex gap-1">
                    {(s.competences_cibles || []).map((c: string) => (
                      <Badge key={c} className={`text-[10px] ${competenceColors[c] || ""}`}>{c}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={applyAdaptation} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Appliquer
            </Button>
            <Button variant="outline" onClick={() => { setShowAdaptResult(false); qc.invalidateQueries({ queryKey: ["parcours-seances", parcoursId] }); }} className="flex-1">
              Ignorer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParcoursDetail;
