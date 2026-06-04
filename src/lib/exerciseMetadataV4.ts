export const EXERCISE_THEMES_V4 = [
  "logement",
  "sante",
  "travail",
  "transport",
  "banque",
  "prefecture",
  "ecole",
  "vie_citoyenne",
] as const;

export const NIVEAUX_GUIDAGE_V4 = ["guide", "semi_guide", "autonome"] as const;

export const OUTILS_AIDE_V4 = [
  "lexique",
  "modele_phrase",
  "audio_support",
  "photo",
  "criteres_reussite",
  "transcription",
] as const;

export const AUTONOMIES_REQUISES_V4 = ["faible", "moyenne", "forte"] as const;

export type ExerciseThemeV4 = typeof EXERCISE_THEMES_V4[number];
export type NiveauGuidageV4 = typeof NIVEAUX_GUIDAGE_V4[number];
export type OutilAideV4 = typeof OUTILS_AIDE_V4[number];
export type AutonomieRequiseV4 = typeof AUTONOMIES_REQUISES_V4[number];

export interface ExerciseMetadataV4 {
  theme: ExerciseThemeV4 | null;
  sous_competence: string | null;
  niveau_guidage: NiveauGuidageV4 | null;
  outils_aide: OutilAideV4[];
  duree_estimee_min: number | null;
  autonomie_requise: AutonomieRequiseV4 | null;
  objectif_tcf: string | null;
  regle_montee_auto: boolean;
}

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  const normalized = normalizeToken(value);
  return allowed.find((item) => item === normalized) ?? null;
}

function normalizeOutils(value: unknown): OutilAideV4[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(
    source
      .map((item) => oneOf(item, OUTILS_AIDE_V4))
      .filter((item): item is OutilAideV4 => item != null)
  ));
}

function normalizeDuration(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(180, Math.round(n)));
}

export interface ExerciseMetadataSource {
  theme?: unknown;
  sous_competence?: unknown;
  niveau_guidage?: unknown;
  outils_aide?: unknown;
  duree_estimee_min?: unknown;
  autonomie_requise?: unknown;
  objectif_tcf?: unknown;
  regle_montee_auto?: unknown;
}

export function buildExerciseMetadataV4(source: ExerciseMetadataSource): ExerciseMetadataV4 {
  return {
    theme: oneOf(source.theme, EXERCISE_THEMES_V4),
    sous_competence: typeof source.sous_competence === "string" && source.sous_competence.trim()
      ? source.sous_competence.trim()
      : null,
    niveau_guidage: oneOf(source.niveau_guidage, NIVEAUX_GUIDAGE_V4),
    outils_aide: normalizeOutils(source.outils_aide),
    duree_estimee_min: normalizeDuration(source.duree_estimee_min),
    autonomie_requise: oneOf(source.autonomie_requise, AUTONOMIES_REQUISES_V4),
    objectif_tcf: typeof source.objectif_tcf === "string" && source.objectif_tcf.trim()
      ? normalizeToken(source.objectif_tcf)
      : null,
    regle_montee_auto: source.regle_montee_auto === true,
  };
}
