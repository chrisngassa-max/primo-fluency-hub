/**
 * Sélection déterministe d'un point de maîtrise générique CO/A2.
 *
 * Ce rattachement sert de garde-fou de publication (compétence CO + couverture A2).
 * Il ne choisit pas le thème pédagogique le plus précis pour la source.
 */
const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export interface CoA2MasteryPointCandidate {
  id: string;
  ordre?: number | null;
  niveau_min?: string | null;
  niveau_max?: string | null;
  sous_sections?: {
    ordre?: number | null;
    epreuves?: {
      competence?: string | null;
      ordre?: number | null;
    } | null;
  } | null;
}

function normalizeLevelToken(level: string): string {
  return level.trim().replace(/\s+/g, "-");
}

/** Rang CECRL ; `Pré-A1`/`Pre-A1` est strictement inférieur à A0. Inconnu => null. */
export function levelRank(level: string | null | undefined): number | null {
  if (!level) return null;
  const normalized = normalizeLevelToken(level);
  if (/^pré-?a1$/i.test(normalized) || /^pre-?a1$/i.test(normalized)) {
    return -1;
  }
  const index = LEVEL_ORDER.indexOf(
    normalized.toUpperCase() as (typeof LEVEL_ORDER)[number],
  );
  return index >= 0 ? index : null;
}

export function isCoA2CompatibleMasteryPoint(point: CoA2MasteryPointCandidate): boolean {
  const competence = point.sous_sections?.epreuves?.competence;
  if (competence !== "CO") return false;

  const minRank = levelRank(point.niveau_min);
  const maxRank = levelRank(point.niveau_max);
  const targetRank = levelRank("A2");

  if (minRank === null || maxRank === null || targetRank === null) return false;
  return minRank <= targetRank && targetRank <= maxRank;
}

export function pickDeterministicCoA2MasteryPoint(
  points: CoA2MasteryPointCandidate[],
): CoA2MasteryPointCandidate | null {
  const compatible = points.filter(isCoA2CompatibleMasteryPoint);
  if (compatible.length === 0) return null;

  return compatible.sort((left, right) => {
    const leftKey = [
      left.sous_sections?.epreuves?.ordre ?? Number.MAX_SAFE_INTEGER,
      left.sous_sections?.ordre ?? Number.MAX_SAFE_INTEGER,
      left.ordre ?? Number.MAX_SAFE_INTEGER,
      left.id,
    ];
    const rightKey = [
      right.sous_sections?.epreuves?.ordre ?? Number.MAX_SAFE_INTEGER,
      right.sous_sections?.ordre ?? Number.MAX_SAFE_INTEGER,
      right.ordre ?? Number.MAX_SAFE_INTEGER,
      right.id,
    ];

    for (let index = 0; index < leftKey.length; index += 1) {
      if (leftKey[index] < rightKey[index]) return -1;
      if (leftKey[index] > rightKey[index]) return 1;
    }
    return 0;
  })[0];
}
