import {
  createDefaultSessionTemplateV4,
  type SessionTemplateV4,
} from "@/lib/sessionTemplateV4";

export const LOGEMENT_CE_CO_TEMPLATE_V4: SessionTemplateV4 = {
  ...createDefaultSessionTemplateV4({
    theme: "logement",
    objectif_commun: "Comprendre une annonce de logement et une information pratique.",
    competence_commune: "CE",
  }),
  id: "logement-ce-co-mvp",
  duree_totale_min: 80,
  phases: {
    ...createDefaultSessionTemplateV4({
      theme: "logement",
      objectif_commun: "Comprendre une annonce de logement et une information pratique.",
      competence_commune: "CE",
    }).phases,
    phase1_ouverture: {
      duree_min: 10,
      collective: true,
      vocabulaire_cle: [
        "loyer",
        "charges",
        "caution",
        "surface",
        "rendez-vous",
        "dossier",
      ],
      question_declenchante: "Quelles informations faut-il verifier avant de visiter un logement ?",
    },
    phase2_tronc_commun: {
      duree_min: 25,
      collective: false,
      competence_commune: "CE",
      supports_par_niveau: {
        // Les exercise_id seront renseignes apres le taggage du corpus logement.
      },
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
      message_apprenant_template: "Activite personnalisee : comprendre une information pratique sur le logement.",
    },
    phase4_mise_en_commun: {
      duree_min: 10,
      collective: true,
      elements_obligatoires: [
        "vocabulaire_seance",
        "strategie_tcf",
        "erreur_type_commune",
        "phrase_modele",
        "contribution_collective",
      ],
    },
    phase5_devoir: {
      duree_min: 10,
      collective: false,
      mode: "auto_genere_apres_seance",
      version_hors_ligne: true,
    },
  },
};

export const LOGEMENT_CE_CO_CORPUS_REQUIREMENTS = {
  theme: "logement",
  competences: ["CE", "CO"],
  niveaux: ["A1", "A2", "B1", "B2"],
  coA2B2MinimumCount: 18,
  situations: [
    "annonce vocale",
    "message d'agence",
    "rendez-vous visite",
    "etat des lieux",
    "demande de document",
  ],
} as const;
