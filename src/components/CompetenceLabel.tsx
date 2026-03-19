import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const COMP_FULL_LABELS: Record<string, string> = {
  CO: "CO : Compréhension Orale",
  CE: "CE : Compréhension Écrite",
  EE: "EE : Expression Écrite",
  EO: "EO : Expression Orale",
  Structures: "Structures : Grammaire et Vocabulaire",
};

interface CompetenceLabelProps {
  code: string;
  className?: string;
  showFull?: boolean;
}

/**
 * Wraps a competency acronym with a tooltip showing the full name.
 * Use `showFull` to always display the full label instead of just the code.
 */
const CompetenceLabel = ({ code, className, showFull }: CompetenceLabelProps) => {
  const fullLabel = COMP_FULL_LABELS[code] || code;

  if (showFull) {
    return <span className={className}>{fullLabel}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className} tabIndex={0} role="term" aria-label={fullLabel}>
          {code}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">{fullLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default CompetenceLabel;
