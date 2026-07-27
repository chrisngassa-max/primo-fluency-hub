// Lot 1 (correctif) — compare toutes les combinaisons compétence x niveau x
// format réellement présentes dans le corpus S01-v3 figé (Lot 0) aux
// `allowed_formats` déclarés par les vingt contrats de différenciation.
//
// Fonction pure (aucun accès disque) pour rester testable avec des fixtures
// mutées, sur le modèle de s01-snapshot-diff.mjs.

export function findFormatCompatibilityMismatches(baselineExercises, levelContracts) {
  const seen = new Map(); // "competence|niveau|format" -> occurrences
  for (const entry of Object.values(baselineExercises)) {
    const key = `${entry.competence}|${entry.niveau_vise}|${entry.format}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  const mismatches = [];
  for (const [key, count] of seen) {
    const [competence, level, format] = key.split("|");
    const contract = levelContracts.contracts[competence]?.[level];
    if (!contract) {
      mismatches.push({ competence, level, format, count, reason: "no_contract" });
      continue;
    }
    if (!contract.allowed_formats.includes(format)) {
      mismatches.push({
        competence,
        level,
        format,
        count,
        reason: "not_in_allowed_formats",
        allowed_formats: contract.allowed_formats,
      });
    }
  }

  return mismatches.sort((a, b) =>
    a.competence.localeCompare(b.competence) || a.level.localeCompare(b.level) || a.format.localeCompare(b.format),
  );
}
