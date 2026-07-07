import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrainingSession } from "@/lib/curriculum/types";
import {
  CURRICULUM_PALIERS,
  createOrOpenPilotSession,
  defaultPalierCible,
  type CurriculumPalier,
} from "@/lib/curriculum/pilot";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CurriculumPilotButtonProps {
  trainingSession: TrainingSession;
  palierCible?: CurriculumPalier;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function CurriculumPilotButton({
  trainingSession,
  palierCible: palierCibleProp,
  variant = "outline",
  size = "sm",
  className,
  onClick,
}: CurriculumPilotButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [palierCible, setPalierCible] = useState<CurriculumPalier>(
    palierCibleProp ?? defaultPalierCible(trainingSession),
  );
  const [dateSeance, setDateSeance] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [loading, setLoading] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ["formateur-groups-pilot", user?.id],
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
    enabled: !!user && open,
  });

  const handleOpenDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(e);
    setPalierCible(palierCibleProp ?? defaultPalierCible(trainingSession));
    setOpen(true);
  };

  const handleConfirm = async () => {
    if (!groupId) {
      toast.error("Sélectionnez un groupe.");
      return;
    }
    if (!dateSeance) {
      toast.error("Choisissez une date.");
      return;
    }

    setLoading(true);
    try {
      const { id, created } = await createOrOpenPilotSession({
        trainingSession,
        groupId,
        palierCible,
        dateSeance: new Date(dateSeance).toISOString(),
      });
      toast.success(
        created ? "Séance curriculum créée" : "Séance curriculum existante ouverte",
        { description: `${trainingSession.code} · palier cible ${palierCible}` },
      );
      setOpen(false);
      navigate(`/formateur/seances/${id}/pilote`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ouvrir le pilote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5 shrink-0", className)}
        onClick={handleOpenDialog}
      >
        <Rocket className="h-3.5 w-3.5" />
        Ouvrir le pilote
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Ouvrir le pilote · {trainingSession.code}</DialogTitle>
            <DialogDescription>
              {trainingSession.titre}
              <span className="block mt-1 text-xs">
                Palier parcours {trainingSession.palier} · n°{trainingSession.ordre} dans le plan
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Groupe</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un groupe…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nom} (niveau actuel élèves · {g.niveau})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Palier cible (variantes d&apos;exercices)</Label>
              <Select
                value={palierCible}
                onValueChange={(v) => setPalierCible(v as CurriculumPalier)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRICULUM_PALIERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                      {p === trainingSession.palier ? " (palier parcours)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Parcours cumulatif A2 → B1 → B2. Le palier cible choisit la difficulté des
                variantes, indépendamment du n° de séance ({trainingSession.code}).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Date et heure</Label>
              <Input
                type="datetime-local"
                value={dateSeance}
                onChange={(e) => setDateSeance(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ouvrir le pilote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CurriculumPilotButton;
