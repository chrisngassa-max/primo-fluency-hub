import type { CompetenceTCF } from "./studentProfileV4";
import type { ExerciseThemeV4 } from "./exerciseMetadataV4";

export type SessionPhaseV4 =
  | "phase1_ouverture"
  | "phase2_tronc_commun"
  | "phase3_atelier_cible"
  | "phase4_mise_en_commun"
  | "phase5_devoir";

export interface Phase1OuvertureV4 {
  duree_min: number;
  collective: true;
  vocabulaire_cle: string[];
  question_declenchante: string;
}

export interface Phase2TroncCommunV4 {
  duree_min: number;
  collective: false;
  competence_commune: Extract<CompetenceTCF, "CO" | "CE">;
  supports_par_niveau: Partial<Record<"A0" | "A1" | "A2" | "B1" | "B2", {
    exercise_id: string;
    intitule_commun: string;
  }>>;
  regle_montee: {
    seuil_score: 80;
    nb_seances_consecutives: 2;
    action: "upgrade_support_niveau_suivant";
  };
}

export interface Phase3AtelierCibleV4 {
  duree_min: number;
  collective: false;
  mvp_competences_disponibles: CompetenceTCF[];
  logique_assignation: "fragilite_principale_si_mvp_sinon_deuxieme_fragilite";
  message_apprenant_template: string;
}

export interface Phase4MiseEnCommunV4 {
  duree_min: number;
  collective: true;
  elements_obligatoires: [
    "vocabulaire_seance",
    "strategie_tcf",
    "erreur_type_commune",
    "phrase_modele",
    "contribution_collective",
  ];
}

export interface Phase5DevoirV4 {
  duree_min: number;
  collective: false;
  mode: "auto_genere_apres_seance";
  version_hors_ligne: boolean;
}

export interface SessionTemplatePhasesV4 {
  phase1_ouverture: Phase1OuvertureV4;
  phase2_tronc_commun: Phase2TroncCommunV4;
  phase3_atelier_cible: Phase3AtelierCibleV4;
  phase4_mise_en_commun: Phase4MiseEnCommunV4;
  phase5_devoir: Phase5DevoirV4;
}

export interface SessionTemplateV4 {
  id?: string;
  theme: ExerciseThemeV4;
  objectif_commun: string;
  duree_totale_min: number;
  mvp_competences: CompetenceTCF[];
  phases: SessionTemplatePhasesV4;
}

export const SESSION_PHASES_V4: SessionPhaseV4[] = [
  "phase1_ouverture",
  "phase2_tronc_commun",
  "phase3_atelier_cible",
  "phase4_mise_en_commun",
  "phase5_devoir",
];

export const PHASE4_ELEMENTS_OBLIGATOIRES: Phase4MiseEnCommunV4["elements_obligatoires"] = [
  "vocabulaire_seance",
  "strategie_tcf",
  "erreur_type_commune",
  "phrase_modele",
  "contribution_collective",
];

export function createDefaultSessionTemplateV4(input: {
  theme: ExerciseThemeV4;
  objectif_commun: string;
  competence_commune?: Extract<CompetenceTCF, "CO" | "CE">;
}): SessionTemplateV4 {
  const competence = input.competence_commune ?? "CE";

  return {
    theme: input.theme,
    objectif_commun: input.objectif_commun,
    duree_totale_min: 80,
    mvp_competences: ["CE", "CO"],
    phases: {
      phase1_ouverture: {
        duree_min: 10,
        collective: true,
        vocabulaire_cle: [],
        question_declenchante: "",
      },
      phase2_tronc_commun: {
        duree_min: 25,
        collective: false,
        competence_commune: competence,
        supports_par_niveau: {},
        regle_montee: {
          seuil_score: 80,
          nb_seances_consecutives: 2,
          action: "upgrade_support_niveau_suivant",
        },
      },
      phase3_atelier_cible: {
        duree_min: 25,
        collective: false,
        mvp_competences_disponibles: ["CE", "CO"],
        logique_assignation: "fragilite_principale_si_mvp_sinon_deuxieme_fragilite",
        message_apprenant_template: "Activite personnalisee : travailler une information pratique.",
      },
      phase4_mise_en_commun: {
        duree_min: 10,
        collective: true,
        elements_obligatoires: PHASE4_ELEMENTS_OBLIGATOIRES,
      },
      phase5_devoir: {
        duree_min: 10,
        collective: false,
        mode: "auto_genere_apres_seance",
        version_hors_ligne: true,
      },
    },
  };
}

export function validateSessionTemplateV4(template: SessionTemplateV4): string[] {
  const errors: string[] = [];
  if (!template.objectif_commun.trim()) errors.push("objectif_commun_required");
  if (template.duree_totale_min < 30 || template.duree_totale_min > 240) errors.push("duree_totale_invalid");

  const missing = SESSION_PHASES_V4.filter((phase) => !(template.phases as any)?.[phase]);
  if (missing.length) errors.push(`missing_phases:${missing.join(",")}`);

  if (template.phases?.phase1_ouverture?.collective !== true) errors.push("phase1_must_be_collective");
  if (template.phases?.phase4_mise_en_commun?.collective !== true) errors.push("phase4_must_be_collective");
  if (template.phases?.phase2_tronc_commun?.regle_montee?.seuil_score !== 80) errors.push("phase2_upgrade_threshold_invalid");
  if (template.phases?.phase2_tronc_commun?.regle_montee?.nb_seances_consecutives !== 2) errors.push("phase2_upgrade_count_invalid");

  const phase4Elements = template.phases?.phase4_mise_en_commun?.elements_obligatoires ?? [];
  const missingPhase4 = PHASE4_ELEMENTS_OBLIGATOIRES.filter((item) => !phase4Elements.includes(item));
  if (missingPhase4.length) errors.push(`phase4_missing_elements:${missingPhase4.join(",")}`);

  const studentMessage = template.phases?.phase3_atelier_cible?.message_apprenant_template ?? "";
  if (/faible|echec|échec|rem[eé]diation/i.test(studentMessage)) {
    errors.push("phase3_student_message_not_neutral");
  }

  return errors;
}

export function validateSessionTemplateReadinessV4(
  template: SessionTemplateV4,
  requiredLevels: Array<"A1" | "A2" | "B1" | "B2"> = ["A1", "A2", "B1", "B2"],
): string[] {
  const errors = validateSessionTemplateV4(template);
  const supports = template.phases.phase2_tronc_commun.supports_par_niveau;

  for (const level of requiredLevels) {
    const support = supports[level];
    if (!support?.exercise_id) {
      errors.push(`phase2_missing_support:${level}`);
      continue;
    }
    if (!support.intitule_commun.trim()) {
      errors.push(`phase2_missing_common_title:${level}`);
    }
  }

  if (!template.phases.phase1_ouverture.vocabulaire_cle.length) {
    errors.push("phase1_vocabulaire_required");
  }
  if (!template.phases.phase1_ouverture.question_declenchante.trim()) {
    errors.push("phase1_question_required");
  }

  return errors;
}
