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
import { Input } from "@/components/ui/input";
import { Loader2, Calendar, Clock, Target } from "lucide-react";
import { format, differenceInCalendarDays, addDays } from "date-fns";
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
  const [manualDate, setManualDate] = useState<string>("");
  const [dailyDuration, setDailyDuration] = useState<number>(15);
  const [targetWeaknesses, setTargetWeaknesses] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Default manual date suggestion: 7 days from current session
  const defaultManualDate = format(addDays(new Date(currentSessionDate), 7), "yyyy-MM-dd");
  const minDate = format(addDays(new Date(currentSessionDate), 1), "yyyy-MM-dd");
  const resolvedManualDate = manualDate || defaultManualDate;

  const useManualDate = nextSessions.length === 0 || selectedSession === "__manual__";

  const effectiveTargetDate = useManualDate
    ? resolvedManualDate
    : nextSessions.find((s) => s.id === selectedSession)?.date_seance;

  const rawTargetDays = effectiveTargetDate
    ? differenceInCalendarDays(new Date(effectiveTargetDate), new Date(currentSessionDate))
    : 0;

  const targetDays = rawTargetDays > 0 ? rawTargetDays : 0;
  const canGenerate = targetDays > 0 && (useManualDate ? !!resolvedManualDate : !!selectedSession);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      await onGenerate({
        targetSessionId: useManualDate ? "__manual__" : selectedSession,
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
            {nextSessions.length > 0 ? (
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
                  <SelectItem value="__manual__">
                    📅 Saisir une date manuellement
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Aucune séance future planifiée — saisissez une date cible ci-dessous.
              </p>
            )}

            {/* Manual date input */}
            {useManualDate && (
              <div className="space-y-1 pt-1">
                <Label className="text-xs text-muted-foreground">Date cible des devoirs</Label>
                <Input
                  type="date"
                  value={resolvedManualDate}
                  min={minDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
            )}

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
                Inclure le bilan de séance
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Intègre aussi les résultats du test de bilan en plus de l'historique individuel
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
            disabled={generating || !canGenerate}
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
