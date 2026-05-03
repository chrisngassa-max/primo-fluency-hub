export type ExerciseVariantLevel = "bas" | "standard" | "haut";
export type ScaffoldingLevel = "fort" | "moyen" | "faible";
export type CompetenceKey = "CO" | "CE" | "EE" | "EO" | "Structures";

export interface StudentProfileSignals {
  niveau_actuel?: string | null;
  taux_reussite_co?: number | string | null;
  taux_reussite_ce?: number | string | null;
  taux_reussite_ee?: number | string | null;
  taux_reussite_eo?: number | string | null;
  taux_reussite_structures?: number | string | null;
  priorites_pedagogiques?: unknown;
  vitesse_lecture?: "lente" | "fluide" | null;
}

export interface StudentOutcomeSignals {
  objectif_status?: string | null;
  besoin_pedagogique?: string | null;
}

export interface PedagogicalDirectives {
  niveau_variante: ExerciseVariantLevel;
  niveau_etayage: ScaffoldingLevel;
  competence_blocage: CompetenceKey | null;
  competence_cible: CompetenceKey | null;
  besoin_pedagogique: string;
  vitesse_lecture: "lente" | "fluide" | "inconnue";
  formats_autorises: string[];
  formats_interdits: string[];
  supports_obligatoires: string[];
  longueur_max_consigne_mots: number;
  nombre_items_max: number;
  feedback_type: "phonologique" | "structurel" | "encourageant";
  strategie: string;
  regle_descente: string | null;
}

interface BuildInput {
  profile?: StudentProfileSignals | null;
  outcome?: StudentOutcomeSignals | null;
  progression?: string | null;
  weakCompetences?: string[] | null;
  targetCompetence?: string | null;
}

const COMPETENCE_FIELDS: Record<CompetenceKey, keyof StudentProfileSignals> = {
  CO: "taux_reussite_co",
  CE: "taux_reussite_ce",
  EE: "taux_reussite_ee",
  EO: "taux_reussite_eo",
  Structures: "taux_reussite_structures",
};

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCompetence(value?: string | null): CompetenceKey | null {
  if (!value) return null;
  const raw = value.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (raw === "co") return "CO";
  if (raw === "ce") return "CE";
  if (raw === "ee") return "EE";
  if (raw === "eo") return "EO";
  if (raw.includes("structure") || raw.includes("grammaire") || raw.includes("syntaxe")) return "Structures";
  if (raw.includes("expression ecrite") || raw.includes("production_ecrite") || raw.includes("production ecrite")) return "EE";
  if (raw.includes("comprehension ecrite") || raw.includes("lecture") || raw.includes("written comprehension")) return "CE";
  if (raw.includes("expression orale") || raw.includes("production_orale") || raw.includes("production orale")) return "EO";
  if (raw.includes("comprehension orale") || raw.includes("oral comprehension")) return "CO";
  const upper = value.toString().trim() as CompetenceKey;
  return upper in COMPETENCE_FIELDS ? upper : null;
}

function prioritiesToArray(priorities: unknown): string[] {
  if (Array.isArray(priorities)) return priorities.map((p) => String(p).toLowerCase());
  if (priorities && typeof priorities === "object") {
    return Object.entries(priorities as Record<string, unknown>)
      .filter(([, value]) => value !== false && value != null)
      .map(([key, value]) => `${key}:${String(value)}`.toLowerCase());
  }
  return [];
}

function deriveVariantLevel(
  profile?: StudentProfileSignals | null,
  outcome?: StudentOutcomeSignals | null,
  progression?: string | null,
): ExerciseVariantLevel {
  if (outcome?.objectif_status === "non_atteint") return "bas";
  if (outcome?.objectif_status === "au_dela") return "haut";

  if (outcome?.besoin_pedagogique === "rattrapage" || outcome?.besoin_pedagogique === "remediation") return "bas";
  if (outcome?.besoin_pedagogique === "approfondissement") return "haut";

  if (progression === "remediation") return "bas";
  if (progression === "augmente") return "haut";

  const priorities = prioritiesToArray(profile?.priorites_pedagogiques);
  if (priorities.some((p) => p.includes("eleve_en_avance") || p.includes("approfondissement"))) return "haut";
  if (priorities.some((p) => p.includes("soutien") || p.includes("remediation") || p.includes("rattrapage"))) return "bas";

  return "standard";
}

function variantToScaffolding(level: ExerciseVariantLevel): ScaffoldingLevel {
  if (level === "bas") return "fort";
  if (level === "haut") return "faible";
  return "moyen";
}

function deriveReadingSpeed(profile?: StudentProfileSignals | null): "lente" | "fluide" | "inconnue" {
  if (profile?.vitesse_lecture === "lente" || profile?.vitesse_lecture === "fluide") {
    return profile.vitesse_lecture;
  }
  const priorities = prioritiesToArray(profile?.priorites_pedagogiques);
  if (priorities.some((p) => p.includes("vitesse_lecture_lente") || p.includes("lecture_lente"))) return "lente";
  if (priorities.some((p) => p.includes("vitesse_lecture_fluide") || p.includes("lecture_fluide"))) return "fluide";
  return "inconnue";
}

function deriveBlockingCompetence(
  profile?: StudentProfileSignals | null,
  weakCompetences?: string[] | null,
  targetCompetence?: string | null,
): CompetenceKey | null {
  const scored = (Object.entries(COMPETENCE_FIELDS) as [CompetenceKey, keyof StudentProfileSignals][])
    .map(([competence, field]) => ({ competence, score: asNumber(profile?.[field]) }))
    .filter((item): item is { competence: CompetenceKey; score: number } => item.score != null)
    .sort((a, b) => a.score - b.score);

  const hardBlock = scored.find((item) => item.score < 50);
  if (hardBlock) return hardBlock.competence;

  const weakFromRecent = (weakCompetences ?? [])
    .map((c) => normalizeCompetence(c))
    .find((c): c is CompetenceKey => c != null);
  if (weakFromRecent) return weakFromRecent;

  return normalizeCompetence(targetCompetence);
}

function buildStrategy(
  blocage: CompetenceKey | null,
  cible: CompetenceKey | null,
  etayage: ScaffoldingLevel,
  besoin: string,
): string {
  if (besoin === "rattrapage" || besoin === "remediation") {
    return `Remediation ciblee: travailler ${cible ?? blocage ?? "la competence faible"} avec etayage ${etayage}, sans reproduire la question ratee.`;
  }
  if (besoin === "consolidation") {
    return `Consolidation spiralaire: reprendre ${cible ?? blocage ?? "la competence cible"} sous un format different, avec une reussite securisee.`;
  }
  if (besoin === "approfondissement") {
    return `Approfondissement mesure: transferer vers une situation IRN proche sans augmenter brutalement la charge de lecture.`;
  }
  return `Adaptation standard: viser ${cible ?? blocage ?? "le point de cours"} avec contraintes A0/A1 explicites.`;
}

export function buildPedagogicalDirectives(input: BuildInput): PedagogicalDirectives {
  const { profile, outcome, progression, weakCompetences, targetCompetence } = input;
  const niveau_variante = deriveVariantLevel(profile, outcome, progression);
  const niveau_etayage = variantToScaffolding(niveau_variante);
  const vitesse_lecture = deriveReadingSpeed(profile);
  const competence_blocage = deriveBlockingCompetence(profile, weakCompetences, targetCompetence);

  const eeScore = asNumber(profile?.taux_reussite_ee);
  const structuresScore = asNumber(profile?.taux_reussite_structures);
  const shouldDescendFromWriting = (eeScore != null && eeScore < 50) || competence_blocage === "EE";
  const structuresWeak = structuresScore == null || structuresScore < 60;
  const competence_cible: CompetenceKey | null = shouldDescendFromWriting && structuresWeak
    ? "Structures"
    : competence_blocage;

  const regle_descente = shouldDescendFromWriting && structuresWeak
    ? "EE faible: ne pas demander de redaction libre. Redescendre vers Structures, lexique en contexte, banque de mots ou texte lacunaire."
    : null;

  const supports_obligatoires = niveau_etayage === "fort" || vitesse_lecture === "lente"
    ? ["audio", "image", "banque_de_mots"]
    : niveau_etayage === "moyen"
      ? ["exemple", "feedback_court"]
      : ["feedback_court"];

  const formats_autorises = niveau_etayage === "fort"
    ? ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"]
    : niveau_etayage === "moyen"
      ? ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_orale"]
      : ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_ecrite", "production_orale"];

  const formats_interdits = niveau_etayage === "fort" || regle_descente
    ? ["redaction_libre", "texte_long", "production_ecrite_longue"]
    : ["texte_long"];

  const feedback_type = competence_cible === "Structures" || competence_blocage === "EE"
    ? "structurel"
    : vitesse_lecture === "lente" || niveau_etayage === "fort"
      ? "phonologique"
      : "encourageant";

  const besoin_pedagogique = outcome?.besoin_pedagogique
    ?? (progression === "remediation" ? "remediation" : progression === "augmente" ? "approfondissement" : "consolidation");

  return {
    niveau_variante,
    niveau_etayage,
    competence_blocage,
    competence_cible,
    besoin_pedagogique,
    vitesse_lecture,
    formats_autorises,
    formats_interdits,
    supports_obligatoires,
    longueur_max_consigne_mots: niveau_etayage === "fort" || vitesse_lecture === "lente" ? 8 : niveau_etayage === "moyen" ? 12 : 16,
    nombre_items_max: niveau_etayage === "fort" ? 3 : niveau_etayage === "moyen" ? 5 : 8,
    feedback_type,
    strategie: buildStrategy(competence_blocage, competence_cible, niveau_etayage, besoin_pedagogique),
    regle_descente,
  };
}

export function formatPedagogicalDirectives(directives: PedagogicalDirectives): string {
  const lines = [
    "DIRECTIVES PEDAGOGIQUES CONTRAIGNANTES:",
    `- niveau_variante: ${directives.niveau_variante}; etayage: ${directives.niveau_etayage}`,
    `- besoin_pedagogique: ${directives.besoin_pedagogique}; vitesse_lecture: ${directives.vitesse_lecture}`,
    `- competence_blocage: ${directives.competence_blocage ?? "aucune"}; competence_cible: ${directives.competence_cible ?? "selon objectif"}`,
    `- formats_autorises: ${directives.formats_autorises.join(", ")}`,
    `- formats_interdits: ${directives.formats_interdits.join(", ")}`,
    `- supports_obligatoires: ${directives.supports_obligatoires.join(", ")}`,
    `- limites: consigne <= ${directives.longueur_max_consigne_mots} mots; items <= ${directives.nombre_items_max}`,
    `- feedback: ${directives.feedback_type}`,
    `- strategie: ${directives.strategie}`,
  ];
  if (directives.regle_descente) lines.push(`- descente_competence: ${directives.regle_descente}`);
  return lines.join("\n");
}
