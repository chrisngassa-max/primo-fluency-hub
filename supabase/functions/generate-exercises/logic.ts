export function buildFocusPrompt(competence: string, focusPedagogique: string | null): string {
  if (competence === "Structures" && focusPedagogique === "grammaire") {
    return "\nFOCUS OBLIGATOIRE : GRAMMAIRE. Travaille exclusivement la conjugaison, les accords, les pronoms, la negation ou les prepositions en contexte.";
  }
  if (competence === "Structures" && focusPedagogique === "vocabulaire") {
    return "\nFOCUS OBLIGATOIRE : VOCABULAIRE. Travaille exclusivement le lexique utile, les definitions, associations, synonymes, antonymes et categories lexicales en contexte.";
  }
  return "";
}

export function parseTargetDurationMinutes(value: unknown): number {
  if (value === null || value === undefined || value === "") return 12;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(60, Math.max(1, Math.round(parsed)));
}

export function buildDurationPrompt(targetDurationMinutes: number): string {
  const seconds = targetDurationMinutes * 60;
  return `DUREE CIBLE PAR EXERCICE : ${targetDurationMinutes} minute(s).
Adapte le nombre d'items et la longueur des productions a cette duree.
Le champ metadata.time_limit_seconds DOIT etre fixe a ${seconds}.`;
}
