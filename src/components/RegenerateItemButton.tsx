import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface RegenerateItemButtonProps {
  competence: string;
  format: string;
  niveau: string;
  consigne?: string;
  currentItem: {
    question?: string;
    options?: string[];
    bonne_reponse?: string;
    explication?: string;
    texte_support?: string;
    script_audio?: string;
  };
  currentSupport?: { texte_support?: string; script_audio?: string };
  /** Callback when a new valid item is returned */
  onRegenerated: (newItem: {
    question: string;
    options?: string[];
    bonne_reponse: string;
    explication?: string;
    texte_support?: string;
    script_audio?: string;
  }) => void;
  /** Fallback when regeneration fails (after retry) — typically neutralize */
  onFallback?: () => void;
  /** For traceability: log signalement */
  reportContext?: {
    context: "exercice" | "devoir" | "bilan_test" | "bilan_seance" | "bilan_devoirs";
    exerciceId?: string | null;
    devoirId?: string | null;
    bilanTestId?: string | null;
    itemIndex?: number | null;
    formateurId?: string | null;
  };
  className?: string;
  size?: "sm" | "default" | "lg";
}

export default function RegenerateItemButton({
  competence,
  format,
  niveau,
  consigne,
  currentItem,
  currentSupport,
  onRegenerated,
  onFallback,
  reportContext,
  className,
  size = "sm",
}: RegenerateItemButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-exercise-item", {
        body: {
          competence,
          format,
          niveau,
          consigne,
          current_item: currentItem,
          current_support: currentSupport,
          reason: "Élève a signalé un problème sur cette question",
        },
      });

      // Best-effort report log (non-blocking)
      if (reportContext) {
        try {
          const { data: auth } = await supabase.auth.getUser();
          const eleveId = auth.user?.id;
          if (eleveId) {
            await supabase.from("exercise_reports").insert({
              eleve_id: eleveId,
              formateur_id: reportContext.formateurId ?? null,
              exercice_id: reportContext.exerciceId ?? null,
              devoir_id: reportContext.devoirId ?? null,
              bilan_test_id: reportContext.bilanTestId ?? null,
              context: reportContext.context,
              item_index: reportContext.itemIndex ?? null,
              comment: error
                ? "Régénération demandée — ÉCHEC"
                : "Régénération demandée — succès (item remplacé)",
              page_url: window.location.href,
              user_agent: navigator.userAgent,
            });
          }
        } catch { /* ignore */ }
      }

      if (error || !data?.item) {
        // Failed → fallback
        toast({
          title: "Question impossible à régénérer",
          description: "Cette question est neutralisée et ne comptera pas.",
          variant: "destructive",
        });
        onFallback?.();
        return;
      }

      onRegenerated(data.item);
      toast({
        title: "Question régénérée ✨",
        description: "Une nouvelle version équivalente t'est proposée.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur de régénération",
        description: e.message ?? "Cette question est neutralisée.",
        variant: "destructive",
      });
      onFallback?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={`gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700/60 dark:hover:bg-amber-950/30 ${className ?? ""}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {loading ? "Régénération…" : "Régénérer cette question"}
    </Button>
  );
}
