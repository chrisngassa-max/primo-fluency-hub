import { cn } from "@/lib/utils";

/** Returns color classes for difficulty level 0-10 */
export const getDifficultyColor = (level: number) => {
  if (level <= 2) return "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700";
  if (level <= 7) return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700";
  return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700";
};

/** Returns CECRL level label for difficulty range */
export const getDifficultyLabel = (level: number) => {
  if (level <= 2) return "A0";
  if (level <= 4) return "A1";
  if (level <= 6) return "A2";
  if (level <= 8) return "B1";
  return "B2";
};

/** Renders a compact difficulty badge */
export const DifficultyBadge = ({ level, className }: { level: number; className?: string }) => (
  <span className={cn(
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border whitespace-nowrap",
    getDifficultyColor(level),
    className
  )}>
    Niv. {level}
    <span className="opacity-60">· {getDifficultyLabel(level)}</span>
  </span>
);

/** Maps old 1-5 difficulty to 0-10 scale */
export const mapDifficultyToScale10 = (old: number): number => {
  // 1→2, 2→4, 3→6, 4→8, 5→10
  return Math.min(10, Math.max(0, old * 2));
};
