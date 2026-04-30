/**
 * Badge "Élève en avance" — affichage strictement formateur.
 *
 * À ne JAMAIS rendre dans une page côté élève (`src/pages/eleve/...`).
 * Le tooltip explique les raisons du signal et propose une orientation
 * pédagogique : approfondissement / bonus.
 */
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdvancedSignal } from "@/lib/detectAdvancedStudent";

interface Props {
  signal?: AdvancedSignal | null;
  compact?: boolean;
}

export function AdvancedStudentBadge({ signal, compact }: Props) {
  if (!signal?.isAdvanced) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1 cursor-help"
          >
            <Sparkles className="h-3 w-3" />
            {compact ? "" : "En avance"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-semibold mb-1">Élève en avance</p>
          <ul className="text-xs space-y-0.5 list-disc list-inside">
            {signal.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <p className="text-xs mt-2 text-muted-foreground">
            💡 Proposer approfondissement ou exercices bonus.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
