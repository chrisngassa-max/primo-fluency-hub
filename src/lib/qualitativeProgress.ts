export type ProgressLevel =
  | "a_reprendre"
  | "en_cours"
  | "consolide"
  | "pret_niveau_superieur";

export type ProgressDescriptor = {
  level: ProgressLevel;
  label: string;
  shortLabel: string;
  message: string;
  className: string;
  borderClassName: string;
};

export function qualitativeProgress(score: number): ProgressDescriptor {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;

  if (safeScore >= 85) {
    return {
      level: "pret_niveau_superieur",
      label: "Prêt pour le niveau supérieur",
      shortLabel: "Prêt à avancer",
      message: "Tes acquis sont solides. Tu peux aborder une difficulté supérieure.",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      borderClassName: "border-emerald-500/40",
    };
  }
  if (safeScore >= 65) {
    return {
      level: "consolide",
      label: "Consolidé",
      shortLabel: "Consolidé",
      message: "Tu maîtrises l’essentiel. Continue à pratiquer pour stabiliser tes acquis.",
      className: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
      borderClassName: "border-green-500/40",
    };
  }
  if (safeScore >= 40) {
    return {
      level: "en_cours",
      label: "En cours d’acquisition",
      shortLabel: "En cours",
      message: "Tu progresses. Quelques points ont encore besoin d’entraînement.",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      borderClassName: "border-amber-500/40",
    };
  }
  return {
    level: "a_reprendre",
    label: "À reprendre",
    shortLabel: "À reprendre",
    message: "Reprends les explications et avance étape par étape. Chaque essai compte.",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
    borderClassName: "border-rose-500/40",
  };
}

export function attendanceLabel(rate: number | null) {
  if (rate == null) return "Pas encore mesurée";
  if (rate >= 85) return "Très régulière";
  if (rate >= 65) return "Régulière";
  return "À renforcer";
}
