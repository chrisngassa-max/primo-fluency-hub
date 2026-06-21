export interface CompetencePerf {
  competence: string;
  avgScore: number;
  count: number;
}

export interface AdaptiveSlot {
  competence: string;
  count: number;
  difficultyLevel: number;
  adaptive: boolean;
}

/**
 * Convertit une moyenne de réussite (0-100) sur une compétence en un niveau de
 * difficulté calibré (échelle 0-10) pour la remédiation : plus l'élève a échoué,
 * plus on redescend la difficulté pour reconstruire les bases.
 */
export function difficultyForScore(avgScore: number): number {
  if (avgScore < 40) return 2;
  if (avgScore < 60) return 3;
  if (avgScore < 75) return 4;
  if (avgScore < 90) return 5;
  return 6;
}

/**
 * Construit le plan des exercices à générer pour une nouvelle séance.
 *
 * - Si des résultats de devoirs de la séance précédente existent (`perf`),
 *   on cible en priorité les compétences les plus faibles (tri croissant des
 *   scores moyens), avec une difficulté calibrée sur le score réel.
 * - Sinon, on retombe sur une répartition par défaut basée sur le niveau /
 *   les compétences cibles de la séance.
 */
export function buildAdaptiveExercisePlan(
  perf: CompetencePerf[],
  fallbackCompetences: string[],
  totalCount: number,
): AdaptiveSlot[] {
  const total = Math.max(1, Math.round(totalCount));

  const validPerf = perf.filter((p) => p.competence && p.count > 0);

  let comps: { competence: string; difficultyLevel: number; adaptive: boolean }[];

  if (validPerf.length > 0) {
    // Tri du plus faible au plus fort
    const sorted = [...validPerf].sort((a, b) => a.avgScore - b.avgScore);
    // On cible en priorité les compétences fragiles (< 80%)
    const weak = sorted.filter((p) => p.avgScore < 80);
    const selected = (weak.length > 0 ? weak : sorted).slice(0, total);
    comps = selected.map((p) => ({
      competence: p.competence,
      difficultyLevel: difficultyForScore(p.avgScore),
      adaptive: true,
    }));
  } else {
    const fallback = fallbackCompetences.length > 0 ? fallbackCompetences : ["CE"];
    comps = fallback.slice(0, total).map((competence) => ({
      competence,
      difficultyLevel: 3,
      adaptive: false,
    }));
  }

  if (comps.length === 0) {
    comps = [{ competence: "CE", difficultyLevel: 3, adaptive: false }];
  }

  // Répartition : chaque compétence retenue reçoit au moins 1 exercice
  // (comps.length <= total), le reliquat va aux premières (= les plus faibles
  // en mode adaptatif).
  const per = Math.max(1, Math.floor(total / comps.length));
  const remainder = total - per * comps.length;

  return comps.map((c, i) => ({
    ...c,
    count: per + (i < remainder ? 1 : 0),
  }));
}
