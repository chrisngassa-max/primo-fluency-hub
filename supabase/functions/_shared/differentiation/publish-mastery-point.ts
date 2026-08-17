/**
 * Sélection déterministe d'un point de maîtrise générique CO pour un niveau cible.
 *
 * Ce rattachement sert de garde-fou de publication (compétence CO + couverture niveau).
 * Il ne choisit pas le thème pédagogique le plus précis pour la source.
 */
export const STUDIO_AUDIO_B2_MASTERY_POINT_ID = "c1000000-0000-0000-0000-000000000031";
export const STUDIO_AUDIO_B2_MASTERY_POINT_NOM =
  "Comprendre et interpréter des points de vue argumentés";

const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export interface CoMasteryPointCandidate {
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

/** @deprecated Prefer CoMasteryPointCandidate. */
export type CoA2MasteryPointCandidate = CoMasteryPointCandidate;

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

export function isCoLevelCompatibleMasteryPoint(
  point: CoMasteryPointCandidate,
  targetLevel: string,
): boolean {
  const competence = point.sous_sections?.epreuves?.competence;
  if (competence !== "CO") return false;

  const minRank = levelRank(point.niveau_min);
  const maxRank = levelRank(point.niveau_max);
  const targetRank = levelRank(targetLevel);

  if (minRank === null || maxRank === null || targetRank === null) return false;
  return minRank <= targetRank && targetRank <= maxRank;
}

/** @deprecated Prefer isCoLevelCompatibleMasteryPoint(point, "A2"). */
export function isCoA2CompatibleMasteryPoint(point: CoMasteryPointCandidate): boolean {
  return isCoLevelCompatibleMasteryPoint(point, "A2");
}

function coverageWidth(point: CoMasteryPointCandidate): number {
  const minRank = levelRank(point.niveau_min);
  const maxRank = levelRank(point.niveau_max);
  if (minRank === null || maxRank === null) return Number.MAX_SAFE_INTEGER;
  return maxRank - minRank;
}

function isExactLevelMatch(point: CoMasteryPointCandidate, targetLevel: string): boolean {
  const min = (point.niveau_min ?? "").trim().toUpperCase();
  const max = (point.niveau_max ?? "").trim().toUpperCase();
  const target = targetLevel.trim().toUpperCase();
  return min === target && max === target;
}

/**
 * Politique documentée :
 * 1) points CO dont l'intervalle couvre exactement le niveau cible ;
 * 2) parmi eux, match exact (min=max=cible) prioritaire ;
 * 3) sinon intervalle couvrant le plus étroit ;
 * 4) tri déterministe (épreuve/sous-section/ordre/id) ;
 * 5) aucun point compatible → null (erreur métier claire côté publish).
 * Jamais de fallback sur une autre compétence ou un niveau non couvrant.
 */
export function pickDeterministicCoMasteryPoint(
  points: CoMasteryPointCandidate[],
  targetLevel: string,
): CoMasteryPointCandidate | null {
  const compatible = points.filter((point) => isCoLevelCompatibleMasteryPoint(point, targetLevel));
  if (compatible.length === 0) return null;

  return compatible.sort((left, right) => {
    const leftExact = isExactLevelMatch(left, targetLevel) ? 0 : 1;
    const rightExact = isExactLevelMatch(right, targetLevel) ? 0 : 1;
    if (leftExact !== rightExact) return leftExact - rightExact;

    const leftWidth = coverageWidth(left);
    const rightWidth = coverageWidth(right);
    if (leftWidth !== rightWidth) return leftWidth - rightWidth;

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

/** @deprecated Prefer pickDeterministicCoMasteryPoint(points, "A2"). */
export function pickDeterministicCoA2MasteryPoint(
  points: CoMasteryPointCandidate[],
): CoMasteryPointCandidate | null {
  return pickDeterministicCoMasteryPoint(points, "A2");
}
