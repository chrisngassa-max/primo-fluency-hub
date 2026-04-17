import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LiveStudent } from "@/data/mockLiveClass";

export type AdaptiveMode = "harder" | "easier" | "same";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: LiveStudent | null;
  mode: AdaptiveMode;
}

function deriveDifficulty(base: number, mode: AdaptiveMode) {
  let next = base;
  if (mode === "harder") next = Math.min(5, base + 1);
  if (mode === "easier") next = Math.max(1, base - 1);
  return next;
}

function defaultConsigne(theme: string, comp: string, diff: number, mode: AdaptiveMode) {
  const tag =
    mode === "harder" ? "plus exigeant" : mode === "easier" ? "guidé" : "même niveau";
  return `Nouvel exercice ${comp} sur le thème "${theme}" — niveau ${diff}/5 (${tag}). Lis attentivement la consigne et réponds en t'appuyant sur le contexte.`;
}

const AdaptiveProposalDialog = ({ open, onOpenChange, student, mode }: Props) => {
  const [theme, setTheme] = useState("");
  const [competence, setCompetence] = useState("");
  const [difficulte, setDifficulte] = useState(2);
  const [consigne, setConsigne] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!student || !open) return;
    const next = deriveDifficulty(student.difficulte, mode);
    setTheme(student.theme);
    setCompetence(student.competence);
    setDifficulte(next);
    setConsigne(defaultConsigne(student.theme, student.competence, next, mode));
  }, [student, mode, open]);

  if (!student) return null;

  const modeLabel =
    mode === "harder"
      ? "Plus difficile"
      : mode === "easier"
        ? "Plus facile"
        : "Même niveau";

  const handleSend = async () => {
    setSending(true);
    // Simule génération + envoi individuel.
    await new Promise((r) => setTimeout(r, 700));
    setSending(false);
    onOpenChange(false);
    toast.success(`Exercice envoyé à ${student.nom}`, {
      description: `${competence} · ${theme} · niveau ${difficulte}/5`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Proposer un exercice — {student.nom}
            <Badge variant="outline">{modeLabel}</Badge>
          </DialogTitle>
          <DialogDescription>
            Confirmez le contenu avant l'envoi individuel à l'élève.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="theme">Thème</Label>
              <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="competence">Compétence</Label>
              <Input
                id="competence"
                value={competence}
                onChange={(e) => setCompetence(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="difficulte">Difficulté (1–5)</Label>
            <Input
              id="difficulte"
              type="number"
              min={1}
              max={5}
              value={difficulte}
              onChange={(e) => setDifficulte(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Base : {student.difficulte}/5 — proposition : {difficulte}/5
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consigne">Aperçu de la consigne</Label>
            <Textarea
              id="consigne"
              rows={4}
              value={consigne}
              onChange={(e) => setConsigne(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Générer puis envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdaptiveProposalDialog;
