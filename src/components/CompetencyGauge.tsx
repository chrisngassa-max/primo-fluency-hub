import { Badge } from "@/components/ui/badge";
import { qualitativeProgress } from "@/lib/qualitativeProgress";

function scoreToCECRL(score: number): string {
  if (score >= 80) return "B1";
  if (score >= 60) return "A2";
  if (score >= 35) return "A1";
  return "A0";
}

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
  const acquisition = qualitativeProgress(currentScore);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Badge className={`${status.color} text-xs shrink-0`}>{status.label}</Badge>
      </div>

      <div className={`rounded-md border p-3 ${acquisition.borderClassName}`}>
        <div className="flex items-center justify-between gap-3">
          <Badge className={acquisition.className}>{acquisition.label}</Badge>
          <span className="text-xs font-semibold text-primary">{scoreToCECRL(currentScore)}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{acquisition.message}</p>
      </div>
    </div>
  );
};

export default CompetencyGauge;
