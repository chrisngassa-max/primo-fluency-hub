import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CurriculumBadgeProps {
  sessionCode?: string | null;
  className?: string;
}

export function CurriculumBadge({ sessionCode, className }: CurriculumBadgeProps) {
  return (
    <Badge
      className={cn(
        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        className,
      )}
    >
      Curriculum v2{sessionCode ? ` · ${sessionCode}` : ""}
    </Badge>
  );
}

export default CurriculumBadge;
