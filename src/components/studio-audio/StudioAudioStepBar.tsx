import { Check, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioStepId, StudioStepView } from "@/lib/studioAudioWorkflow";

type Props = {
  steps: StudioStepView[];
  activeStep: StudioStepId;
  onSelect: (stepId: StudioStepId) => void;
};

export function StudioAudioStepBar({ steps, activeStep, onSelect }: Props) {
  return (
    <nav aria-label="Étapes du Studio audio" className="w-full overflow-x-auto">
      <ol className="flex min-w-[640px] gap-1 md:min-w-0 md:flex-wrap">
        {steps.map((step) => {
          const isCurrent = step.id === activeStep;
          const blocked = step.status === "blocked";
          const done = step.status === "done";
          return (
            <li key={step.id} className="flex-1 min-w-[7rem]">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col gap-1 rounded-md border px-2 py-2 text-left text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isCurrent && "border-primary bg-primary/5",
                  done && !isCurrent && "border-emerald-500/40 bg-emerald-500/5",
                  blocked && "opacity-60 cursor-not-allowed",
                  !blocked && !isCurrent && "hover:bg-muted/60",
                )}
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={blocked}
                disabled={blocked}
                title={step.blockReason || step.label}
                onClick={() => {
                  if (!blocked) onSelect(step.id);
                }}
              >
                <span className="flex items-center gap-1 font-medium">
                  {blocked ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                  ) : done ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <Circle className={cn("h-3.5 w-3.5", isCurrent && "text-primary")} aria-hidden />
                  )}
                  <span>{step.id}. {step.label}</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {blocked ? "Bloquée" : done ? "Terminée" : isCurrent ? "En cours" : "Disponible"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
