// Mock data for "Suivi en direct de la classe" dashboard.
// Structure designed to be easily swapped for real backend data later.

export type LiveStudent = {
  id: string;
  nom: string;
  avatar?: string | null;
  groupe: string;
  lecon: string;
  exercice: string;
  theme: string;
  competence: "CO" | "CE" | "EE" | "EO" | "Structures";
  difficulte: number; // 1-5
  progression: number; // 0-100
  taux_reussite: number; // 0-100
  tentatives_question: number;
  temps_inactif_s: number;
  question_actuelle: string;
  derniere_erreur?: string | null;
  alertes: string[];
  // Adaptive piloting fields
  termine: boolean;
  temps_total_s: number;
  erreurs_consecutives: number;
};

export const mockGroupes = ["Groupe A1", "Groupe A2", "Groupe B1"];
export const mockLecons = [
  "Préfecture - vocabulaire",
  "CAF - documents",
  "Logement - dialogue",
  "Emploi - CV",
];

// Average class time (seconds) per exercise — used to detect fast finishers.
export const mockTempsMoyenClasseS = 480; // 8 min average

export const mockLiveStudents: LiveStudent[] = [
  {
    id: "s1",
    nom: "Aïcha Diallo",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "Préfecture - vocabulaire",
    exercice: "QCM Titres de séjour",
    theme: "Préfecture",
    competence: "CE",
    difficulte: 2,
    progression: 100,
    taux_reussite: 92,
    tentatives_question: 1,
    temps_inactif_s: 12,
    question_actuelle: "Q7 — Quel document pour un renouvellement ?",
    derniere_erreur: null,
    alertes: [],
    termine: true,
    temps_total_s: 290, // ~60% du temps moyen → challenger
    erreurs_consecutives: 0,
  },
  {
    id: "s2",
    nom: "Mohamed El Idrissi",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "Préfecture - vocabulaire",
    exercice: "QCM Titres de séjour",
    theme: "Préfecture",
    competence: "CE",
    difficulte: 2,
    progression: 45,
    taux_reussite: 58,
    tentatives_question: 2,
    temps_inactif_s: 35,
    question_actuelle: "Q4 — Que signifie 'récépissé' ?",
    derniere_erreur: "A choisi 'reçu de paiement'",
    alertes: [],
    termine: false,
    temps_total_s: 0,
    erreurs_consecutives: 1,
  },
  {
    id: "s3",
    nom: "Fatou Sow",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "Préfecture - vocabulaire",
    exercice: "Texte lacunaire CAF",
    theme: "CAF",
    competence: "Structures",
    difficulte: 2,
    progression: 30,
    taux_reussite: 42,
    tentatives_question: 4,
    temps_inactif_s: 110,
    question_actuelle: "Q3 — Compléter : 'Je dois ___ une attestation'",
    derniere_erreur: "A écrit 'recevoir' au lieu de 'demander'",
    alertes: ["echecs_repetes", "inactivite"],
    termine: false,
    temps_total_s: 0,
    erreurs_consecutives: 3,
  },
  {
    id: "s4",
    nom: "Omar Benali",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "CAF - documents",
    exercice: "Compréhension orale CAF",
    theme: "CAF",
    competence: "CO",
    difficulte: 3,
    progression: 100,
    taux_reussite: 95,
    tentatives_question: 1,
    temps_inactif_s: 5,
    question_actuelle: "Q9 — Audio : combien de pièces fournir ?",
    derniere_erreur: null,
    alertes: [],
    termine: true,
    temps_total_s: 310, // ~65% temps moyen → challenger
    erreurs_consecutives: 0,
  },
  {
    id: "s5",
    nom: "Lina Haddad",
    avatar: null,
    groupe: "Groupe A2",
    lecon: "CAF - documents",
    exercice: "QCM Allocations",
    theme: "CAF",
    competence: "CE",
    difficulte: 2,
    progression: 60,
    taux_reussite: 65,
    tentatives_question: 2,
    temps_inactif_s: 22,
    question_actuelle: "Q5 — Qui peut demander la prime d'activité ?",
    derniere_erreur: "Hésitation entre 2 réponses",
    alertes: [],
    termine: false,
    temps_total_s: 0,
    erreurs_consecutives: 0,
  },
  {
    id: "s6",
    nom: "Karim Touré",
    avatar: null,
    groupe: "Groupe B1",
    lecon: "Emploi - CV",
    exercice: "Production écrite : lettre de motivation",
    theme: "Emploi",
    competence: "EE",
    difficulte: 3,
    progression: 25,
    taux_reussite: 38,
    tentatives_question: 5,
    temps_inactif_s: 140,
    question_actuelle: "Q2 — Rédiger une phrase d'accroche",
    derniere_erreur: "Phrase incomplète, structure incorrecte",
    alertes: ["echecs_repetes", "inactivite"],
    termine: false,
    temps_total_s: 0,
    erreurs_consecutives: 4,
  },
  {
    id: "s7",
    nom: "Sara Mansouri",
    avatar: null,
    groupe: "Groupe B1",
    lecon: "Emploi - CV",
    exercice: "Production écrite : lettre de motivation",
    theme: "Emploi",
    competence: "EE",
    difficulte: 3,
    progression: 100,
    taux_reussite: 88,
    tentatives_question: 1,
    temps_inactif_s: 18,
    question_actuelle: "Q4 — Décrire son expérience",
    derniere_erreur: null,
    alertes: [],
    termine: true,
    temps_total_s: 520, // > 70% → stable malgré bon score
    erreurs_consecutives: 0,
  },
  {
    id: "s8",
    nom: "Yacine Bouzid",
    avatar: null,
    groupe: "Groupe A1",
    lecon: "Logement - dialogue",
    exercice: "Dialogue : visite d'appartement",
    theme: "Logement",
    competence: "CO",
    difficulte: 2,
    progression: 50,
    taux_reussite: 55,
    tentatives_question: 2,
    temps_inactif_s: 95,
    question_actuelle: "Q6 — Compléter la réponse de l'agent",
    derniere_erreur: "A confondu 'loyer' et 'caution'",
    alertes: ["inactivite"],
    termine: false,
    temps_total_s: 0,
    erreurs_consecutives: 1,
  },
];

export const ALERT_THRESHOLDS = {
  ECHECS_QUESTION: 3, // > 3 échecs sur la même question
  INACTIVITE_S: 90, // > 90s sans action
};

export const ADAPTIVE_THRESHOLDS = {
  CHALLENGE_REUSSITE_MIN: 85,
  CHALLENGE_TEMPS_RATIO_MAX: 0.7, // <= 70% du temps moyen
  AIDE_REUSSITE_MAX: 50,
  AIDE_ERREURS_CONSEC: 3,
  AIDE_INACTIVITE_S: 90,
};

export type AdaptiveBadge = "challenger" | "aider" | "stable";

export function classifyAdaptive(
  s: LiveStudent,
  tempsMoyenClasseS: number = mockTempsMoyenClasseS,
): AdaptiveBadge {
  // À aider — priorité sur challenger
  if (
    s.taux_reussite < ADAPTIVE_THRESHOLDS.AIDE_REUSSITE_MAX ||
    s.erreurs_consecutives >= ADAPTIVE_THRESHOLDS.AIDE_ERREURS_CONSEC ||
    s.temps_inactif_s > ADAPTIVE_THRESHOLDS.AIDE_INACTIVITE_S
  ) {
    return "aider";
  }
  // À challenger
  if (
    s.termine &&
    s.taux_reussite >= ADAPTIVE_THRESHOLDS.CHALLENGE_REUSSITE_MIN &&
    s.temps_total_s > 0 &&
    s.temps_total_s <= tempsMoyenClasseS * ADAPTIVE_THRESHOLDS.CHALLENGE_TEMPS_RATIO_MAX
  ) {
    return "challenger";
  }
  return "stable";
}
