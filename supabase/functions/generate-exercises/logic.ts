export function buildFocusPrompt(competence: string, focusPedagogique: string | null): string {
  if (competence === "Structures" && focusPedagogique === "grammaire") {
    return "\nFOCUS OBLIGATOIRE : GRAMMAIRE. Travaille exclusivement la conjugaison, les accords, les pronoms, la negation ou les prepositions en contexte.";
  }
  if (competence === "Structures" && focusPedagogique === "vocabulaire") {
    return "\nFOCUS OBLIGATOIRE : VOCABULAIRE. Travaille exclusivement le lexique utile, les definitions, associations, synonymes, antonymes et categories lexicales en contexte.";
  }
  return "";
}
