import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, Target } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

interface NextSessionOption {
  id: string;
  titre: string;
  date_seance: string;
}

interface GenerateDailyHomeworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSessionDate: string;
  nextSessions: NextSessionOption[];
  onGenerate: (params: {
    targetSessionId: string;
    dailyDuration: number;
    targetDays: number;
    targetWeaknesses: boolean;
  }) => Promise<void>;
}

const DURATION_OPTIONS = [
  { value: 15, label: "15 min", description: "Léger — 3-4 exercices/jour" },
  { value: 30, label: "30 min", description: "Modéré — 6-8 exercices/jour" },
  { value: 45, label: "45 min", description: "Soutenu — 10-12 exercices/jour" },
  { value: 60, label: "60 min", description: "Intensif — 14-16 exercices/jour" },
];

const GenerateDailyHomeworkDialog = ({
  open,
  onOpenChange,
  currentSessionDate,
  nextSessions,
  onGenerate,
}: GenerateDailyHomeworkDialogProps) => {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [dailyDuration, setDailyDuration] = useState<number>(15);
  const [targetWeaknesses, setTargetWeaknesses] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedNext = nextSessions.find((s) => s.id === selectedSession);
  const targetDays = selectedNext
    ? Math.max(1, differenceInDays(new Date(selectedNext.date_seance), new Date(currentSessionDate)))
    : 0;

  const handleGenerate = async () => {
    if (!selectedSession || targetDays === 0) return;
    setGenerating(true);
    try {
      await onGenerate({
        targetSessionId: selectedSession,
        dailyDuration,
        targetDays,
        targetWeaknesses,
      });
      onOpenChange(false);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Devoirs quotidiens IA
          </DialogTitle>
          <DialogDescription>
            Générez un programme de devoirs étalé jour par jour jusqu'à la prochaine séance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Target session selector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Séance cible</Label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner la prochaine séance" />
              </SelectTrigger>
              <SelectContent>
                {nextSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.titre} — {format(new Date(s.date_seance), "EEEE d MMMM", { locale: fr })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targetDays > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {targetDays} jour{targetDays > 1 ? "s" : ""} d'intervalle
              </p>
            )}
          </div>

          {/* Daily workload */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Charge quotidienne</Label>
            <RadioGroup
              value={String(dailyDuration)}
              onValueChange={(v) => setDailyDuration(Number(v))}
              className="grid grid-cols-2 gap-2"
            >
              {DURATION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    dailyDuration === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <RadioGroupItem value={String(opt.value)} />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Target weaknesses */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
            <Checkbox
              id="target-weaknesses"
              checked={targetWeaknesses}
              onCheckedChange={(v) => setTargetWeaknesses(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="target-weaknesses" className="cursor-pointer">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Cibler les faiblesses du test de séance
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                L'IA priorisera les compétences où l'élève a obtenu moins de 60%
              </p>
            </label>
          </div>

          {/* Summary */}
          {targetDays > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Récapitulatif</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{targetDays} jour{targetDays > 1 ? "s" : ""}</Badge>
                <Badge variant="secondary">{dailyDuration} min/jour</Badge>
                <Badge variant="secondary">{targetDays * dailyDuration} min total</Badge>
                {targetWeaknesses && <Badge variant="outline" className="text-primary border-primary/30">Faiblesses ciblées</Badge>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedSession || targetDays === 0}
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            Générer les devoirs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateDailyHomeworkDialog;
