import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ReportProblemButtonProps {
  /** Type d'objet signalé */
  context: "exercice" | "devoir" | "bilan_test" | "bilan_seance" | "bilan_devoirs";
  exerciceId?: string | null;
  devoirId?: string | null;
  bilanTestId?: string | null;
  itemIndex?: number | null;
  /** Identifiant du formateur destinataire (optionnel mais recommandé) */
  formateurId?: string | null;
  /** Indique au parent que le signalement a été envoyé (pour neutraliser le score) */
  onReported?: () => void;
  className?: string;
}

export default function ReportProblemButton({
  context,
  exerciceId,
  devoirId,
  bilanTestId,
  itemIndex,
  formateurId,
  onReported,
  className,
}: ReportProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const captureScreen = async (): Promise<Blob | null> => {
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
      });
      return await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
      );
    } catch (e) {
      console.warn("Capture impossible:", e);
      return null;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const eleveId = auth.user?.id;
      if (!eleveId) {
        toast({ title: "Connexion requise", variant: "destructive" });
        return;
      }

      // 1) Capture
      const blob = await captureScreen();
      let screenshotPath: string | null = null;

      if (blob) {
        const path = `${eleveId}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("exercise-reports")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (!upErr) screenshotPath = path;
      }

      // 2) Insertion du signalement
      const { data: inserted, error } = await supabase
        .from("exercise_reports")
        .insert({
          eleve_id: eleveId,
          formateur_id: formateurId ?? null,
          exercice_id: exerciceId ?? null,
          devoir_id: devoirId ?? null,
          bilan_test_id: bilanTestId ?? null,
          context,
          item_index: itemIndex ?? null,
          comment: comment.trim() || null,
          screenshot_path: screenshotPath,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();

      if (error) throw error;

      // 3) Déclenche l'analyse IA en arrière-plan (non-bloquant)
      if (inserted?.id) {
        supabase.functions
          .invoke("analyze-report", { body: { reportId: inserted.id } })
          .catch((e) => console.warn("analyze-report failed:", e));
      }

      toast({
        title: "Signalement envoyé ✅",
        description:
          "Merci ! Cet exercice ne comptera pas dans ton bilan. Le formateur va vérifier.",
      });
      setOpen(false);
      setComment("");
      onReported?.();
    } catch (e: any) {
      toast({
        title: "Échec du signalement",
        description: e.message ?? "Réessaie dans un instant.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 ${className ?? ""}`}
        >
          <Flag className="h-4 w-4" />
          Signaler un problème
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signaler un problème</DialogTitle>
          <DialogDescription>
            Une capture d'écran sera envoyée automatiquement à ton formateur. Cet
            exercice <strong>ne comptera pas</strong> dans ton bilan.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Optionnel : décris brièvement le problème (audio inaudible, image manquante, mauvaise réponse…)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Envoyer le signalement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
