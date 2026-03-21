import { Badge } from "@/components/ui/badge";

interface CompetencyGaugeProps {
  label: string;
  initialScore: number;
  currentScore: number;
  completedSessions: number;
  totalSessions: number;
}

const CompetencyGauge = ({
  label,
  initialScore,
  currentScore,
  completedSessions,
  totalSessions,
}: CompetencyGaugeProps) => {
  const progress = totalSessions > 0 ? completedSessions / totalSessions : 0;
  const expectedScore = initialScore + (80 - initialScore) * progress;

  const getStatus = () => {
    if (currentScore >= expectedScore + 5) return { label: "En avance", color: "bg-success text-success-foreground" };
    if (currentScore < expectedScore - 5) return { label: "À renforcer", color: "bg-destructive text-destructive-foreground" };
    return { label: "Dans les temps", color: "bg-primary text-primary-foreground" };
  };

  const status = getStatus();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge className={`${status.color} text-xs shrink-0`}>{status.label}</Badge>
      </div>

      {/* Gauge */}
      <div className="relative h-3 w-full rounded-full bg-muted">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(currentScore, 100)}%` }}
        />

        {/* Initial marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-muted-foreground/60 rounded-full"
          style={{ left: `${initialScore}%` }}
          title={`Initial : ${initialScore}%`}
        />

        {/* Expected marker (dashed target) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
          style={{
            left: `${Math.min(expectedScore, 100)}%`,
            background: "repeating-linear-gradient(to bottom, hsl(var(--warning)) 0px, hsl(var(--warning)) 2px, transparent 2px, transparent 4px)",
          }}
          title={`Objectif : ${Math.round(expectedScore)}%`}
        />
      </div>

      {/* Legend */}
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>▲ Initial ({initialScore}%)</span>
        <span>┆ Objectif ({Math.round(expectedScore)}%)</span>
        <span className="font-medium text-foreground">Actuel : {currentScore}%</span>
      </div>
    </div>
  );
};

export default CompetencyGauge;
