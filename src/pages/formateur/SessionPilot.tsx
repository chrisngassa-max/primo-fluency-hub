import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, ArrowRight, Printer, ArrowLeft,
  BookOpen, Minus, Plus, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ExerciseStatus = "traite_en_classe" | "reporte" | "planifie";

const statusConfig: Record<ExerciseStatus, { label: string; color: string; icon: React.ElementType }> = {
  traite_en_classe: { label: "Traité", color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800", icon: CheckCircle2 },
  reporte: { label: "Reporté", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", icon: ArrowRight },
  planifie: { label: "Planifié", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const SessionPilot = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Fetch real session data
  const { data: session } = useQuery({
    queryKey: ["session-info", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, group:groups(nom)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sessionExercices, isLoading } = useQuery({
    queryKey: ["session-exercices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_exercices")
        .select("*, exercice:exercices(titre, consigne, competence, format)")
        .eq("session_id", id!)
        .order("ordre");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const exercises = sessionExercices ?? [];

  const checkedCount = useMemo(
    () => exercises.filter((ex) => checked[ex.id]).length,
    [checked, exercises]
  );

  const toggleExercise = useCallback((exerciseId: string) => {
    setChecked((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }, []);

  const checkAll = useCallback(() => {
    const allChecked = exercises.every((ex) => checked[ex.id]);
    const newState: Record<string, boolean> = {};
    exercises.forEach((ex) => { newState[ex.id] = !allChecked; });
    setChecked(newState);
  }, [checked, exercises]);

  const checkUpTo = useCallback((index: number) => {
    const newState: Record<string, boolean> = {};
    exercises.forEach((ex, i) => { newState[ex.id] = i <= index; });
    setChecked(newState);
  }, [exercises]);

  const getStatus = (exerciseId: string): ExerciseStatus => {
    if (checked[exerciseId]) return "traite_en_classe";
    if (checkedCount > 0) return "reporte";
    return "planifie";
  };

  const handleSave = async () => {
    if (checkedCount === 0) {
      toast.error("Cochez au moins un exercice traité.");
      return;
    }
    setSaving(true);
    try {
      // Update checked as traite_en_classe
      const checkedIdsArr = exercises.filter((e) => checked[e.id]).map((e) => e.id);
      if (checkedIdsArr.length > 0) {
        const { error } = await supabase
          .from("session_exercices")
          .update({ statut: "traite_en_classe" as any, updated_at: new Date().toISOString() })
          .in("id", checkedIdsArr);
        if (error) throw error;
      }

      // Mark unchecked as reporte
      const uncheckedIdsArr = exercises.filter((e) => !checked[e.id]).map((e) => e.id);
      if (uncheckedIdsArr.length > 0) {
        const { error } = await supabase
          .from("session_exercices")
          .update({ statut: "reporte" as any, updated_at: new Date().toISOString() })
          .in("id", uncheckedIdsArr);
        if (error) throw error;
      }

      toast.success("Avancement sauvegardé !", {
        description: `${checkedCount} traité(s), ${exercises.length - checkedCount} reporté(s).`,
      });
      // Navigate to bilan for final validation
      navigate(`/formateur/seances/${id}/bilan`);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally { setSaving(false); }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Pilote de séance</h1>
          <p className="text-sm text-muted-foreground">
            {session?.titre || "Séance"} · {(session as any)?.group?.nom} · {exercises.length} exercice(s)
          </p>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Fiche Séance — TCF Pro</h1>
        <p className="text-muted-foreground">
          {session?.titre} · {exercises.length} exercices · {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>

      {exercises.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun exercice rattaché</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Rattachez des exercices à cette séance depuis la page Séances.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quick Controls */}
          <Card className="print:hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Avancement de la séance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Curseur rapide :</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => {
                      const firstUnchecked = exercises.findIndex((ex) => !checked[ex.id]);
                      if (firstUnchecked > 0) checkUpTo(firstUnchecked - 2);
                      else if (firstUnchecked === -1) checkUpTo(exercises.length - 2);
                      else setChecked({});
                    }}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1 flex-wrap">
                    {exercises.map((ex, i) => (
                      <button key={ex.id} onClick={() => checkUpTo(i)}
                        className={cn(
                          "h-8 w-8 rounded-md text-xs font-semibold border transition-colors",
                          checked[ex.id]
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-accent"
                        )}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => {
                      const firstUnchecked = exercises.findIndex((ex) => !checked[ex.id]);
                      if (firstUnchecked >= 0) checkUpTo(firstUnchecked);
                    }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3 text-sm flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 text-xs font-medium dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                  <CheckCircle2 className="h-3 w-3" />{checkedCount} traité(s)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-xs font-medium dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                  <ArrowRight className="h-3 w-3" />{checkedCount > 0 ? exercises.length - checkedCount : 0} reporté(s)
                </span>
                <button onClick={checkAll} className="text-xs text-primary hover:underline ml-auto">
                  {exercises.every((ex) => checked[ex.id]) ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Valider et passer au bilan
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />Imprimer
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Exercise List */}
          <div className="space-y-3">
            {exercises.map((se, i) => {
              const ex = (se as any).exercice;
              const status = getStatus(se.id);
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              const isChecked = !!checked[se.id];

              return (
                <Card key={se.id}
                  className={cn(
                    "transition-all cursor-pointer print:break-inside-avoid print:border print:shadow-none",
                    isChecked && "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30",
                    !isChecked && checkedCount > 0 && "opacity-60"
                  )}
                  onClick={() => toggleExercise(se.id)}>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5 print:hidden">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleExercise(se.id)}
                          onClick={(e) => e.stopPropagation()} className="h-5 w-5" />
                      </div>
                      <div className={cn("flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0 border", config.color)}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{ex?.titre || "Exercice"}</h3>
                          <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground print:hidden">
                            {ex?.competence}
                          </span>
                          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border print:hidden", config.color)}>
                            <StatusIcon className="h-3 w-3" />{config.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ex?.consigne}</p>
                        <p className="text-[10px] text-muted-foreground/60 print:hidden">Format : {ex?.format?.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <style>{`@media print { nav, header, .print\\:hidden { display: none !important; } body { font-size: 12pt; } }`}</style>
    </div>
  );
};

export default SessionPilot;
