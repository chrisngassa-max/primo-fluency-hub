import { resultsSinceBaseline } from "@/lib/studentLevelBaseline";

export const ROUTER_COMPETENCES = ["CO", "CE", "EE", "EO", "Structures"] as const;

export type RouterCompetence = (typeof ROUTER_COMPETENCES)[number];
export type RouterProgression = "remediation" | "consolidation" | "approfondissement" | "demarrage";

export interface RouterResult {
  competence?: string | null;
  score: number;
  createdAt?: string | null;
}

export interface RouterProfile {
  niveau_baseline_at?: string | null;
  niveau_actuel?: string | null;
  niveau_co?: string | null;
  niveau_ce?: string | null;
  niveau_ee?: string | null;
  niveau_eo?: string | null;
  taux_reussite_co?: number | null;
  taux_reussite_ce?: number | null;
  taux_reussite_ee?: number | null;
  taux_reussite_eo?: number | null;
  taux_reussite_structures?: number | null;
  niveau_scolarisation?: string | null;
  aisance_numerique?: string | null;
  vitesse_lecture?: string | null;
  preferences_apprentissage?: string[] | null;
  besoins_accessibilite?: string[] | null;
}

export interface RouterStudent {
  id: string;
  name: string;
  profile?: RouterProfile | null;
  results?: RouterResult[];
}

export interface ExerciseRecommendation {
  id: string;
  eleveId: string;
  eleveName: string;
  competence: RouterCompetence;
  niveau: "A0" | "A1" | "A2" | "B1" | "B2";
  difficulte: number;
  count: number;
  progression: RouterProgression;
  aides: string[];
  motif: string;
  theme: string;
  scoreMoyen: number | null;
}

export interface ExerciseRouterContext {
  theme?: string | null;
  niveauCible?: string | null;
  competencesCibles?: string[] | null;
  defaultCount?: number;
}

const PROFILE_RATE_KEYS: Record<RouterCompetence, keyof RouterProfile> = {
  CO: "taux_reussite_co",
  CE: "taux_reussite_ce",
  EE: "taux_reussite_ee",
  EO: "taux_reussite_eo",
  Structures: "taux_reussite_structures",
};

function normalizeCompetence(value?: string | null): RouterCompetence | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized === "co" || normalized.includes("comprehension orale")) return "CO";
  if (normalized === "ce" || normalized.includes("comprehension ecrite") || normalized.includes("lecture")) return "CE";
  if (normalized === "ee" || normalized.includes("expression ecrite") || normalized.includes("production ecrite")) return "EE";
  if (normalized === "eo" || normalized.includes("expression orale") || normalized.includes("production orale")) return "EO";
  if (normalized.includes("structure") || normalized.includes("grammaire") || normalized.includes("syntaxe")) return "Structures";
  return null;
}

function normalizeLevel(value?: string | null): ExerciseRecommendation["niveau"] {
  const level = value?.toUpperCase().match(/\b(A0|A1|A2|B1|B2)\b/)?.[1];
  return (level as ExerciseRecommendation["niveau"] | undefined) ?? "A1";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function competenceScores(student: RouterStudent): Map<RouterCompetence, number> {
  const scores = new Map<RouterCompetence, number>();
  const baselineAt = student.profile?.niveau_baseline_at;
  const eligibleResults = resultsSinceBaseline(student.results ?? [], baselineAt);
  for (const competence of ROUTER_COMPETENCES) {
    const recent = eligibleResults
      .filter((result) => normalizeCompetence(result.competence) === competence)
      .slice(0, 5)
      .map((result) => Number(result.score))
      .filter(Number.isFinite);
    const resultAverage = average(recent);
    const profileRate = Number(student.profile?.[PROFILE_RATE_KEYS[competence]]);
    if (resultAverage !== null) scores.set(competence, resultAverage);
    else if (!baselineAt && Number.isFinite(profileRate)) scores.set(competence, Math.round(profileRate));
  }
  return scores;
}

function detectStagnation(student: RouterStudent, competence: RouterCompetence): boolean {
  const scores = resultsSinceBaseline(
    student.results ?? [],
    student.profile?.niveau_baseline_at,
  )
    .filter((result) => normalizeCompetence(result.competence) === competence)
    .slice(0, 3)
    .map((result) => Number(result.score))
    .filter(Number.isFinite);
  return scores.length === 3 && Math.max(...scores) - Math.min(...scores) <= 5;
}

function deriveAides(profile?: RouterProfile | null): string[] {
  const aides = new Set<string>();
  const schooling = profile?.niveau_scolarisation?.toLowerCase() ?? "";
  const digital = profile?.aisance_numerique?.toLowerCase() ?? "";
  const reading = profile?.vitesse_lecture?.toLowerCase() ?? "";

  if (schooling.includes("primaire") || schooling.includes("faible")) {
    aides.add("consigne courte");
    aides.add("exemple resolu");
  }
  if (digital.includes("faible") || digital.includes("debut")) aides.add("interaction simple");
  if (reading.includes("lent")) {
    aides.add("audio");
    aides.add("banque de mots");
  }
  for (const preference of profile?.preferences_apprentissage ?? []) {
    const normalized = preference.toLowerCase();
    if (normalized.includes("audio")) aides.add("audio");
    if (normalized.includes("image") || normalized.includes("visuel")) aides.add("support visuel");
    if (normalized.includes("exemple")) aides.add("exemple resolu");
  }
  for (const need of profile?.besoins_accessibilite ?? []) {
    if (need.trim()) aides.add(need.trim());
  }
  return [...aides].slice(0, 4);
}

function chooseCompetence(
  scores: Map<RouterCompetence, number>,
  targets: RouterCompetence[],
): { competence: RouterCompetence; score: number | null } {
  const entries = [...scores.entries()];
  if (entries.length > 0) {
    const weakest = entries.sort((a, b) => a[1] - b[1])[0];
    return { competence: weakest[0], score: weakest[1] };
  }
  return { competence: targets[0] ?? "CE", score: null };
}

export function routeExercises(
  students: RouterStudent[],
  context: ExerciseRouterContext = {},
): ExerciseRecommendation[] {
  const targets = (context.competencesCibles ?? [])
    .map(normalizeCompetence)
    .filter((value): value is RouterCompetence => value !== null);
  const theme = context.theme?.trim() || "Objectifs de la seance";

  return students.map((student) => {
    const scores = competenceScores(student);
    const { competence, score } = chooseCompetence(scores, targets);
    const stagnates = detectStagnation(student, competence);
    let progression: RouterProgression = "demarrage";
    let difficulte = 4;

    if (score !== null && score < 60) {
      progression = "remediation";
      difficulte = score < 40 ? 2 : 3;
    } else if (score !== null && score < 80) {
      progression = "consolidation";
      difficulte = 5;
    } else if (score !== null) {
      progression = "approfondissement";
      difficulte = 7;
    }
    if (stagnates) difficulte = clamp(difficulte - 1, 1, 10);

    const reason =
      score === null
        ? `aucun resultat recent exploitable ; demarrage prudent sur ${competence}`
        : `moyenne recente de ${score}% en ${competence}`;
    const stagnationReason = stagnates ? ", avec trois resultats proches sans progression nette" : "";

    return {
      id: `${student.id}-${competence}`,
      eleveId: student.id,
      eleveName: student.name,
      competence,
      niveau: normalizeLevel((
        competence === "CO" ? student.profile?.niveau_co
          : competence === "CE" ? student.profile?.niveau_ce
            : competence === "EE" ? student.profile?.niveau_ee
              : competence === "EO" ? student.profile?.niveau_eo
                : student.profile?.niveau_actuel
      ) ?? student.profile?.niveau_actuel ?? context.niveauCible),
      difficulte,
      count: clamp(Math.round(context.defaultCount ?? 2), 1, 30),
      progression,
      aides: deriveAides(student.profile),
      motif: `Propose parce que ${reason}${stagnationReason}.`,
      theme,
      scoreMoyen: score,
    };
  });
}
