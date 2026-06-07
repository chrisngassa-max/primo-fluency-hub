export type CompetenceTCF = "CO" | "CE" | "EE" | "EO";
export type NiveauCECRL = "A0" | "A1" | "A2" | "B1" | "B2";

export type TypeErreurDominant =
  | "linguistique"
  | "phonetique"
  | "socioculturel"
  | "discursif"
  | "strategique";

export type SeancesConsecutivesSous60 = Record<CompetenceTCF, number>;

export interface StudentProfileV4 {
  id: string | null;
  apprenant_id: string;
  score_co: number;
  score_ce: number;
  score_ee: number;
  score_eo: number;
  niveau_co: NiveauCECRL;
  niveau_ce: NiveauCECRL;
  niveau_ee: NiveauCECRL;
  niveau_eo: NiveauCECRL;
  fragilite_principale: CompetenceTCF;
  type_erreur_dominant: TypeErreurDominant | null;
  langue_maternelle: string | null;
  niveau_scolarisation: string | null;
  objectif_personnel: string | null;
  style_apprentissage: string | null;
  seances_consecutives_sous_60: SeancesConsecutivesSous60;
  dernier_score_phase2_ce: number | null;
  dernier_score_phase2_co: number | null;
  montee_auto_phase2: boolean;
  updated_at: string | null;
}

export interface ProfilEleveV4Source {
  id?: string | null;
  eleve_id: string;
  taux_reussite_co?: number | string | null;
  taux_reussite_ce?: number | string | null;
  taux_reussite_ee?: number | string | null;
  taux_reussite_eo?: number | string | null;
  niveau_co?: string | null;
  niveau_ce?: string | null;
  niveau_ee?: string | null;
  niveau_eo?: string | null;
  fragilite_principale?: string | null;
  type_erreur_dominant?: string | null;
  priorites_pedagogiques?: unknown;
  seances_consecutives_sous_60?: unknown;
  dernier_score_phase2_ce?: number | string | null;
  dernier_score_phase2_co?: number | string | null;
  montee_auto_phase2?: boolean | null;
  updated_at?: string | null;
}

export const COMPETENCES_TCF: CompetenceTCF[] = ["CO", "CE", "EE", "EO"];

const TYPE_ERREUR_VALUES = new Set<TypeErreurDominant>([
  "linguistique",
  "phonetique",
  "socioculturel",
  "discursif",
  "strategique",
]);

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

export function deriveCecrlLevel(score: number): NiveauCECRL {
  if (score < 40) return "A0";
  if (score < 60) return "A1";
  if (score < 70) return "A2";
  if (score < 80) return "B1";
  return "B2";
}

export function normalizeCecrlLevel(value: unknown, score: number): NiveauCECRL {
  if (value === "A0" || value === "A1" || value === "A2" || value === "B1" || value === "B2") {
    return value;
  }
  return deriveCecrlLevel(score);
}

export function deriveFragilitePrincipale(scores: Record<CompetenceTCF, number>): CompetenceTCF {
  return COMPETENCES_TCF.reduce((lowest, competence) =>
    scores[competence] < scores[lowest] ? competence : lowest
  , "CO");
}

function normalizeTypeErreur(value: unknown): TypeErreurDominant | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return TYPE_ERREUR_VALUES.has(normalized as TypeErreurDominant)
    ? normalized as TypeErreurDominant
    : null;
}

function normalizeSous60(value: unknown): SeancesConsecutivesSous60 {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    CO: Math.max(0, Math.trunc(Number(source.CO ?? source.co ?? 0)) || 0),
    CE: Math.max(0, Math.trunc(Number(source.CE ?? source.ce ?? 0)) || 0),
    EE: Math.max(0, Math.trunc(Number(source.EE ?? source.ee ?? 0)) || 0),
    EO: Math.max(0, Math.trunc(Number(source.EO ?? source.eo ?? 0)) || 0),
  };
}

function priorityValue(priorities: unknown, keys: string[]): string | null {
  if (!priorities || typeof priorities !== "object" || Array.isArray(priorities)) return null;
  for (const [key, value] of Object.entries(priorities as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (!keys.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate))) continue;
    if (value == null || value === false) return null;
    return String(value);
  }
  return null;
}

export function buildStudentProfileV4(profil: ProfilEleveV4Source): StudentProfileV4 {
  const score_co = asNumber(profil.taux_reussite_co);
  const score_ce = asNumber(profil.taux_reussite_ce);
  const score_ee = asNumber(profil.taux_reussite_ee);
  const score_eo = asNumber(profil.taux_reussite_eo);
  const scores = { CO: score_co, CE: score_ce, EE: score_ee, EO: score_eo };
  const derivedFragilite = deriveFragilitePrincipale(scores);

  return {
    id: profil.id ?? null,
    apprenant_id: profil.eleve_id,
    score_co,
    score_ce,
    score_ee,
    score_eo,
    niveau_co: normalizeCecrlLevel(profil.niveau_co, score_co),
    niveau_ce: normalizeCecrlLevel(profil.niveau_ce, score_ce),
    niveau_ee: normalizeCecrlLevel(profil.niveau_ee, score_ee),
    niveau_eo: normalizeCecrlLevel(profil.niveau_eo, score_eo),
    fragilite_principale: derivedFragilite,
    type_erreur_dominant: normalizeTypeErreur(profil.type_erreur_dominant),
    langue_maternelle: priorityValue(profil.priorites_pedagogiques, ["langue_maternelle", "l1"]),
    niveau_scolarisation: priorityValue(profil.priorites_pedagogiques, ["niveau_scolarisation", "scolarisation"]),
    objectif_personnel: priorityValue(profil.priorites_pedagogiques, ["objectif_personnel", "objectif"]),
    style_apprentissage: priorityValue(profil.priorites_pedagogiques, ["style_apprentissage", "style"]),
    seances_consecutives_sous_60: normalizeSous60(profil.seances_consecutives_sous_60),
    dernier_score_phase2_ce: asNullableNumber(profil.dernier_score_phase2_ce),
    dernier_score_phase2_co: asNullableNumber(profil.dernier_score_phase2_co),
    montee_auto_phase2: profil.montee_auto_phase2 === true,
    updated_at: profil.updated_at ?? null,
  };
}
