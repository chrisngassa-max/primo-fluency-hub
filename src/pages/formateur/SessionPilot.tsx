import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Printer,
  ArrowLeft,
  BookOpen,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock exercise data for demo — will be replaced by real DB queries
const mockExercises = [
  { id: "1", ordre: 1, titre: "Comprendre une annonce sonore", consigne: "Écoutez l'annonce et répondez aux questions.", competence: "CO", format: "qcm" },
  { id: "2", ordre: 2, titre: "Identifier un horaire de bus", consigne: "Regardez le tableau d'horaires et répondez.", competence: "CE", format: "qcm" },
  { id: "3", ordre: 3, titre: "Compléter un formulaire d'inscription", consigne: "Remplissez le formulaire avec vos informations.", competence: "EE", format: "texte_lacunaire" },
  { id: "4", ordre: 4, titre: "Les articles définis et indéfinis", consigne: "Choisissez le bon article pour chaque phrase.", competence: "Structures", format: "qcm" },
  { id: "5", ordre: 5, titre: "Comprendre un mail de la CAF", consigne: "Lisez le mail et répondez aux questions.", competence: "CE", format: "vrai_faux" },
  { id: "6", ordre: 6, titre: "Se présenter à un guichet", consigne: "Simulez une présentation au guichet de la préfecture.", competence: "EO", format: "production_orale" },
];

type ExerciseStatus = "traite_en_classe" | "reporte" | "planifie";

const statusConfig: Record<ExerciseStatus, { label: string; color: string; icon: React.ElementType }> = {
  traite_en_classe: { label: "Traité", color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800", icon: CheckCircle2 },
  reporte: { label: "Reporté", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800", icon: ArrowRight },
  planifie: { label: "Planifié", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const SessionPilot = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const exercises = mockExercises;

  // Individual checked state for each exercise
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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
    exercises.forEach((ex) => {
      newState[ex.id] = !allChecked;
    });
    setChecked(newState);
  }, [checked, exercises]);

  const checkUpTo = useCallback((index: number) => {
    const newState: Record<string, boolean> = {};
    exercises.forEach((ex, i) => {
      newState[ex.id] = i <= index;
    });
    setChecked(newState);
  }, [exercises]);

  const getStatus = (exerciseId: string): ExerciseStatus => {
    if (checked[exerciseId]) return "traite_en_classe";
    // If any exercise is checked, unchecked ones are "reporté"
    if (checkedCount > 0) return "reporte";
    return "planifie";
  };

  const handleSave = () => {
    toast.success("Bilan de séance sauvegardé", {
      description: `${checkedCount} exercice(s) traité(s), ${exercises.length - checkedCount} reporté(s).`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

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
            Séance #{id?.slice(0, 8) || "demo"} · {exercises.length} exercices
          </p>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Fiche Séance — TCF Pro</h1>
        <p className="text-muted-foreground">
          {exercises.length} exercices · {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>

      {/* Quick Controls */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Avancement de la séance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick cursor buttons */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Curseur rapide :</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const currentMax = exercises.findIndex((ex) => !checked[ex.id]);
                  if (currentMax > 0) checkUpTo(currentMax - 2);
                  else if (currentMax === -1) checkUpTo(exercises.length - 2);
                  else setChecked({});
                }}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex gap-1">
                {exercises.map((ex, i) => (
                  <button
                    key={ex.id}
                    onClick={() => checkUpTo(i)}
                    className={cn(
                      "h-8 w-8 rounded-md text-xs font-semibold border transition-colors",
                      checked[ex.id]
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    )}
                  >
                    {ex.ordre}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const firstUnchecked = exercises.findIndex((ex) => !checked[ex.id]);
                  if (firstUnchecked >= 0) checkUpTo(firstUnchecked);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-sm flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200 text-xs font-medium dark:bg-green-950 dark:text-green-300 dark:border-green-800">
              <CheckCircle2 className="h-3 w-3" />
              {checkedCount} traité(s)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-xs font-medium dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
              <ArrowRight className="h-3 w-3" />
              {checkedCount > 0 ? exercises.length - checkedCount : 0} reporté(s)
            </span>
            <button
              onClick={checkAll}
              className="text-xs text-primary hover:underline ml-auto"
            >
              {exercises.every((ex) => checked[ex.id]) ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">
              Sauvegarder le bilan
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exercise List with Checkboxes */}
      <div className="space-y-3">
        {exercises.map((ex) => {
          const status = getStatus(ex.id);
          const config = statusConfig[status];
          const StatusIcon = config.icon;
          const isChecked = !!checked[ex.id];

          return (
            <Card
              key={ex.id}
              className={cn(
                "transition-all cursor-pointer print:break-inside-avoid print:border print:shadow-none",
                isChecked && "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30",
                !isChecked && checkedCount > 0 && "opacity-60"
              )}
              onClick={() => toggleExercise(ex.id)}
            >
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="pt-0.5 print:hidden">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleExercise(ex.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5"
                    />
                  </div>

                  {/* Number */}
                  <div
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold shrink-0 border",
                      config.color
                    )}
                  >
                    {ex.ordre}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{ex.titre}</h3>
                      <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground print:hidden">
                        {ex.competence}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border print:hidden", config.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{ex.consigne}</p>
                    <p className="text-[10px] text-muted-foreground/60 print:hidden">
                      Format : {ex.format}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, .print\\:hidden { display: none !important; }
          body { font-size: 12pt; }
          .space-y-3 > * { margin-bottom: 8px; }
        }
      `}</style>
    </div>
  );
};

export default SessionPilot;
