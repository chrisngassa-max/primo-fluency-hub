import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Printer,
  ArrowLeft,
  BookOpen,
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
  traite_en_classe: { label: "Traité", color: "bg-success/10 text-success border-success/30", icon: CheckCircle2 },
  reporte: { label: "Reporté", color: "bg-warning/10 text-warning border-warning/30", icon: ArrowRight },
  planifie: { label: "Planifié", color: "bg-muted text-muted-foreground border-border", icon: Clock },
};

const SessionPilot = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(0);

  const exercises = mockExercises;

  const exerciseStatuses = useMemo(() => {
    return exercises.map((ex, i) => {
      if (cursor === 0) return "planifie" as ExerciseStatus;
      if (i < cursor) return "traite_en_classe" as ExerciseStatus;
      return "reporte" as ExerciseStatus;
    });
  }, [cursor, exercises.length]);

  const handleSave = () => {
    // TODO: Save to DB via session_exercices table
    toast.success("Bilan de séance sauvegardé", {
      description: `${cursor} exercice(s) traité(s), ${exercises.length - cursor} reporté(s).`,
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

      {/* Cursor Slider */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Curseur d'avancement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Début</span>
              <span className="font-medium text-foreground">
                {cursor === 0
                  ? "Aucun exercice traité"
                  : `Arrêté à l'exercice ${cursor} / ${exercises.length}`}
              </span>
              <span>Fin</span>
            </div>
            <Slider
              value={[cursor]}
              onValueChange={([v]) => setCursor(v)}
              min={0}
              max={exercises.length}
              step={1}
              className="py-2"
            />
          </div>

          <div className="flex gap-3 text-sm">
            <Badge variant="outline" className="gap-1 border-success/30 text-success">
              <CheckCircle2 className="h-3 w-3" />
              {cursor} traité(s)
            </Badge>
            <Badge variant="outline" className="gap-1 border-warning/30 text-warning">
              <ArrowRight className="h-3 w-3" />
              {cursor > 0 ? exercises.length - cursor : 0} reporté(s)
            </Badge>
          </div>

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

      {/* Exercise List */}
      <div className="space-y-3">
        {exercises.map((ex, i) => {
          const status = exerciseStatuses[i];
          const config = statusConfig[status];
          const StatusIcon = config.icon;

          return (
            <Card
              key={ex.id}
              className={cn(
                "transition-all print:break-inside-avoid print:border print:shadow-none",
                status === "traite_en_classe" && "border-success/20",
                status === "reporte" && "border-warning/20 opacity-70 print:opacity-100"
              )}
            >
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-3">
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
                      <Badge variant="secondary" className="text-[10px] print:hidden">
                        {ex.competence}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] gap-1 print:hidden", config.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
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
