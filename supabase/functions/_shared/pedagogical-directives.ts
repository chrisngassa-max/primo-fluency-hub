import {
  formatDemarcheWeightGuidance,
  getMergedRemediationFormats,
  getStructuresMeasurementRule,
  getStructuresSessionMix,
  matchSwitchRule,
  niveauToBand,
  resolveFormatsToGenerateurs,
} from "./referential-loader.ts";

export type ExerciseVariantLevel = "bas" | "standard" | "haut";
export type ScaffoldingLevel = "fort" | "moyen" | "faible";
export type CompetenceKey = "CO" | "CE" | "EE" | "EO" | "Structures";
export type WrittenProfile = "NSA" | "Alpha" | "Post-Alpha" | "FLE" | "inconnu";
export type StructuresPilier = "conjugaison" | "grammaire" | "phonetique" | "vocabulaire";
export type TypeDemarche = "titre_sejour" | "naturalisation";

/** All four TCF IRN competencies are worked for every demarche; weekly weights differ. */
export const TCF_COMPETENCES = ["CO", "CE", "EE", "EO"] as const;

export function formatEpreuvesAutorisees(demarche: TypeDemarche): string {
  return `${TCF_COMPETENCES.join(", ")} (4 compétences + Structures — ${formatDemarcheWeightGuidance(demarche)})`;
}

export interface StudentProfileSignals {
  niveau_actuel?: string | null;
  taux_reussite_co?: number | string | null;
  taux_reussite_ce?: number | string | null;
  taux_reussite_ee?: number | string | null;
  taux_reussite_eo?: number | string | null;
  taux_reussite_structures?: number | string | null;
  priorites_pedagogiques?: unknown;
  vitesse_lecture?: "lente" | "fluide" | null;
  niveau_scolarisation?: string | null;
  aisance_numerique?: string | null;
  projet_personnel?: string | null;
  objectif_tcf?: string | null;
  preferences_apprentissage?: string[] | null;
  besoins_accessibilite?: string[] | null;
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
  profil_ecrit: WrittenProfile;
  alphabet_l1: string | null;
  formats_autorises: string[];
  formats_interdits: string[];
  supports_obligatoires: string[];
  longueur_max_consigne_mots: number;
  nombre_items_max: number;
  feedback_type: "phonologique" | "structurel" | "encourageant";
  strategie: string;
  regle_descente: string | null;
  contexte_prioritaire: string | null;
  objectif_tcf: string | null;
}

interface BuildInput {
  profile?: StudentProfileSignals | null;
  outcome?: StudentOutcomeSignals | null;
  progression?: string | null;
  weakCompetences?: string[] | null;
  targetCompetence?: string | null;
  dominantErrorType?: string;
  dominantPilier?: StructuresPilier;
  typeDemarche?: TypeDemarche;
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

function priorityValue(priorities: unknown, keys: string[]): string | null {
  if (!priorities || typeof priorities !== "object" || Array.isArray(priorities)) return null;
  const entries = Object.entries(priorities as Record<string, unknown>);
  for (const [key, value] of entries) {
    const normalizedKey = key.toLowerCase();
    if (!keys.some((candidate) => normalizedKey === candidate || normalizedKey.includes(candidate))) continue;
    if (value == null || value === false) return null;
    return String(value);
  }
  return null;
}

function deriveWrittenProfile(profile?: StudentProfileSignals | null): WrittenProfile {
  const value = priorityValue(profile?.priorites_pedagogiques, ["profil_ecrit", "litteratie", "profil_litteratie"]);
  const normalized = value?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return "inconnu";
  if (normalized === "nsa" || normalized.includes("non_scripteur") || normalized.includes("non scripteur")) return "NSA";
  if (normalized === "alpha" || normalized.includes("alphabetisation")) return "Alpha";
  if (normalized === "post-alpha" || normalized === "post_alpha" || normalized.includes("post alpha")) return "Post-Alpha";
  if (normalized === "fle" || normalized.includes("scolarise")) return "FLE";
  return "inconnu";
}

function deriveAlphabetL1(profile?: StudentProfileSignals | null): string | null {
  const value = priorityValue(profile?.priorites_pedagogiques, ["alphabet_l1", "alphabet", "systeme_ecriture"]);
  return value?.trim() || null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
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
  const {
    profile,
    outcome,
    progression,
    weakCompetences,
    targetCompetence,
    dominantErrorType,
    dominantPilier,
    typeDemarche,
  } = input;
  const niveau_variante = deriveVariantLevel(profile, outcome, progression);
  const niveau_etayage = variantToScaffolding(niveau_variante);
  const vitesse_lecture = deriveReadingSpeed(profile);
  const profil_ecrit = deriveWrittenProfile(profile);
  const alphabet_l1 = deriveAlphabetL1(profile);
  const competence_blocage = deriveBlockingCompetence(profile, weakCompetences, targetCompetence);
  const lowSchooling = profile?.niveau_scolarisation === "non_scolarise"
    || profile?.niveau_scolarisation === "primaire";
  const limitedLiteracy = profil_ecrit === "NSA" || profil_ecrit === "Alpha" || lowSchooling;
  const lowDigitalComfort = profile?.aisance_numerique === "faible";
  const preferences = profile?.preferences_apprentissage ?? [];
  const accessibilityNeeds = profile?.besoins_accessibilite ?? [];
  const niveauActuel = profile?.niveau_actuel ?? "A1";
  const niveauBand = niveauToBand(niveauActuel);
  const progressionMode = progression === "remediation"
    ? "remediation"
    : progression === "augmente"
      ? "augmente"
      : "consolide";

  const switchRule = matchSwitchRule({
    niveauCecrl: niveauActuel,
    competenceScores: {
      CO: asNumber(profile?.taux_reussite_co) ?? undefined,
      CE: asNumber(profile?.taux_reussite_ce) ?? undefined,
      EE: asNumber(profile?.taux_reussite_ee) ?? undefined,
      EO: asNumber(profile?.taux_reussite_eo) ?? undefined,
      Structures: asNumber(profile?.taux_reussite_structures) ?? undefined,
    },
    errorCounts: dominantErrorType ? { [dominantErrorType]: 1 } : undefined,
  });
  const pilierFocus = dominantPilier
    ?? (switchRule?.pilier_cible === "vocabulaire_phonetique"
      ? "vocabulaire"
      : switchRule?.pilier_cible as StructuresPilier | undefined);

  const eeScore = asNumber(profile?.taux_reussite_ee);
  const eoScore = asNumber(profile?.taux_reussite_eo);
  const structuresScore = asNumber(profile?.taux_reussite_structures);
  const shouldDescendFromWriting = (eeScore != null && eeScore < 50)
    || (eoScore != null && eoScore < 50)
    || competence_blocage === "EE"
    || switchRule?.competence_suspendue === "EE"
    || switchRule?.competence_suspendue === "EE_EO";
  const structuresWeak = structuresScore == null || structuresScore < 60 || pilierFocus != null;
  let competence_cible: CompetenceKey | null = shouldDescendFromWriting && structuresWeak
    ? "Structures"
    : competence_blocage;

  const regles_descente: string[] = [
    shouldDescendFromWriting && structuresWeak
      ? `EE/EO faible: ne pas demander de redaction libre. Redescendre vers Structures${pilierFocus ? ` (pilier ${pilierFocus})` : ""}, lexique en contexte, banque de mots ou texte lacunaire.`
      : "",
    limitedLiteracy
      ? `Profil ecrit ${profil_ecrit}: changer la modalite avant de baisser le niveau; proposer consigne audio, image, exemple resolu, manipulation ou appariement.`
      : "",
    switchRule?.action === "enter_focus" && pilierFocus
      ? `Bascule Structures: ${switchRule.id} -> focus ${pilierFocus} (~${switchRule.volume_seance_pct ?? 20}% de la seance).`
      : "",
  ].filter(Boolean);

  if (typeDemarche) {
    regles_descente.push(formatDemarcheWeightGuidance(typeDemarche));
  }

  if (pilierFocus) {
    const measurement = getStructuresMeasurementRule(pilierFocus);
    const formatsMesure = (measurement?.formats_valides_mesure as string[] | undefined) ?? [];
    if (formatsMesure.length) {
      regles_descente.push(`Pilier Structures ${pilierFocus}: privilegier ${formatsMesure.join(", ")}.`);
    }
    const sessionMix = getStructuresSessionMix(niveauActuel, progressionMode);
    const poids = sessionMix?.poids_piliers as Record<string, number> | undefined;
    if (poids) {
      const mixText = Object.entries(poids)
        .map(([pilier, poidsValue]) => `${pilier} ${Math.round(poidsValue * 100)}%`)
        .join(", ");
      regles_descente.push(`Mix Structures (${niveauActuel}, ${progressionMode}): ${mixText}.`);
    }
  }

  if (dominantErrorType) {
    const remediation = getMergedRemediationFormats(dominantErrorType, niveauBand);
    if (remediation.strategie) {
      regles_descente.push(`Erreur ${dominantErrorType}: ${remediation.strategie}`);
    }
  }

  const regle_descente = regles_descente.length ? regles_descente.join(" ") : null;

  const supports_obligatoires = limitedLiteracy
    ? ["consigne_audio", "image", "banque_de_mots", "exemple_resolu"]
    : niveau_etayage === "fort" || vitesse_lecture === "lente"
    ? ["audio", "image", "banque_de_mots"]
    : niveau_etayage === "moyen"
      ? ["exemple", "feedback_court"]
      : ["feedback_court"];
  if (preferences.includes("audio") || accessibilityNeeds.includes("dyslexie") || accessibilityNeeds.includes("vision")) {
    supports_obligatoires.push("audio");
  }
  if (preferences.includes("visuel")) {
    supports_obligatoires.push("image");
  }
  if (preferences.includes("exemples")) {
    supports_obligatoires.push("exemple_resolu");
  }

  let formats_autorises = limitedLiteracy
    ? ["qcm", "vrai_faux", "appariement", "selection_image", "texte_lacunaire"]
    : niveau_etayage === "fort"
      ? ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation"]
    : niveau_etayage === "moyen"
      ? ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_orale"]
      : ["qcm", "vrai_faux", "appariement", "texte_lacunaire", "transformation", "production_ecrite", "production_orale"];
  if (lowDigitalComfort) {
    formats_autorises = formats_autorises.filter((format) =>
      ["qcm", "vrai_faux", "production_orale"].includes(format)
    );
  }

  if (dominantErrorType) {
    const remediation = getMergedRemediationFormats(dominantErrorType, niveauBand);
    if (remediation.formats.length) {
      formats_autorises = unique([...formats_autorises, ...remediation.formats]);
    }
  }

  if (pilierFocus) {
    const measurement = getStructuresMeasurementRule(pilierFocus);
    const formatsMesure = resolveFormatsToGenerateurs(
      (measurement?.formats_valides_mesure as string[] | undefined) ?? [],
    );
    if (formatsMesure.length && competence_cible === "Structures") {
      formats_autorises = unique([...formats_autorises, ...formatsMesure]);
    }
  }

  const formats_interdits = unique([
    "texte_long",
    ...(niveau_etayage === "fort" || regle_descente ? ["redaction_libre", "production_ecrite_longue"] : []),
    ...(limitedLiteracy ? ["production_ecrite_libre", "consigne_ecrite_seule", "copie_longue"] : []),
    ...(lowDigitalComfort ? ["glisser_deposer", "appariement_complexe", "saisie_longue"] : []),
    ...(dominantErrorType
      ? getMergedRemediationFormats(dominantErrorType, niveauBand).interdits
      : []),
  ]);

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
    profil_ecrit,
    alphabet_l1,
    formats_autorises: unique(formats_autorises),
    formats_interdits,
    supports_obligatoires: unique(supports_obligatoires),
    longueur_max_consigne_mots: limitedLiteracy ? 6 : niveau_etayage === "fort" || vitesse_lecture === "lente" ? 8 : niveau_etayage === "moyen" ? 12 : 16,
    nombre_items_max: niveau_etayage === "fort" ? 3 : niveau_etayage === "moyen" ? 5 : 8,
    feedback_type,
    strategie: buildStrategy(competence_blocage, competence_cible, niveau_etayage, besoin_pedagogique),
    regle_descente,
    contexte_prioritaire: profile?.projet_personnel?.trim() || null,
    objectif_tcf: profile?.objectif_tcf?.trim() || null,
  };
}

export function formatPedagogicalDirectives(directives: PedagogicalDirectives): string {
  const lines = [
    "DIRECTIVES PEDAGOGIQUES CONTRAIGNANTES:",
    `- niveau_variante: ${directives.niveau_variante}; etayage: ${directives.niveau_etayage}`,
    `- besoin_pedagogique: ${directives.besoin_pedagogique}; vitesse_lecture: ${directives.vitesse_lecture}`,
    `- profil_ecrit: ${directives.profil_ecrit}; alphabet_l1: ${directives.alphabet_l1 ?? "inconnu"}`,
    `- competence_blocage: ${directives.competence_blocage ?? "aucune"}; competence_cible: ${directives.competence_cible ?? "selon objectif"}`,
    `- formats_autorises: ${directives.formats_autorises.join(", ")}`,
    `- formats_interdits: ${directives.formats_interdits.join(", ")}`,
    `- supports_obligatoires: ${directives.supports_obligatoires.join(", ")}`,
    `- limites: consigne <= ${directives.longueur_max_consigne_mots} mots; items <= ${directives.nombre_items_max}`,
    `- feedback: ${directives.feedback_type}`,
    `- strategie: ${directives.strategie}`,
    `- contexte_prioritaire: ${directives.contexte_prioritaire ?? "vie quotidienne en France"}`,
    `- objectif_tcf: ${directives.objectif_tcf ?? "non renseigne"}`,
  ];
  if (directives.regle_descente) lines.push(`- descente_competence: ${directives.regle_descente}`);
  return lines.join("\n");
}
